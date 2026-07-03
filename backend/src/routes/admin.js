import { z } from 'zod'
import { mapId } from '../db/client.js'
import {
  ConfirmationCode,
  Order,
  OrderItem,
  Product,
  SupportVideo,
  User,
  Vendor,
  VendorPayout,
} from '../db/models.js'
import { getAiSupportReply, getTelephonicActivationScript } from '../services/ai.js'
import { generateConfirmationCode } from '../lib/utils.js'
import { hashPassword } from '../db/seed.js'
import { normalizeProduct, productSchema, vendorStats } from './vendor.js'

export async function adminRoutes(app) {
  app.get('/api/admin/overview', { preHandler: [app.requireAdmin] }, async () => {
    const [
      productCount,
      orderCount,
      paidOrderCount,
      pendingOrderCount,
      userCount,
      vendorCount,
      revenueResult,
      pendingPayouts,
      paidPayouts,
    ] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ paymentStatus: 'paid' }),
      Order.countDocuments({ paymentStatus: { $nin: ['paid', 'refunded', 'cancelled'] } }),
      User.countDocuments(),
      Vendor.countDocuments(),
      Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, revenue: { $sum: '$total' } } }]),
      VendorPayout.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      VendorPayout.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ])

    return {
      totalProducts: productCount,
      totalOrders: orderCount,
      paidOrders: paidOrderCount,
      pendingOrders: pendingOrderCount,
      totalUsers: userCount,
      totalVendors: vendorCount,
      revenue: Number(revenueResult[0]?.revenue ?? 0),
      pendingVendorPayouts: Number(pendingPayouts[0]?.total ?? 0),
      paidVendorPayouts: Number(paidPayouts[0]?.total ?? 0),
    }
  })

  app.get('/api/admin/vendors', { preHandler: [app.requireAdmin] }, async () => {
    const list = await Vendor.find().sort({ createdAt: -1 })
    const enriched = await Promise.all(
      list.map(async (vendor) => {
        const stats = await vendorStats(vendor._id.toString())
        return { ...mapId(vendor), stats }
      }),
    )
    return { vendors: enriched }
  })

  app.get('/api/admin/vendors/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const stats = await vendorStats(request.params.id)
    if (!stats) return reply.notFound('Vendor not found')
    const vendorProducts = await Product.find({ vendorId: request.params.id }).sort({ createdAt: -1 })
    const payouts = await VendorPayout.find({ vendorId: request.params.id }).sort({ createdAt: -1 })
    return {
      ...stats,
      products: vendorProducts.map(normalizeProduct),
      payouts: payouts.map(mapId),
    }
  })

  app.post('/api/admin/vendors', { preHandler: [app.requireAdmin] }, async (request) => {
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      email: z.string().email(),
      commissionRate: z.number().int().min(0).max(50).default(15),
      password: z.string().min(6).optional(),
    })
    const payload = schema.parse(request.body)
    const existing = await Vendor.findOne({ slug: payload.slug })
    if (existing) throw app.httpErrors.conflict('Slug already exists')

    let userId = null
    if (payload.password) {
      const user = await User.create({
        name: payload.name,
        email: payload.email,
        passwordHash: hashPassword(payload.password),
        role: 'vendor',
      })
      userId = user._id
    }

    const vendor = await Vendor.create({
      userId,
      name: payload.name,
      slug: payload.slug,
      email: payload.email,
      commissionRate: payload.commissionRate,
    })

    return { vendor: mapId(vendor) }
  })

  app.put('/api/admin/vendors/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      email: z.string().email(),
      commissionRate: z.number().int().min(0).max(50),
      active: z.boolean(),
    })
    const payload = schema.parse(request.body)
    const vendor = await Vendor.findByIdAndUpdate(
      request.params.id,
      {
        name: payload.name,
        slug: payload.slug,
        email: payload.email,
        commissionRate: payload.commissionRate,
        active: payload.active,
      },
      { new: true },
    )
    if (!vendor) return reply.notFound('Vendor not found')
    return { vendor: mapId(vendor) }
  })

  app.patch('/api/admin/vendors/:id/payouts/:payoutId', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({ status: z.enum(['paid', 'rejected']) })
    const { status } = schema.parse(request.body)
    const payout = await VendorPayout.findByIdAndUpdate(
      request.params.payoutId,
      { status, paidAt: status === 'paid' ? new Date() : null },
      { new: true },
    )
    if (!payout) return reply.notFound('Payout not found')
    return { success: true }
  })

  app.get('/api/admin/payouts', { preHandler: [app.requireAdmin] }, async () => {
    const payouts = await VendorPayout.find().sort({ createdAt: -1 }).populate('vendorId', 'name')
    return {
      payouts: payouts.map((p) => ({
        id: p._id.toString(),
        amount: p.amount,
        status: p.status,
        reference: p.reference,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        vendorName: p.vendorId?.name,
        vendorId: p.vendorId?._id?.toString?.() ?? p.vendorId,
      })),
    }
  })

  app.get('/api/admin/products', { preHandler: [app.requireAdmin] }, async () => {
    const result = await Product.find().sort({ createdAt: -1 }).populate('vendorId', 'name')
    return {
      products: result.map((row) => ({
        ...normalizeProduct(row),
        vendorId: row.vendorId?._id?.toString?.() ?? row.vendorId,
        vendorName: row.vendorId?.name,
      })),
    }
  })

  app.post('/api/admin/products', { preHandler: [app.requireAdmin] }, async (request) => {
    const payload = productSchema.parse(request.body)
    const existing = await Product.findOne({ slug: payload.slug })
    if (existing) throw app.httpErrors.conflict('Slug already exists')

    const product = await Product.create({
      vendorId: payload.vendorId ?? null,
      name: payload.name,
      slug: payload.slug,
      category: payload.category,
      price: payload.price,
      originalPrice: payload.originalPrice,
      rating: Math.round(payload.rating * 10),
      stock: payload.stock,
      licenseType: payload.licenseType,
      imageUrl: payload.imageUrl || null,
      visualAccent: payload.visualAccent,
      description: payload.description,
      hidePrice: payload.hidePrice ?? false,
      hideCart: payload.hideCart ?? false,
    })

    return { product: normalizeProduct(product) }
  })

  app.put('/api/admin/products/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const payload = productSchema.parse(request.body)
    const product = await Product.findByIdAndUpdate(
      request.params.id,
      {
        name: payload.name,
        slug: payload.slug,
        category: payload.category,
        price: payload.price,
        originalPrice: payload.originalPrice,
        rating: Math.round(payload.rating * 10),
        stock: payload.stock,
        licenseType: payload.licenseType,
        imageUrl: payload.imageUrl || null,
        visualAccent: payload.visualAccent,
        description: payload.description,
        hidePrice: payload.hidePrice ?? false,
        hideCart: payload.hideCart ?? false,
        vendorId: payload.vendorId ?? null,
      },
      { new: true },
    )
    if (!product) return reply.notFound('Product not found')
    return { product: normalizeProduct(product) }
  })

  app.delete('/api/admin/products/:id', { preHandler: [app.requireAdmin] }, async (request) => {
    await Product.findByIdAndDelete(request.params.id)
    return { success: true }
  })

  app.get('/api/admin/orders', { preHandler: [app.requireAdmin] }, async () => {
    const result = await Order.find().sort({ createdAt: -1 }).limit(200)
    const orders = await Promise.all(
      result.map(async (order) => {
        const items = await OrderItem.find({ orderId: order._id })
        const mapped = mapId(order)
        return {
          ...mapped,
          orderId: mapped.id,
          productName: items.map((item) => item.productName).join(', ') || '—',
          quantity: items.reduce((sum, item) => sum + item.quantity, 0),
          items: items.map(mapId),
        }
      }),
    )
    return { orders }
  })
}

export async function supportRoutes(app) {
  app.post('/api/support/chat', async (request) => {
    const schema = z.object({
      message: z.string().min(1),
      history: z
        .array(z.object({ role: z.enum(['user', 'bot']), text: z.string() }))
        .optional(),
    })
    const { message, history } = schema.parse(request.body)
    const reply = await getAiSupportReply(message, history ?? [])
    return { reply }
  })

  app.get('/api/support/videos', async () => {
    const videos = await SupportVideo.find({ active: true })
    return { videos: videos.map(mapId) }
  })

  app.get('/api/support/telephonic/:orderId', async (request) => {
    return getTelephonicActivationScript(request.params.orderId)
  })

  app.post('/api/support/confirmation-code', async (request) => {
    const schema = z.object({ orderId: z.string() })
    const { orderId } = schema.parse(request.body)
    const code = generateConfirmationCode()
    await ConfirmationCode.create({ orderId, code, type: 'activation' })
    return { code }
  })
}
