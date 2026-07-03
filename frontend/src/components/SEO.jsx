import { useEffect } from 'react'

export default function SEO({ title, description, path = '/', product }) {
  const site = 'eSoftware Store'
  const fullTitle = title ? `${title} | ${site}` : `${site} — Genuine Software Licenses`
  const desc = description ?? 'Buy genuine software licenses with instant digital delivery, secure checkout, and 24/7 support.'

  useEffect(() => {
    document.title = fullTitle
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = desc

    let ld = document.getElementById('json-ld')
    if (!ld) {
      ld = document.createElement('script')
      ld.id = 'json-ld'
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
          offers: {
            '@type': 'Offer',
            price: product.displayPrice ?? product.price,
            priceCurrency: product.currency ?? 'INR',
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: site,
          url: window.location.origin,
          logo: `${window.location.origin}/logo.svg`,
        }

    ld.textContent = JSON.stringify(jsonLd)
  }, [fullTitle, desc, product, path])

  return null
}
