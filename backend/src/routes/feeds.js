import { Product, ProductVariant } from '../db/models.js'
import { buildBingShoppingFeed, buildGoogleShoppingFeed, buildMetaCatalogCsv, buildYandexFeed } from '../services/feeds.js'

export async function feedRoutes(app) {
  app.get('/feeds/google-shopping.xml', async (request, reply) => {
    const currency = request.query.currency ?? 'INR'
    const catalog = await Product.find({ active: true })
    reply.type('application/xml')
    return buildGoogleShoppingFeed(catalog, { currency })
  })

  app.get('/feeds/bing-shopping.xml', async (request, reply) => {
    const currency = request.query.currency ?? 'INR'
    const catalog = await Product.find({ active: true })
    reply.type('application/xml')
    return buildBingShoppingFeed(catalog, { currency })
  })

  app.get('/feeds/yandex.xml', async (request, reply) => {
    const currency = request.query.currency ?? 'INR'
    const catalog = await Product.find({ active: true })
    reply.type('application/xml')
    return buildYandexFeed(catalog, { currency })
  })

  app.get('/feeds/meta-catalog.csv', async (request, reply) => {
    const currency = String(request.query.currency ?? 'USD').toUpperCase()
    const products = await Product.find({ active: true }).sort({ name: 1 }).lean()
    const variants = await ProductVariant.find({ active: { $ne: false } }).lean()
    const variantsByProductId = new Map()
    for (const variant of variants) {
      const key = String(variant.productId)
      if (!variantsByProductId.has(key)) variantsByProductId.set(key, [])
      variantsByProductId.get(key).push(variant)
    }
    reply.type('text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="meta-product-catalog.csv"')
    return buildMetaCatalogCsv(products, variantsByProductId, { currency })
  })

  app.get('/sitemap.xml', async (_request, reply) => {
    const catalog = await Product.find({ active: true })
    const urls = catalog
      .map(
        (p) => `
  <url>
    <loc>${process.env.CLIENT_URL ?? 'http://localhost:5173'}/product/${p.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
      )
      .join('')

    reply.type('application/xml')
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${process.env.CLIENT_URL ?? 'http://localhost:5173'}/</loc><priority>1.0</priority></url>
  ${urls}
</urlset>`
  })
}
