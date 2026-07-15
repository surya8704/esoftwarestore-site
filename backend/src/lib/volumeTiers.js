/**
 * Automatic volume (quantity) discounts applied to every product.
 *
 * Tiers (highest matching minQty wins):
 * - 1–4 units: list price
 * - 5–24 units: 5% off
 * - 25–99 units: 8% off  (covers 25–50 and through 99 until the next break)
 * - 100+ units: 10% off
 */
export const VOLUME_DISCOUNT_TIERS = [
  { minQty: 1, discountPercent: 0, label: '1–4 units', description: 'Standard price' },
  { minQty: 5, discountPercent: 5, label: '5–24 units', description: '5% off' },
  { minQty: 25, discountPercent: 8, label: '25–99 units', description: '8% off' },
  { minQty: 100, discountPercent: 10, label: '100+ units', description: '10% off' },
]

export function getVolumeDiscountPercent(quantity) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))
  let discount = 0
  for (const tier of VOLUME_DISCOUNT_TIERS) {
    if (qty >= tier.minQty) discount = tier.discountPercent
  }
  return discount
}

export function applyVolumeDiscount(unitPrice, quantity) {
  const listUnitPrice = Math.round(Number(unitPrice) || 0)
  const volumeDiscountPercent = getVolumeDiscountPercent(quantity)
  if (!volumeDiscountPercent || listUnitPrice <= 0) {
    return {
      unitPrice: listUnitPrice,
      listUnitPrice,
      volumeDiscountPercent: 0,
    }
  }
  const discounted = Math.round((listUnitPrice * (100 - volumeDiscountPercent)) / 100)
  return {
    unitPrice: Math.max(1, discounted),
    listUnitPrice,
    volumeDiscountPercent,
  }
}

export function publicVolumeTiers() {
  return VOLUME_DISCOUNT_TIERS.map((tier) => ({
    minQty: tier.minQty,
    discountPercent: tier.discountPercent,
    label: tier.label,
    description: tier.description,
  }))
}
