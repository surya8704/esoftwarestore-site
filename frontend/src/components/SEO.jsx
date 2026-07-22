import { useEffect } from 'react'

const SITE_NAME = 'eSoftware Store'
const SITE_URL = 'https://www.esoftwarestore.com'

function upsertMeta(selector, attrs) {
  let el = document.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  Object.entries(attrs).forEach(([key, value]) => {
    if (value != null) el.setAttribute(key, value)
  })
  return el
}

function upsertLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
  return el
}

export default function SEO({ title, description, path = '/', product }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Genuine Software Licenses`
  const desc =
    description ??
    'Buy genuine software licenses with instant digital delivery, secure checkout, and 24/7 support.'
  const canonicalPath = path.startsWith('/') ? path : `/${path}`
  const canonicalUrl = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`

  useEffect(() => {
    document.title = fullTitle

    upsertMeta('meta[name="description"]', { name: 'description', content: desc })
    upsertMeta('meta[name="application-name"]', { name: 'application-name', content: SITE_NAME })
    upsertMeta('meta[name="apple-mobile-web-app-title"]', {
      name: 'apple-mobile-web-app-title',
      content: SITE_NAME,
    })

    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: product ? 'product' : 'website',
    })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: desc })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl })
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: product?.imageUrl || `${SITE_URL}/logo.svg`,
    })

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' })
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle })
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: desc })

    upsertLink('canonical', canonicalUrl)

    let ld = document.getElementById('json-ld-page')
    if (!ld) {
      ld = document.createElement('script')
      ld.id = 'json-ld-page'
      ld.type = 'application/ld+json'
      document.head.appendChild(ld)
    }

    const jsonLd = product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image: product.imageUrl,
          brand: { '@type': 'Brand', name: SITE_NAME },
          offers: {
            '@type': 'Offer',
            price: product.displayPrice ?? product.price,
            priceCurrency: product.currency ?? 'USD',
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: canonicalUrl,
          },
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: fullTitle,
          description: desc,
          url: canonicalUrl,
          isPartOf: {
            '@type': 'WebSite',
            name: SITE_NAME,
            url: SITE_URL,
          },
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
          },
        }

    ld.textContent = JSON.stringify(jsonLd)
  }, [fullTitle, desc, product, canonicalUrl])

  return null
}
