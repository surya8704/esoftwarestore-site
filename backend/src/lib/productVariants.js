import { z } from 'zod'
import { mapId } from '../db/client.js'
import { ProductVariant } from '../db/models.js'

export const variantInputSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, 'Variant name is required').max(120),
  sku: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v == null ? '' : String(v).trim())),
  price: z.coerce.number().positive('Variant price must be greater than 0'),
  originalPrice: z.coerce.number().positive('Variant original price must be greater than 0'),
  stock: z.coerce.number().int().min(0).default(0),
  description: z
    .string()
    .max(50000)
    .optional()
    .transform((v) => (v == null ? '' : String(v))),
  tierLabel: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v == null ? '' : String(v).trim())),
  isDefault: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
})

export const variantsArraySchema = z
  .array(variantInputSchema)
  .max(40)
  .optional()

function slugPart(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function normalizeVariant(variant) {
  const v = mapId(variant)
  return {
    ...v,
    productId: v.productId?.toString?.() ?? v.productId,
    price: Number(v.price),
    originalPrice: Number(v.originalPrice),
    stock: Number(v.stock),
    description: String(v.description ?? ''),
    tierMinQty: Number(v.tierMinQty) || 1,
    isDefault: Boolean(v.isDefault),
    active: v.active !== false,
  }
}

export async function listVariantsForProduct(productId) {
  const rows = await ProductVariant.find({ productId, active: true }).sort({ isDefault: -1, name: 1 }).lean()
  return rows.map(normalizeVariant)
}

export async function listVariantsByProductIds(productIds = []) {
  if (!productIds.length) return new Map()
  const rows = await ProductVariant.find({ productId: { $in: productIds }, active: true })
    .sort({ isDefault: -1, name: 1 })
    .lean()
  const map = new Map()
  for (const row of rows) {
    const key = String(row.productId)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(normalizeVariant(row))
  }
  return map
}

async function uniqueSku(baseSku, { excludeId } = {}) {
  let candidate = String(baseSku || 'sku').slice(0, 70)
  if (!candidate) candidate = `sku-${Date.now()}`
  let attempt = candidate
  let n = 1
  while (true) {
    const existing = await ProductVariant.findOne({ sku: attempt }).select('_id').lean()
    if (!existing || (excludeId && String(existing._id) === String(excludeId))) return attempt
    n += 1
    attempt = `${candidate}-${n}`.slice(0, 80)
  }
}

/**
 * Replace/sync edition variants for a product.
 * Always leaves at least one active default variant.
 */
export async function syncProductVariants(product, variantsInput) {
  const productId = product._id ?? product.id
  const productSlug = slugPart(product.slug || product.name) || 'product'
  const list = Array.isArray(variantsInput) ? variantsInput : []

  const parsed = list.length
    ? z.array(variantInputSchema).parse(list)
    : [
        {
          name: 'Standard',
          sku: `${productSlug}-std`,
          price: Number(product.price),
          originalPrice: Number(product.originalPrice || product.price),
          stock: Math.max(0, Number(product.stock) || 0),
          description: String(product.description || ''),
          tierLabel: '',
          isDefault: true,
          active: true,
        },
      ]

  // Exactly one default
  let defaultIndex = parsed.findIndex((v) => v.isDefault)
  if (defaultIndex < 0) defaultIndex = 0
  const normalized = parsed.map((v, i) => ({
    ...v,
    isDefault: i === defaultIndex,
    active: v.active !== false,
  }))

  const existing = await ProductVariant.find({ productId })
  const keepIds = new Set()

  for (const item of normalized) {
    const baseSku =
      item.sku ||
      `${productSlug}-${slugPart(item.name) || 'edition'}`
    const sku = await uniqueSku(baseSku, { excludeId: item.id })

    if (item.id) {
      const row = existing.find((e) => String(e._id) === String(item.id))
      if (row) {
        row.name = item.name
        row.sku = sku
        row.price = item.price
        row.originalPrice = item.originalPrice
        row.stock = item.stock
        row.description = item.description ?? ''
        row.tierLabel = item.tierLabel || item.name
        row.tierMinQty = 1
        row.isDefault = item.isDefault
        row.active = item.active
        await row.save()
        keepIds.add(String(row._id))
        continue
      }
    }

    const created = await ProductVariant.create({
      productId,
      name: item.name,
      sku,
      price: item.price,
      originalPrice: item.originalPrice,
      stock: item.stock,
      description: item.description ?? '',
      tierLabel: item.tierLabel || item.name,
      tierMinQty: 1,
      isDefault: item.isDefault,
      active: item.active,
    })
    keepIds.add(String(created._id))
  }

  for (const row of existing) {
    if (!keepIds.has(String(row._id))) {
      row.active = false
      row.isDefault = false
      await row.save()
    }
  }

  // Mirror default variant pricing onto product for list/catalog consistency
  const defaults = await ProductVariant.find({ productId, active: true, isDefault: true }).lean()
  const fallback = await ProductVariant.findOne({ productId, active: true }).sort({ name: 1 }).lean()
  const primary = defaults[0] || fallback
  if (primary) {
    return {
      variants: await listVariantsForProduct(productId),
      productPricePatch: {
        price: Number(primary.price),
        originalPrice: Number(primary.originalPrice),
        stock: Number(primary.stock),
      },
    }
  }

  return { variants: [], productPricePatch: null }
}

/** Ensure a brand-new product has at least one Standard variant. */
export async function ensureDefaultVariant(product) {
  const productId = product._id ?? product.id
  const count = await ProductVariant.countDocuments({ productId, active: true })
  if (count > 0) return listVariantsForProduct(productId)
  const { variants } = await syncProductVariants(product, [])
  return variants
}
