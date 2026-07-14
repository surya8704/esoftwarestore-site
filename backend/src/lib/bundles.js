import { Product } from '../db/models.js'
import { resolveStoreProductImage } from './productImages.js'
import { config } from '../config.js'

export function isBundleProduct(product) {
  return (product?.productType ?? 'standard') === 'bundle'
}

/**
 * Validate and normalize bundle component list.
 * Bundles require 2+ distinct standard products (no nested bundles).
 */
export async function validateAndNormalizeBundleItems(rawItems, { excludeProductId } = {}) {
  const items = Array.isArray(rawItems) ? rawItems : []
  if (items.length < 2) {
    throw new Error('A bundle must include at least 2 products')
  }

  const normalized = []
  const seen = new Set()
  for (const item of items) {
    const productId = String(item.productId ?? '').trim()
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))
    if (!productId) throw new Error('Each bundle item needs a product')
    if (excludeProductId && productId === String(excludeProductId)) {
      throw new Error('A bundle cannot include itself')
    }
    if (seen.has(productId)) {
      throw new Error('Duplicate products in a bundle are not allowed — increase quantity instead')
    }
    seen.add(productId)
    normalized.push({ productId, quantity })
  }

  const ids = normalized.map((i) => i.productId)
  const children = await Product.find({ _id: { $in: ids } }).lean()
  if (children.length !== ids.length) {
    throw new Error('One or more bundle products were not found')
  }

  for (const child of children) {
    if (isBundleProduct(child)) {
      throw new Error(`Cannot nest bundles: "${child.name}" is already a bundle`)
    }
    if (child.active === false) {
      throw new Error(`Bundle product "${child.name}" is inactive`)
    }
  }

  return normalized.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  }))
}

/** Attach display contents for storefront (batched). */
export async function attachBundleContents(products, apiPublicUrl = config.apiPublicUrl) {
  const list = Array.isArray(products) ? products : [products]
  const childIds = []
  for (const product of list) {
    if (!isBundleProduct(product)) continue
    for (const item of product.bundleItems ?? []) {
      const id = String(item.productId?._id ?? item.productId)
      if (id) childIds.push(id)
    }
  }

  const uniqueIds = [...new Set(childIds)]
  const children = uniqueIds.length
    ? await Product.find({ _id: { $in: uniqueIds }, active: true }).lean()
    : []
  const byId = new Map(children.map((c) => [String(c._id), c]))

  const enrichOne = (product) => {
    const base = {
      productType: product.productType ?? 'standard',
      isBundle: isBundleProduct(product),
      bundleItems: (product.bundleItems ?? []).map((item) => ({
        productId: String(item.productId?._id ?? item.productId),
        quantity: Number(item.quantity) || 1,
      })),
      bundleContents: [],
    }

    if (!base.isBundle) return base

    base.bundleContents = base.bundleItems
      .map((item) => {
        const child = byId.get(item.productId)
        if (!child) return null
        return {
          productId: String(child._id),
          quantity: item.quantity,
          name: child.name,
          slug: child.slug,
          category: child.category,
          price: Number(child.price),
          originalPrice: Number(child.originalPrice),
          imageUrl: resolveStoreProductImage(child, apiPublicUrl),
        }
      })
      .filter(Boolean)

    return base
  }

  if (Array.isArray(products)) {
    return products.map((p) => ({ ...p, ...enrichOne(p) }))
  }
  return { ...products, ...enrichOne(products) }
}

/**
 * Expand a priced cart line into OrderItem payloads.
 * Bundle lines become one OrderItem per component (keys from component pools).
 * Bundle price is allocated across children by list-price weight.
 */
export async function expandLineToOrderItems(line) {
  const product = line.product
  if (!product || !isBundleProduct(product) || !(product.bundleItems?.length >= 2)) {
    return [
      {
        productId: line.productId,
        variantId: line.variantId ?? null,
        productName: product?.name ?? 'Product',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        bundleProductId: null,
        bundleProductName: null,
      },
    ]
  }

  const childIds = product.bundleItems.map((i) => i.productId)
  const children = await Product.find({ _id: { $in: childIds } }).lean()
  const byId = new Map(children.map((c) => [String(c._id), c]))

  const components = []
  for (const item of product.bundleItems) {
    const child = byId.get(String(item.productId))
    if (!child) {
      throw new Error(`Bundle "${product.name}" is missing a product. Update the bundle in admin.`)
    }
    if (isBundleProduct(child)) {
      throw new Error(`Bundle "${product.name}" contains another bundle`)
    }
    const qtyPerBundle = Math.max(1, Number(item.quantity) || 1)
    components.push({
      child,
      quantity: qtyPerBundle * line.quantity,
      weight: Math.max(1, Number(child.price) || 1) * qtyPerBundle,
    })
  }

  if (components.length < 2) {
    throw new Error(`Bundle "${product.name}" must contain at least 2 valid products`)
  }

  const lineTotal = Math.round(Number(line.unitPrice) * Number(line.quantity))
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0)
  let allocated = 0

  return components.map((comp, index) => {
    let itemTotal
    if (index === components.length - 1) {
      itemTotal = Math.max(0, lineTotal - allocated)
    } else {
      itemTotal = Math.round((lineTotal * comp.weight) / totalWeight)
      allocated += itemTotal
    }
    const unitPrice = comp.quantity > 0 ? Math.round(itemTotal / comp.quantity) : 0
    return {
      productId: comp.child._id,
      variantId: null,
      productName: `${comp.child.name} (in ${product.name})`,
      quantity: comp.quantity,
      unitPrice,
      bundleProductId: product._id ?? product.id,
      bundleProductName: product.name,
    }
  })
}
