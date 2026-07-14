import { getPublicSitePage, LEGAL_PAGE_KEYS } from '../lib/siteContent.js'

export async function pageRoutes(app) {
  app.get('/api/pages/:key', async (request, reply) => {
    const key = request.params.key
    if (!LEGAL_PAGE_KEYS.includes(key)) {
      return reply.code(404).send({ message: 'Page not found' })
    }
    const page = await getPublicSitePage(key)
    if (!page) return reply.code(404).send({ message: 'Page not found' })
    return { page }
  })
}
