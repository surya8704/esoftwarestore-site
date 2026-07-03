import { loadGuides } from '../data/loadGuides.js'

export async function guideRoutes(app) {
  app.get('/api/guides', async (request) => {
    const category = request.query.category
    const q = (request.query.q ?? '').toLowerCase().trim()
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(request.query.limit ?? '12', 10) || 12))

    let guides = loadGuides().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))

    if (category) {
      const cat = category.toLowerCase()
      guides = guides.filter(
        (g) =>
          g.categorySlugs?.some((s) => s.toLowerCase() === cat) ||
          g.categories?.some((c) => c.toLowerCase().replace(/\s+/g, '-') === cat),
      )
    }

    if (q) {
      guides = guides.filter(
        (g) =>
          g.title?.toLowerCase().includes(q) ||
          g.excerpt?.toLowerCase().includes(q) ||
          g.categories?.some((c) => c.toLowerCase().includes(q)),
      )
    }

    const total = guides.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * limit
    const items = guides.slice(start, start + limit).map((g) => ({
      id: g.externalId,
      slug: g.slug,
      title: g.title,
      excerpt: g.excerpt,
      publishedAt: g.publishedAt,
      imageUrl: g.imageUrl,
      categories: g.categories ?? [],
      categorySlugs: g.categorySlugs ?? [],
      sourceUrl: g.sourceUrl,
    }))

    return {
      guides: items,
      page: safePage,
      limit,
      total,
      totalPages,
    }
  })

  app.get('/api/guides/:slug', async (request, reply) => {
    const guide = loadGuides().find((g) => g.slug === request.params.slug)
    if (!guide) return reply.notFound('Guide not found')

    const all = loadGuides()
    const related = all
      .filter((g) => g.slug !== guide.slug)
      .filter((g) => {
        const shared = g.categorySlugs?.some((s) => guide.categorySlugs?.includes(s))
        const titleMatch = g.title?.split(' ').some((word) =>
          guide.title?.toLowerCase().includes(word.toLowerCase()),
        )
        return shared || titleMatch
      })
      .slice(0, 4)
      .map((g) => ({
        slug: g.slug,
        title: g.title,
        excerpt: g.excerpt,
        imageUrl: g.imageUrl,
        publishedAt: g.publishedAt,
      }))

    return { guide, related }
  })
}
