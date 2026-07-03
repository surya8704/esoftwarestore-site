import { LicenseKey, ProductVariant } from '../db/models.js'

export async function assignLicenseKey({ productId, variantId, orderId }) {
  const available = await LicenseKey.findOne({ productId, status: 'available' })
  if (available) {
    available.status = 'assigned'
    available.orderId = orderId
    available.assignedAt = new Date()
    await available.save()
    return available.licenseKey
  }

  const generated = `ES-${productId}-${variantId ?? '0'}-${orderId}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  await LicenseKey.create({
    productId,
    variantId: variantId || undefined,
    licenseKey: generated,
    status: 'assigned',
    orderId,
    assignedAt: new Date(),
  })
  return generated
}

export async function seedLicensePool(productId, count = 5) {
  const keys = Array.from({ length: count }, (_, index) => ({
    productId,
    licenseKey: `POOL-${productId}-${String(index + 1).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    status: 'available',
  }))
  if (keys.length) await LicenseKey.insertMany(keys, { ordered: false }).catch(() => {})
}

export async function getVariant(variantId) {
  if (!variantId) return null
  return ProductVariant.findById(variantId)
}
