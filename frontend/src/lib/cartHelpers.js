export function normalizeProductId(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'object') {
    if (value.id != null) return String(value.id)
    if (value._id != null) return String(value._id)
    if (typeof value.toString === 'function') {
      const asString = String(value.toString())
      if (asString && asString !== '[object Object]') return asString
    }
    return ''
  }
  return String(value)
}

export function getCartItemProductId(item) {
  return normalizeProductId(item?.productId ?? item?.product?.id ?? item?.product?._id)
}

export function getCartItemVariantId(item) {
  const variantId = item?.variantId
  if (variantId == null || variantId === '') return ''
  return String(variantId)
}

/** Total units in cart for a product. Pass variantId to count only that edition. */
export function getCartQuantityForProduct(cart, productId, variantId = null) {
  const id = normalizeProductId(productId)
  if (!id) return 0
  const variant = variantId == null || variantId === '' ? null : String(variantId)

  return (cart?.items ?? []).reduce((sum, item) => {
    if (getCartItemProductId(item) !== id) return sum
    if (variant != null && getCartItemVariantId(item) !== variant) return sum
    return sum + Math.max(0, Number(item.quantity) || 0)
  }, 0)
}

export function getCartTotalQuantity(cart) {
  return (cart?.items ?? []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0)
}

export function getCartLineCount(cart) {
  return cart?.items?.length ?? 0
}

export function defaultVariantId(product) {
  if (!product?.variants?.length) return null
  const def = product.variants.find((v) => v.isDefault) ?? product.variants[0]
  return def?.id ?? null
}
