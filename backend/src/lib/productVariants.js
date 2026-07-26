import mongoose from 'mongoose'
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
  imageUrl: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => (v == null ? '' : String(v).trim()))
    .refine((v) => !v || v.startsWith('/') || /^https?:\/\//i.test(v) || v.startsWith('data:image/'), {
      message: 'Variant image URL must be empty, a site path, or a full http(s) URL',
    }),
  tierLabel: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v == null ? '' : String(v).trim())),
  isDefault: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
})

export const variantsArraySchema = z.array(variantInputSchema).max(40).default([])

function slugPart(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function asObjectId(value) {
  if (!value) return value
  if (value instanceof mongoose.Types.ObjectId) return value
  const raw = String(value)
  if (mongoose.Types.ObjectId.isValid(raw)) return new mongoose.Types.ObjectId(raw)
  return value
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
    imageUrl: String(v.imageUrl ?? '').trim(),
    tierMinQty: Number(v.tierMinQty) || 1,
    isDefault: Boolean(v.isDefault),
    active: v.active !== false,
  }
}

export async function listVariantsForProduct(productId) {
  const rows = await ProductVariant.find({ productId: asObjectId(productId), active: true })
    .sort({ isDefault: -1, name: 1 })
    .lean()
  return rows.map(normalizeVariant)
}

export async function listVariantsByProductIds(productIds = []) {
  if (!productIds.length) return new Map()
  const ids = productIds.map(asObjectId)
  const rows = await ProductVariant.find({ productId: { $in: ids }, active: true })
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
 * Empty input deletes all editions — products without variations stay variant-free.
 * Removed editions are hard-deleted so they cannot reappear.
 */
export async function syncProductVariants(product, variantsInput) {
  const productId = asObjectId(product._id ?? product.id)
  const productSlug = slugPart(product.slug || product.name) || 'product'
  const list = Array.isArray(variantsInput) ? variantsInput.filter(Boolean) : []

  // No editions → permanently remove all variants for this product
  if (!list.length) {
    await ProductVariant.deleteMany({ productId })
    return { variants: [], productPricePatch: null }
  }

  const parsed = z.array(variantInputSchema).parse(list)

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
    const baseSku = item.sku || `${productSlug}-${slugPart(item.name) || 'edition'}`
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
        row.imageUrl = item.imageUrl ?? ''
        row.tierLabel = item.tierLabel || item.name
        row.tierMinQty = 1
        row.isDefault = item.isDefault
        row.active = true
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
      imageUrl: item.imageUrl ?? '',
      tierLabel: item.tierLabel || item.name,
      tierMinQty: 1,
      isDefault: item.isDefault,
      active: true,
    })
    keepIds.add(String(created._id))
  }

  // Hard-delete any editions not in the saved list (fixes soft-delete "coming back")
  const removeFilter = keepIds.size
    ? { productId, _id: { $nin: [...keepIds].map(asObjectId) } }
    : { productId }
  await ProductVariant.deleteMany(removeFilter)

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

/** Return existing active variants only — never invent a default edition. */
export async function ensureDefaultVariant(product) {
  return listVariantsForProduct(product._id ?? product.id)
}
