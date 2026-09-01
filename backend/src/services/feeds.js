import { config, CURRENCIES } from '../config.js'
import { convertPrice } from '../lib/utils.js'
import { resolveStoreProductImage } from '../lib/productImages.js'

const META_STORE_URL = 'https://www.esoftwarestore.com'
const META_FALLBACK_IMAGE = `${META_STORE_URL}/logo.svg`
const META_BRAND = 'eSoftware Store'

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  if (/[",]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function metaDescription(text, fallback = '') {
  const cleaned = String(text || fallback)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 5000)
}

function metaPrice(amount, currency) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) return ''
  const formatted = currency === 'USD' ? value.toFixed(2) : String(Math.round(value))
  return `${formatted} ${currency}`
}

function metaProductLink(slug) {
  return `${META_STORE_URL}/product/${slug}`
}

function metaImageUrl(product, variant) {
  const candidate = resolveStoreProductImage({ imageUrl: variant?.imageUrl || product.imageUrl })
  if (candidate && /^https?:\/\//i.test(candidate)) return candidate
  if (candidate && candidate.startsWith('/')) return `${config.apiPublicUrl.replace(/\/$/, '')}${candidate}`
  return META_FALLBACK_IMAGE
}

function metaAvailability(stock) {
  return Number(stock) > 0 ? 'in stock' : 'out of stock'
}

function metaRowsForProduct(product, variants, { currency, baseCurrency }) {
  const productId = String(product._id ?? product.id)
  const activeVariants = (variants ?? []).filter((v) => v.active !== false)

  const buildRow = ({ id, title, price, originalPrice, stock, imageUrl, itemGroupId }) => {
    const convertedPrice = convertPrice(price, currency, CURRENCIES, baseCurrency)
    const convertedOriginal = convertPrice(originalPrice, currency, CURRENCIES, baseCurrency)
    const onSale = convertedOriginal > convertedPrice

    return {
      id,
      title: title.slice(0, 200),
      description: metaDescription(product.description, product.name),
      availability: metaAvailability(stock),
      condition: 'new',
      price: metaPrice(onSale ? convertedOriginal : convertedPrice, currency),
      link: metaProductLink(product.slug),
      image_link: imageUrl,
      brand: META_BRAND,
      sale_price: onSale ? metaPrice(convertedPrice, currency) : '',
      item_group_id: itemGroupId ?? '',
      product_type: product.category || 'Software',
      google_product_category: 'Software > Computer Software',
    }
  }

  if (activeVariants.length) {
    return activeVariants.map((variant) => {
      const variantId = String(variant._id ?? variant.id)
      const variantLabel = variant.name || variant.tierLabel || 'Standard'
      return buildRow({
        id: variant.sku || `${productId}-${variantId}`,
        title: `${product.name} — ${variantLabel}`,
        price: variant.price,
        originalPrice: variant.originalPrice ?? variant.price,
        stock: variant.stock ?? product.stock,
        imageUrl: metaImageUrl(product, variant),
        itemGroupId: productId,
      })
    })
  }

  return [
    buildRow({
      id: productId,
      title: product.name,
      price: product.price,
      originalPrice: product.originalPrice ?? product.price,
      stock: product.stock,
      imageUrl: metaImageUrl(product),
    }),
  ]
}

export function buildMetaCatalogCsv(products, variantsByProductId = new Map(), { currency = 'USD', baseCurrency = config.catalogBaseCurrency || 'USD' } = {}) {
  const headers = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
    'sale_price',
    'item_group_id',
    'product_type',
    'google_product_category',
  ]

  const rows = []
  for (const product of products) {
    if (product.active === false || product.hideCart) continue
    const variants = variantsByProductId.get(String(product._id ?? product.id)) ?? []
    rows.push(...metaRowsForProduct(product, variants, { currency, baseCurrency }))
  }

  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((key) => csvCell(row[key])).join(','))
  }
  return `${lines.join('\n')}\n`
}

export function buildGoogleShoppingFeed(products, { currency = config.catalogBaseCurrency || 'USD', country = 'US' } = {}) {
  const items = products
    .map((product) => {
      const price = convertPrice(product.price, currency, CURRENCIES, config.catalogBaseCurrency || 'USD')
      return `
    <item>
      <g:id>${product.id}</g:id>
      <g:title><![CDATA[${product.name}]]></g:title>
      <g:description><![CDATA[${product.description ?? product.name}]]></g:description>
      <g:link>${config.clientUrl}/product/${product.slug}</g:link>
      <g:image_link>${product.imageUrl ?? `${config.clientUrl}/favicon.svg`}</g:image_link>
      <g:availability>${product.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:price>${price} ${currency}</g:price>
      <g:brand>eSoftware Store</g:brand>
      <g:condition>new</g:condition>
      <g:google_product_category>Software</g:google_product_category>
    </item>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>eSoftware Store</title>
    <link>${config.clientUrl}</link>
    <description>Genuine software licenses</description>
    ${items}
  </channel>
</rss>`
}

export function buildBingShoppingFeed(products, { currency = config.catalogBaseCurrency || 'USD' } = {}) {
  return buildGoogleShoppingFeed(products, { currency })
}

export function buildYandexFeed(products, { currency = config.catalogBaseCurrency || 'USD' } = {}) {
  const offers = products
    .map((product) => {
      const price = convertPrice(product.price, currency, CURRENCIES, config.catalogBaseCurrency || 'USD')
      return `
      <offer id="${product.id}" available="${product.stock > 0}">
        <name>${product.name}</name>
        <url>${config.clientUrl}/product/${product.slug}</url>
        <price>${price}</price>
        <currencyId>${currency}</currencyId>
        <categoryId>1</categoryId>
        <picture>${product.imageUrl ?? ''}</picture>
      </offer>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${new Date().toISOString().slice(0, 10)}">
  <shop>
    <name>eSoftware Store</name>
    <url>${config.clientUrl}</url>
    <currencies><currency id="${currency}" rate="1"/></currencies>
    <offers>${offers}</offers>
  </shop>
</yml_catalog>`
}
