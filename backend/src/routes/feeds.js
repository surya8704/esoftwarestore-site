import { Product } from '../db/models.js'
import { buildBingShoppingFeed, buildGoogleShoppingFeed, buildYandexFeed } from '../services/feeds.js'

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
