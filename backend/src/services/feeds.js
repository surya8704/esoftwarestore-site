import { config, CURRENCIES } from '../config.js'
import { convertPrice } from '../lib/utils.js'

export function buildGoogleShoppingFeed(products, { currency = 'INR', country = 'IN' } = {}) {
  const items = products
    .map((product) => {
      const price = convertPrice(product.price, currency, CURRENCIES)
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

export function buildBingShoppingFeed(products, { currency = 'INR' } = {}) {
  return buildGoogleShoppingFeed(products, { currency })
}

export function buildYandexFeed(products, { currency = 'INR' } = {}) {
  const offers = products
    .map((product) => {
      const price = convertPrice(product.price, currency, CURRENCIES)
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
