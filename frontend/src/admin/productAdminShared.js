export function buildBundleName(bundleItems, products) {
  return (bundleItems ?? [])
    .map((item) => {
      const child = products.find((p) => p.id === item.productId)
      const label = String(child?.name || '').trim()
      if (!label) return null
      const qty = Math.max(1, Number(item.quantity) || 1)
      return qty > 1 ? `${label} ×${qty}` : label
    })
    .filter(Boolean)
    .join(' + ')
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export function geoLabel(product) {
  const allowed = product.allowedCountries ?? []
  const blocked = product.blockedCountries ?? []
  if (!allowed.length && !blocked.length) return 'Worldwide'
  const parts = []
  if (allowed.length) parts.push(`Allow: ${allowed.join(', ')}`)
  if (blocked.length) parts.push(`Block: ${blocked.join(', ')}`)
  return parts.join(' · ')
}

export function mapProductToForm(product) {
  return {
    name: product.name,
    slug: product.slug,
    category: product.category,
    productType: product.productType ?? 'standard',
    bundleItems: (product.bundleItems ?? []).map((item) => ({
      productId: item.productId,
      quantity: item.quantity ?? 1,
    })),
    price: product.price,
    originalPrice: product.originalPrice,
    rating: product.rating,
    stock: product.stock,
    licenseType: product.licenseType,
    imageUrl: product.imageUrl ?? '',
    visualAccent: product.visualAccent ?? 'from-sky-500 to-cyan-400',
    description: product.description ?? '',
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    focusKeywords: Array.isArray(product.focusKeywords) ? product.focusKeywords : [],
    shippingTitle: product.shippingTitle ?? '',
    shippingBullets:
      Array.isArray(product.shippingBullets) && product.shippingBullets.length
        ? product.shippingBullets
        : product.shippingText
          ? String(product.shippingText).split(/\n+/).map((line) => line.trim()).filter(Boolean)
          : [''],
    vendorId: product.vendorId ?? '',
    allowedCountries: product.allowedCountries ?? [],
    blockedCountries: product.blockedCountries ?? [],
    variants: (() => {
      const mapped = Array.isArray(product.variants)
        ? product.variants.map((v) => ({
            id: v.id,
            name: v.name ?? '',
            sku: v.sku ?? '',
            price: v.price,
            originalPrice: v.originalPrice,
            stock: v.stock ?? 0,
            description: v.description ?? '',
            imageUrl: v.imageUrl ?? '',
            tierLabel: v.tierLabel ?? '',
            isDefault: Boolean(v.isDefault),
          }))
        : []
      if (
        mapped.length === 1 &&
        /^standard$/i.test(String(mapped[0].name || '').trim()) &&
        !String(mapped[0].description || '').trim() &&
        !String(mapped[0].imageUrl || '').trim()
      ) {
        return []
      }
      return mapped
    })(),
    showOnHomepage: product.showOnHomepage !== false,
  }
}
