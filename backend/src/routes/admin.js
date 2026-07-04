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
import { sendAdminKeyDeliveryEmail } from '../services/email.js'
import { addOrderNote, getCustomerStats, loadAdminOrderDetail } from '../services/orders.js'
import { captureOrderPaymentFees, resolveOrderPaymentBreakdown, summarizePaymentBreakdowns } from '../services/paymentFees.js'
import { processOrderRefund } from '../services/refunds.js'
import { generateConfirmationCode } from '../lib/utils.js'
import { hashPassword } from '../db/seed.js'
import { normalizeProduct, productSchema, vendorStats } from './vendor.js'

const ORDER_STATUSES = ['pending', 'processing', 'completed', 'on_hold', 'cancelled', 'refunded']

async function mapOrderListRow(order) {
  const items = await OrderItem.find({ orderId: order._id })
  const mapped = mapId(order)
  const payment = resolveOrderPaymentBreakdown(order)
  return {
    ...mapped,
    orderId: mapped.id,
    orderStatus: order.orderStatus ?? (order.paymentStatus === 'paid' ? 'processing' : 'pending'),
    productName: items.map((item) => item.productName).join(', ') || '—',
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    items: items.map(mapId),
    payment,
  }
}

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

  app.get('/api/admin/orders', { preHandler: [app.requireAdmin] }, async (request) => {
    const email = request.query?.email
    const filter = { paymentStatus: 'paid' }
    if (email) filter.customerEmail = String(email).toLowerCase()
    const result = await Order.find(filter).sort({ createdAt: -1 }).limit(200)
    const orders = await Promise.all(result.map(mapOrderListRow))
    const breakdowns = orders.map((o) => o.payment)
    const summary = summarizePaymentBreakdowns(breakdowns)
    return { orders, summary: { ...summary, count: orders.length } }
  })

  app.get('/api/admin/orders/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const detail = await loadAdminOrderDetail(request.params.id)
    if (!detail) return reply.notFound('Order not found')
    return { order: detail }
  })

  app.patch('/api/admin/orders/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      orderStatus: z.enum(ORDER_STATUSES).optional(),
      customerEmail: z.string().email().optional(),
      customerPhone: z.string().max(40).optional(),
    })
    const payload = schema.parse(request.body)
    const order = await Order.findById(request.params.id)
    if (!order) return reply.notFound('Order not found')

    const previousStatus = order.orderStatus ?? 'pending'
    if (payload.orderStatus) order.orderStatus = payload.orderStatus
    if (payload.customerEmail) order.customerEmail = payload.customerEmail
    if (payload.customerPhone !== undefined) order.customerPhone = payload.customerPhone
    await order.save()

    if (payload.orderStatus && payload.orderStatus !== previousStatus) {
      await addOrderNote({
        orderId: order._id,
        authorId: request.user.sub,
        authorName: request.user.email ?? 'Admin',
        content: `Order status changed from ${previousStatus} to ${payload.orderStatus}.`,
        noteType: 'private',
      })
    }

    const detail = await loadAdminOrderDetail(order._id)
    return { order: detail }
  })

  app.post('/api/admin/orders/:id/notes', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      content: z.string().min(1).max(2000),
      noteType: z.enum(['private', 'customer']).default('private'),
    })
    const payload = schema.parse(request.body)
    const order = await Order.findById(request.params.id)
    if (!order) return reply.notFound('Order not found')

    const note = await addOrderNote({
      orderId: order._id,
      authorId: request.user.sub,
      authorName: request.user.email ?? 'Admin',
      content: payload.content,
      noteType: payload.noteType,
    })

    return { note }
  })

  app.patch('/api/admin/orders/:id/items/:itemId', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const attachmentSchema = z.object({
      type: z.enum(['link', 'image', 'video', 'file']),
      url: z.string().max(500).optional(),
      label: z.string().max(120).optional(),
      filename: z.string().max(120).optional(),
    })
    const schema = z.object({
      licenseKey: z.string().min(1).max(200).optional(),
      downloadUrl: z.string().max(500).optional(),
      deliveryDescription: z.string().max(2000).optional(),
      deliveryAttachments: z.array(attachmentSchema).max(10).optional(),
    })
    const payload = schema.parse(request.body)
    const item = await OrderItem.findOne({ _id: request.params.itemId, orderId: request.params.id })
    if (!item) return reply.notFound('Order item not found')

    if (payload.licenseKey !== undefined) item.licenseKey = payload.licenseKey.trim()
    if (payload.deliveryDescription !== undefined) item.deliveryDescription = payload.deliveryDescription.trim()
    if (payload.deliveryAttachments !== undefined) {
      item.deliveryAttachments = payload.deliveryAttachments
        .filter((a) => a.url?.trim() || a.filename)
        .map((a) => ({
          type: a.type,
          url: a.url?.trim() || undefined,
          label: a.label?.trim() || undefined,
          filename: a.filename?.trim() || undefined,
        }))
      const firstLink = item.deliveryAttachments.find((a) => a.type === 'link' && a.url)
      item.downloadUrl = firstLink?.url || payload.downloadUrl?.trim() || undefined
    } else if (payload.downloadUrl !== undefined) {
      item.downloadUrl = payload.downloadUrl.trim() || undefined
    }
    await item.save()

    const order = await Order.findById(request.params.id)
    if (order && payload.licenseKey && !order.licenseKey) {
      order.licenseKey = payload.licenseKey.trim()
      await order.save()
    }

    if (payload.licenseKey) {
      await addOrderNote({
        orderId: order._id,
        authorId: request.user.sub,
        authorName: request.user.email ?? 'Admin',
        content: `License key saved for ${item.productName}: ${payload.licenseKey.trim()}`,
        noteType: 'private',
      })
    }

    const detail = await loadAdminOrderDetail(order._id)
    return { order: detail }
  })

  app.post('/api/admin/orders/:id/send-keys', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const attachmentSchema = z.object({
      type: z.enum(['link', 'image', 'video', 'file']),
      url: z.string().max(500).optional(),
      label: z.string().max(120).optional(),
      filename: z.string().max(120).optional(),
      content: z.string().max(14000000).optional(),
      contentType: z.string().max(100).optional(),
    })
    const itemDetailSchema = z.object({
      licenseKey: z.string().min(1).max(200),
      deliveryDescription: z.string().max(2000).optional(),
      deliveryAttachments: z.array(attachmentSchema).max(10).optional(),
      downloadUrl: z.string().max(500).optional(),
    })
    const schema = z.object({
      message: z.string().max(5000).optional(),
      markCompleted: z.boolean().default(true),
      itemDetails: z.record(z.string(), itemDetailSchema).optional(),
    })
    const payload = schema.parse(request.body ?? {})
    const order = await Order.findById(request.params.id)
    if (!order) return reply.notFound('Order not found')

    if (payload.itemDetails) {
      for (const [itemId, detail] of Object.entries(payload.itemDetails)) {
        const item = await OrderItem.findOne({ _id: itemId, orderId: order._id })
        if (!item) continue
        item.licenseKey = detail.licenseKey.trim()
        if (detail.deliveryDescription !== undefined) {
          item.deliveryDescription = detail.deliveryDescription.trim()
        }
        const savedAttachments = (detail.deliveryAttachments ?? [])
          .filter((a) => a.url?.trim() || a.filename)
          .map((a) => ({
            type: a.type,
            url: a.url?.trim() || undefined,
            label: a.label?.trim() || undefined,
            filename: a.filename?.trim() || undefined,
          }))
        item.deliveryAttachments = savedAttachments
        const firstLink = savedAttachments.find((a) => a.type === 'link' && a.url)
        item.downloadUrl = firstLink?.url || detail.downloadUrl?.trim() || undefined
        await item.save()
      }
    }

    const allItems = await OrderItem.find({ orderId: order._id })
    const products = await Product.find({ _id: { $in: allItems.map((i) => i.productId) } })
    const productMap = new Map(products.map((p) => [p._id.toString(), p]))

    const requestDetails = payload.itemDetails ?? {}
    const deliveredItems = []
    for (const item of allItems) {
      const key = item.licenseKey?.trim()
      if (!key) continue
      const product = productMap.get(item.productId?.toString?.())
      const detail = requestDetails[item._id.toString()]
      deliveredItems.push({
        ...mapId(item),
        licenseKey: key,
        deliveryDescription: item.deliveryDescription ?? '',
        deliveryAttachments: detail?.deliveryAttachments ?? item.deliveryAttachments ?? [],
        downloadUrl: item.downloadUrl || product?.downloadUrl || null,
      })
    }

    if (!deliveredItems.length) {
      throw app.httpErrors.badRequest('Enter activation key(s) manually for each product before sending.')
    }

    const primaryKey = deliveredItems[0]?.licenseKey ?? order.licenseKey
    if (primaryKey) order.licenseKey = primaryKey

    let emailResult
    try {
      emailResult = await sendAdminKeyDeliveryEmail({
        order: mapId(order),
        items: deliveredItems,
        confirmationCode: order.confirmationCode,
        customMessage: payload.message,
      })
    } catch (err) {
      throw app.httpErrors.badRequest(err.message ?? 'Failed to send email')
    }

    const sentAt = new Date()
    for (const delivered of deliveredItems) {
      await OrderItem.findByIdAndUpdate(delivered.id, { keySentAt: sentAt })
    }

    order.emailSent = emailResult.status === 'sent'
    if (payload.markCompleted) order.orderStatus = 'completed'
    await order.save()

    const keySummary = deliveredItems
      .map((i) => {
        const lines = [`${i.productName} activation code: ${i.licenseKey}`]
        if (i.deliveryDescription) lines.push(`Description: ${i.deliveryDescription}`)
        for (const att of i.deliveryAttachments ?? []) {
          if (att.url) lines.push(`${att.label || att.type}: ${att.url}`)
        }
        return lines.join('\n')
      })
      .join('\n\n')

    await addOrderNote({
      orderId: order._id,
      authorId: request.user.sub,
      authorName: request.user.email ?? 'Admin',
      content: `Product key(s) manually emailed to ${order.customerEmail}.\n\n${keySummary}`,
      noteType: 'customer',
    })

    const detail = await loadAdminOrderDetail(order._id)
    return { success: true, email: emailResult, order: detail }
  })

  app.post('/api/admin/orders/:id/refund', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      amount: z.number().positive().optional(),
      reason: z.string().max(500).optional(),
    })
    const payload = schema.parse(request.body ?? {})
    const order = await Order.findById(request.params.id)
    if (!order) return reply.notFound('Order not found')

    if (order.paymentStatus !== 'paid') {
      throw app.httpErrors.badRequest('Only paid orders can be refunded')
    }

    const result = await processOrderRefund(order, payload)

    order.paymentStatus = 'refunded'
    order.orderStatus = 'refunded'
    order.refundAmount = result.amount
    order.refundId = result.refundId
    order.refundReason = payload.reason ?? ''
    order.refundedAt = new Date()
    await order.save()

    await addOrderNote({
      orderId: order._id,
      authorId: request.user.sub,
      authorName: request.user.email ?? 'Admin',
      content: `Refund of ${result.amount} processed via ${result.gateway}. Ref ID: ${result.refundId}${payload.reason ? `. Reason: ${payload.reason}` : ''}`,
      noteType: 'private',
    })

    const detail = await loadAdminOrderDetail(order._id)
    return { success: true, refund: result, order: detail }
  })

  app.get('/api/admin/customers/:email', { preHandler: [app.requireAdmin] }, async (request) => {
    const email = decodeURIComponent(request.params.email)
    const stats = await getCustomerStats(email)
    const orders = await Order.find({ customerEmail: email }).sort({ createdAt: -1 }).limit(50)
    const orderRows = await Promise.all(orders.map(mapOrderListRow))
    return { email, stats, orders: orderRows }
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
