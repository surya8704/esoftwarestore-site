import { z } from 'zod'
import { mapId } from '../db/client.js'
import { OrderItem, Product, Vendor, VendorPayout } from '../db/models.js'
import { parseJsonList } from '../lib/utils.js'
import { resolveStoreProductImage } from '../lib/productImages.js'
import { validateAndNormalizeBundleItems } from '../lib/bundles.js'
import { config } from '../config.js'
import { normalizeVendorPermissions, vendorHasPermission } from '../lib/vendorPermissions.js'

const countryCodeList = z.array(z.string().trim().toUpperCase().length(2)).optional().default([])

const bundleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
})

const productSchema = z
  .object({
    name: z.string().min(2),
    slug: z.string().min(2),
    category: z.string().min(2),
    productType: z.enum(['standard', 'bundle']).default('standard'),
    bundleItems: z.array(bundleItemSchema).optional().default([]),
    price: z.coerce.number().int().min(1),
    originalPrice: z.coerce.number().int().min(1),
    rating: z.coerce.number().min(1).max(5),
    stock: z.coerce.number().int().min(0),
    licenseType: z.string().min(2),
    imageUrl: z.string().url().or(z.literal('')).optional(),
    visualAccent: z.string().min(3).default('from-sky-500 to-cyan-400'),
    description: z.string().max(1000).optional().default(''),
    hidePrice: z.boolean().optional(),
    hideCart: z.boolean().optional(),
    vendorId: z.string().optional(),
    allowedCountries: countryCodeList,
    blockedCountries: countryCodeList,
  })
  .superRefine((data, ctx) => {
    if (data.productType === 'bundle' && (data.bundleItems?.length ?? 0) < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['bundleItems'],
        message: 'Bundles must include at least 2 products',
      })
    }
  })

function encodeCountryList(list) {
  if (!list?.length) return null
  return JSON.stringify(list.map((code) => String(code).toUpperCase()))
}

const normalizeProduct = (product) => {
  const p = mapId(product)
  const productType = p.productType === 'bundle' ? 'bundle' : 'standard'
  return {
    ...p,
    productType,
    isBundle: productType === 'bundle',
    bundleItems: (p.bundleItems ?? []).map((item) => ({
      productId: String(item.productId?._id ?? item.productId ?? ''),
      quantity: Number(item.quantity) || 1,
    })),
    rating: Number(p.rating) / 10,
    price: Number(p.price),
    originalPrice: Number(p.originalPrice),
    stock: Number(p.stock),
    vendorId: p.vendorId?.toString?.() ?? p.vendorId,
    allowedCountries: parseJsonList(p.allowedCountries) ?? [],
    blockedCountries: parseJsonList(p.blockedCountries) ?? [],
    imageUrl: resolveStoreProductImage(p, config.apiPublicUrl),
  }
}

function productWriteFields(payload) {
  const productType = payload.productType === 'bundle' ? 'bundle' : 'standard'
  return {
    name: payload.name,
    slug: payload.slug,
    category: payload.category,
    productType,
    bundleItems:
      productType === 'bundle'
        ? (payload.bundleItems ?? []).map((item) => ({
            productId: item.productId,
            quantity: Math.max(1, Number(item.quantity) || 1),
          }))
        : [],
    price: payload.price,
    originalPrice: payload.originalPrice,
    rating: Math.round(payload.rating * 10),
    stock: payload.stock,
    licenseType: productType === 'bundle' ? payload.licenseType || 'Bundle deal' : payload.licenseType,
    imageUrl: payload.imageUrl || null,
    visualAccent: payload.visualAccent,
    description: payload.description,
    hidePrice: payload.hidePrice ?? false,
    hideCart: payload.hideCart ?? false,
    allowedCountries: encodeCountryList(payload.allowedCountries),
    blockedCountries: encodeCountryList(payload.blockedCountries),
  }
}

/** Parse body + validate bundle children exist. */
async function prepareProductPayload(body, { excludeProductId } = {}) {
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues?.[0]
    throw new Error(first?.message || 'Invalid product data')
  }
  const payload = parsed.data
  if (payload.productType === 'bundle') {
    payload.bundleItems = await validateAndNormalizeBundleItems(payload.bundleItems, {
      excludeProductId,
    })
  } else {
    payload.bundleItems = []
  }
  return payload
}

function mapVendorPublic(vendor) {
  const base = mapId(vendor)
  return {
    ...base,
    permissions: normalizeVendorPermissions(vendor.permissions),
  }
}

function denyUnless(app, request, permissionKey) {
  if (request.user.role === 'admin') return
  if (!vendorHasPermission(request.vendorContext?.permissions, permissionKey)) {
    throw app.httpErrors.forbidden(`You do not have permission: ${permissionKey}`)
  }
}

async function vendorStats(vendorId) {
  const vendor = await Vendor.findById(vendorId)
  if (!vendor) return null

  const productCount = await Product.countDocuments({ vendorId })
  const productIds = (await Product.find({ vendorId }).select('_id')).map((p) => p._id)
  const permissions = normalizeVendorPermissions(vendor.permissions)

  if (productIds.length === 0) {
    return {
      vendor: mapVendorPublic(vendor),
      permissions,
      productCount: 0,
      orderCount: 0,
      grossRevenue: 0,
      vendorEarnings: 0,
      pendingPayout: 0,
      paidOut: 0,
      availableBalance: 0,
    }
  }

  const lineStats = await OrderItem.aggregate([
    { $match: { productId: { $in: productIds } } },
    { $lookup: { from: 'orders', localField: 'orderId', foreignField: '_id', as: 'order' } },
    { $unwind: '$order' },
    { $match: { 'order.paymentStatus': 'paid' } },
    {
      $group: {
        _id: null,
        orderIds: { $addToSet: '$orderId' },
        grossRevenue: { $sum: { $multiply: ['$unitPrice', '$quantity'] } },
      },
    },
    { $project: { orderCount: { $size: '$orderIds' }, grossRevenue: 1 } },
  ])

  const grossRevenue = Number(lineStats[0]?.grossRevenue ?? 0)
  const orderCount = Number(lineStats[0]?.orderCount ?? 0)
  const vendorShare = Math.round((grossRevenue * (100 - vendor.commissionRate)) / 100)

  const [paidResult, pendingResult] = await Promise.all([
    VendorPayout.aggregate([
      { $match: { vendorId: vendor._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    VendorPayout.aggregate([
      { $match: { vendorId: vendor._id, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ])

  const paidOut = Number(paidResult[0]?.total ?? 0)
  const pendingPayout = Number(pendingResult[0]?.total ?? 0)

  return {
    vendor: mapVendorPublic(vendor),
    permissions,
    productCount,
    orderCount,
    grossRevenue,
    vendorEarnings: vendorShare,
    pendingPayout,
    paidOut,
    availableBalance: Math.max(vendorShare - paidOut - pendingPayout, 0),
  }
}

export async function vendorRoutes(app) {
  app.get('/api/vendor/me', { preHandler: [app.requireVendor] }, async (request, reply) => {
    const vendorId = await app.resolveVendorId(request, reply)
    if (!vendorId) return
    const stats = await vendorStats(vendorId)
    if (!stats) throw app.httpErrors.notFound('Vendor not found')
    return stats
  })

  app.get('/api/vendor/products', { preHandler: [app.requireVendor] }, async (request, reply) => {
    const vendorId = await app.resolveVendorId(request, reply)
    if (!vendorId) return
    denyUnless(app, request, 'canManageProducts')
    const result = await Product.find({ vendorId }).sort({ createdAt: -1 })
    return { products: result.map(normalizeProduct) }
  })

  app.post('/api/vendor/products', { preHandler: [app.requireVendor] }, async (request, reply) => {
    const vendorId = await app.resolveVendorId(request, reply)
    if (!vendorId) return
    denyUnless(app, request, 'canManageProducts')
    denyUnless(app, request, 'canEditPrices')

    let payload
    try {
      payload = await prepareProductPayload(request.body)
    } catch (err) {
      throw app.httpErrors.badRequest(err.message || 'Invalid product')
    }
    const existing = await Product.findOne({ slug: payload.slug })
    if (existing) throw app.httpErrors.conflict('Slug already exists')

    const product = await Product.create({
      vendorId,
      ...productWriteFields(payload),
    })

    return { product: normalizeProduct(product) }
  })

  app.put('/api/vendor/products/:id', { preHandler: [app.requireVendor] }, async (request, reply) => {
    const vendorId = await app.resolveVendorId(request, reply)
    if (!vendorId) return
    denyUnless(app, request, 'canManageProducts')

    const existing = await Product.findById(request.params.id)
    if (!existing || existing.vendorId?.toString() !== vendorId) {
      throw app.httpErrors.notFound('Product not found')
    }

    let payload
    try {
      payload = await prepareProductPayload(request.body, { excludeProductId: existing._id })
    } catch (err) {
      throw app.httpErrors.badRequest(err.message || 'Invalid product')
    }
    const fields = productWriteFields(payload)

    if (!vendorHasPermission(request.vendorContext?.permissions, 'canEditPrices') && request.user.role !== 'admin') {
      fields.price = existing.price
      fields.originalPrice = existing.originalPrice
    }

    const product = await Product.findByIdAndUpdate(request.params.id, fields, { new: true })
    return { product: normalizeProduct(product) }
  })

  app.delete('/api/vendor/products/:id', { preHandler: [app.requireVendor] }, async (request, reply) => {
    const vendorId = await app.resolveVendorId(request, reply)
    if (!vendorId) return
    denyUnless(app, request, 'canManageProducts')

    const existing = await Product.findById(request.params.id)
    if (!existing || existing.vendorId?.toString() !== vendorId) {
      throw app.httpErrors.notFound('Product not found')
    }
    await Product.findByIdAndDelete(request.params.id)
    return { success: true }
  })

  app.get('/api/vendor/orders', { preHandler: [app.requireVendor] }, async (request, reply) => {
    const vendorId = await app.resolveVendorId(request, reply)
    if (!vendorId) return
    denyUnless(app, request, 'canViewOrders')

    const canSeeKeys =
      request.user.role === 'admin' ||
      vendorHasPermission(request.vendorContext?.permissions, 'canViewLicenseKeys')

    const productIds = (await Product.find({ vendorId }).select('_id')).map((p) => p._id)
    if (!productIds.length) return { orders: [] }

    const items = await OrderItem.find({ productId: { $in: productIds } })
      .populate({ path: 'orderId', select: 'customerEmail paymentStatus orderStatus total createdAt currency' })

    const orders = items
      .map((item) => ({
        id: item._id.toString(),
        orderId: item.orderId?._id?.toString?.() ?? item.orderId,
        customerEmail: item.orderId?.customerEmail,
        paymentStatus: item.orderId?.paymentStatus,
        orderStatus:
          item.orderId?.orderStatus ??
          (item.orderId?.paymentStatus === 'paid' ? 'processing' : 'pending'),
        total: item.orderId?.total,
        currency: item.orderId?.currency,
        createdAt: item.orderId?.createdAt,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        licenseKey: canSeeKeys ? item.licenseKey : null,
      }))
      .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))

    return { orders }
  })

  app.get('/api/vendor/payouts', { preHandler: [app.requireVendor] }, async (request, reply) => {
    const vendorId = await app.resolveVendorId(request, reply)
    if (!vendorId) return
    denyUnless(app, request, 'canManagePayouts')
    const payouts = await VendorPayout.find({ vendorId }).sort({ createdAt: -1 })
    return { payouts: payouts.map(mapId) }
  })

  app.post('/api/vendor/payouts/request', { preHandler: [app.requireVendor] }, async (request, reply) => {
    const vendorId = await app.resolveVendorId(request, reply)
    if (!vendorId) return
    denyUnless(app, request, 'canManagePayouts')

    const schema = z.object({ amount: z.number().int().min(1) })
    const { amount } = schema.parse(request.body)
    const stats = await vendorStats(vendorId)
    if (amount > stats.availableBalance) {
      throw app.httpErrors.badRequest('Amount exceeds available balance')
    }

    const payout = await VendorPayout.create({
      vendorId,
      amount,
      status: 'pending',
      reference: `PAY-${Date.now()}`,
    })

    return { payout: mapId(payout) }
  })
}

export {
  vendorStats,
  normalizeProduct,
  productSchema,
  productWriteFields,
  prepareProductPayload,
  mapVendorPublic,
}
