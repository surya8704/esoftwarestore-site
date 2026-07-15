/** Mirrors backend volume tiers for storefront display. */
export const VOLUME_DISCOUNT_TIERS = [
  { minQty: 1, discountPercent: 0, label: '1–4 units', description: 'Standard price' },
  { minQty: 5, discountPercent: 5, label: '5–24 units', description: '5% off' },
  { minQty: 25, discountPercent: 8, label: '25–99 units', description: '8% off' },
  { minQty: 100, discountPercent: 10, label: '100+ units', description: '10% off' },
]

export function getVolumeDiscountPercent(quantity, tiers = VOLUME_DISCOUNT_TIERS) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))
  let discount = 0
  for (const tier of tiers) {
    if (qty >= tier.minQty) discount = tier.discountPercent
  }
  return discount
}

export function activeVolumeTierMinQty(quantity, tiers = VOLUME_DISCOUNT_TIERS) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))
  let active = tiers[0]?.minQty ?? 1
  for (const tier of tiers) {
    if (qty >= tier.minQty) active = tier.minQty
  }
  return active
}

export function priceWithVolumeDiscount(unitPrice, quantity, tiers) {
  const list = Math.round(Number(unitPrice) || 0)
  const pct = getVolumeDiscountPercent(quantity, tiers)
  if (!pct || list <= 0) return { unitPrice: list, listUnitPrice: list, volumeDiscountPercent: 0 }
  return {
    unitPrice: Math.max(1, Math.round((list * (100 - pct)) / 100)),
    listUnitPrice: list,
    volumeDiscountPercent: pct,
  }
}
