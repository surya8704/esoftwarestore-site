import { z } from 'zod'
import { Product, ProductReview } from '../db/models.js'
import { getReviewMarketingTemplates, mapStoredReview } from '../lib/productReviews.js'

const LOCALES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ar']

const reviewBodySchema = z.object({
  productId: z.string().min(1),
  author: z.string().trim().min(2).max(120),
  locale: z.enum(LOCALES).default('en'),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(160),
  text: z.string().trim().min(10).max(2000),
  verified: z.boolean().optional().default(true),
  helpful: z.coerce.number().int().min(0).max(9999).optional().default(12),
  active: z.boolean().optional().default(true),
  createdAt: z.union([z.string(), z.date(), z.null()]).optional(),
})

function mapAdminReview(doc, product = null) {
  const mapped = mapStoredReview(doc)
  return {
    ...mapped,
    productId: String(doc.productId?._id ?? doc.productId),
    productName: product?.name ?? doc.productId?.name ?? null,
    productSlug: product?.slug ?? doc.productId?.slug ?? null,
    active: doc.active !== false,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  }
}

function parseCreatedAt(value) {
  if (!value) return new Date()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export async function reviewRoutes(app) {
  app.get('/api/admin/reviews/templates', { preHandler: [app.requireAdmin] }, async () => {
    return getReviewMarketingTemplates()
  })

  app.get('/api/admin/reviews', { preHandler: [app.requireAdmin] }, async (request) => {
    const productId = request.query?.productId
    const filter = {}
    if (productId) filter.productId = productId

    const items = await ProductReview.find(filter)
      .sort({ createdAt: -1 })
      .limit(300)
      .populate('productId', 'name slug')
      .lean()

    return {
      reviews: items.map((row) => mapAdminReview(row, row.productId)),
    }
  })

  app.post('/api/admin/reviews', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const payload = reviewBodySchema.parse(request.body ?? {})
    const product = await Product.findById(payload.productId)
    if (!product) throw app.httpErrors.notFound('Product not found')

    const review = await ProductReview.create({
      productId: product._id,
      author: payload.author,
      locale: payload.locale,
      rating: payload.rating,
      title: payload.title,
      text: payload.text,
      verified: payload.verified !== false,
      helpful: payload.helpful ?? 12,
      active: payload.active !== false,
      createdAt: parseCreatedAt(payload.createdAt),
      updatedAt: new Date(),
    })

    return reply.code(201).send({ review: mapAdminReview(review, product) })
  })

  app.put('/api/admin/reviews/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const payload = reviewBodySchema.parse(request.body ?? {})
    const review = await ProductReview.findById(request.params.id)
    if (!review) return reply.code(404).send({ message: 'Review not found' })

    const product = await Product.findById(payload.productId)
    if (!product) throw app.httpErrors.notFound('Product not found')

    review.productId = product._id
    review.author = payload.author
    review.locale = payload.locale
    review.rating = payload.rating
    review.title = payload.title
    review.text = payload.text
    review.verified = payload.verified !== false
    review.helpful = payload.helpful ?? 12
    review.active = payload.active !== false
    if (payload.createdAt !== undefined && payload.createdAt !== null) {
      review.createdAt = parseCreatedAt(payload.createdAt)
    }
    review.updatedAt = new Date()
    await review.save()

    return { review: mapAdminReview(review, product) }
  })

  app.patch('/api/admin/reviews/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      active: z.boolean().optional(),
      verified: z.boolean().optional(),
      helpful: z.coerce.number().int().min(0).max(9999).optional(),
    })
    const payload = schema.parse(request.body ?? {})
    const review = await ProductReview.findById(request.params.id)
    if (!review) return reply.code(404).send({ message: 'Review not found' })

    if (payload.active !== undefined) review.active = payload.active
    if (payload.verified !== undefined) review.verified = payload.verified
    if (payload.helpful !== undefined) review.helpful = payload.helpful
    review.updatedAt = new Date()
    await review.save()

    const product = await Product.findById(review.productId)
    return { review: mapAdminReview(review, product) }
  })

  app.delete('/api/admin/reviews/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const review = await ProductReview.findByIdAndDelete(request.params.id)
    if (!review) return reply.code(404).send({ message: 'Review not found' })
    return { success: true, id: request.params.id }
  })
}
