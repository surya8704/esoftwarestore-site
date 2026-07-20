import { z } from 'zod'
import { mapId } from '../db/client.js'
import {
  ConfirmationCode,
  Coupon,
  LicenseKey,
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
import { addOrderNote, getCustomerStats, listAdminCustomers, loadAdminOrderDetail, PAID_ORDER_DB_FILTER } from '../services/orders.js'
import {
  isGatewayPaymentConfirmed,
  reconcileOrderPayment,
  resolveOrderPaymentBreakdown,
  summarizePaymentBreakdowns,
} from '../services/paymentFees.js'
import { canProcessOrderRefund, getRefundableAmount, processOrderRefund, roundMoney } from '../services/refunds.js'
import { generateConfirmationCode, parseJsonList } from '../lib/utils.js'
import { buildContactSummary } from '../lib/phone.js'
import { hashPassword } from '../db/seed.js'
import { normalizeProduct, productWriteFields, prepareProductPayload, vendorStats } from './vendor.js'
import {
  defaultVendorPermissions,
  normalizeVendorPermissions,
  VENDOR_PERMISSION_KEYS,
} from '../lib/vendorPermissions.js'
import {
  countOrdersAwaitingKeys,
  getLicensePoolStats,
  getLicensePoolStatsForProducts,
  importLicenseKeys,
  parseLicenseKeysFromBuffer,
  processPendingKeyDeliveries,
} from '../services/license.js'
import { buildEarningsReport } from '../services/reports.js'
import { convertViaInr, fetchRatesToInr } from '../services/fxRates.js'
import { config } from '../config.js'
import {
  getAdminTrustBadgeSettings,
  TRUST_BADGE_STYLES,
  updateTrustBadgeSettings,
} from '../services/storeSettings.js'
import {
  getAbandonedCartAdminDetail,
  listAbandonedCartsForAdmin,
} from '../services/abandonedCartAdmin.js'
import { processAbandonedCartFollowUps } from '../services/marketing.js'
import {
  listProductRegionalPrices,
  syncProductRegionalPrices,
} from '../services/pricing.js'
import {
  createGuide,
  deleteGuide,
  getAdminGuide,
  LEGAL_PAGE_KEYS,
  listAdminGuides,
  listAdminSitePages,
  resetSitePage,
  updateGuide,
  updateSitePage,
} from '../lib/siteContent.js'

const ORDER_STATUSES = ['pending', 'processing', 'completed', 'on_hold', 'cancelled', 'refunded']

function generateCouponCode(prefix = 'SAVE') {
  const clean = String(prefix || 'SAVE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SAVE'
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${clean}${suffix}`
}

const couponBodySchema = z.object({
  code: z.string().trim().min(3).max(40).optional(),
  prefix: z.string().trim().max(8).optional(),
  discountType: z.enum(['percent', 'fixed']).default('percent'),
  discountValue: z.number().positive(),
  minAmount: z.number().min(0).default(0),
  maxUses: z.number().int().positive().nullable().optional(),
  countryCodes: z.string().trim().max(500).optional().nullable(),
  productIds: z.string().trim().max(4000).optional().nullable(),
  active: z.boolean().default(true),
  expiresAt: z.union([z.string(), z.null()]).optional(),
})

function parseExpiresAt(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function mapCoupon(coupon) {
  return {
    ...mapId(coupon),
    countries: parseJsonList(coupon.countryCodes) ?? [],
    restrictedProductIds: parseJsonList(coupon.productIds) ?? [],
    isExpired: Boolean(coupon.expiresAt && new Date(coupon.expiresAt) < new Date()),
    remainingUses:
      coupon.maxUses == null ? null : Math.max(0, Number(coupon.maxUses) - Number(coupon.usedCount ?? 0)),
  }
}

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
    contact: buildContactSummary(order),
  }
}

const CONFIRMED_PAID_ORDER_FILTER = {
  ...PAID_ORDER_DB_FILTER,
  gatewayPaymentStatus: { $in: ['captured', 'success', 'paid', 'wallet'] },
}

export async function adminRoutes(app) {
  app.get('/api/admin/overview', { preHandler: [app.requireAdmin] }, async () => {
    const reportCurrency = (config.catalogBaseCurrency || 'USD').toUpperCase()
    const [
      productCount,
      orderCount,
      paidOrderCount,
      pendingOrderCount,
      userCount,
      vendorCount,
      paidOrders,
      pendingPayouts,
      paidPayouts,
      fx,
    ] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments(CONFIRMED_PAID_ORDER_FILTER),
      Order.countDocuments({ paymentStatus: { $nin: ['paid', 'refunded', 'cancelled', 'failed'] } }),
      User.countDocuments(),
      Vendor.countDocuments(),
      Order.find(CONFIRMED_PAID_ORDER_FILTER).select('amountPaid total currency').lean(),
      VendorPayout.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      VendorPayout.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      fetchRatesToInr(),
    ])

    let revenue = 0
    for (const order of paidOrders) {
      const amount = Number(order.amountPaid ?? order.total ?? 0) || 0
      const currency = String(order.currency || 'INR').toUpperCase()
      revenue += convertViaInr(amount, currency, reportCurrency, fx.ratesToInr)
    }

    return {
      totalProducts: productCount,
      totalOrders: orderCount,
      paidOrders: paidOrderCount,
      pendingOrders: pendingOrderCount,
      totalUsers: userCount,
      totalVendors: vendorCount,
      revenue,
      revenueCurrency: reportCurrency,
      pendingVendorPayouts: Number(pendingPayouts[0]?.total ?? 0),
      paidVendorPayouts: Number(paidPayouts[0]?.total ?? 0),
    }
  })

  app.get('/api/admin/reports/earnings', { preHandler: [app.requireAdmin] }, async (request) => {
    const schema = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      country: z.string().trim().max(3).optional(),
      groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
    })
    const query = schema.parse(request.query ?? {})
    return buildEarningsReport({
      from: query.from || undefined,
      to: query.to || undefined,
      countryCode: query.country || 'ALL',
      groupBy: query.groupBy || 'day',
    })
  })

  app.get('/api/admin/settings/trust-badge', { preHandler: [app.requireAdmin] }, async () => {
    return getAdminTrustBadgeSettings()
  })

  app.put('/api/admin/settings/trust-badge', { preHandler: [app.requireAdmin] }, async (request) => {
    const schema = z.object({
      enabled: z.boolean().optional(),
      title: z.string().trim().max(40).optional(),
      rating: z.coerce.number().min(1).max(5).optional(),
      baselineReviews: z.coerce.number().int().min(0).max(5_000_000).optional(),
      dailyGrowthMin: z.coerce.number().int().min(0).max(500).optional(),
      dailyGrowthMax: z.coerce.number().int().min(0).max(500).optional(),
      growthStartDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      tagline: z.string().trim().max(80).optional(),
      style: z
        .enum(['simple', 'shield-gold', 'circular-gold', 'shield-silver', 'hex-dark', 'octagon-green', 'ribbon-gold'])
        .optional(),
      showOnHome: z.boolean().optional(),
      showOnProduct: z.boolean().optional(),
      showOnCart: z.boolean().optional(),
    })
    const payload = schema.parse(request.body ?? {})
    const trustBadge = await updateTrustBadgeSettings(payload)
    return { trustBadge, styles: TRUST_BADGE_STYLES }
  })

  app.get('/api/admin/abandoned-carts', { preHandler: [app.requireAdmin] }, async (request) => {
    const schema = z.object({
      status: z.enum(['all', 'abandoned', 'recovered', 'submitted_order']).optional().default('all'),
      search: z.string().optional().default(''),
      limit: z.coerce.number().int().min(1).max(500).optional().default(200),
    })
    const query = schema.parse(request.query ?? {})
    return listAbandonedCartsForAdmin(query)
  })

  app.get('/api/admin/abandoned-carts/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const detail = await getAbandonedCartAdminDetail(request.params.id)
    if (!detail) return reply.notFound('Abandoned cart not found')
    return detail
  })

  app.post('/api/admin/abandoned-carts/process', { preHandler: [app.requireAdmin] }, async () => {
    return processAbandonedCartFollowUps()
  })

  app.get('/api/admin/users', { preHandler: [app.requireAdmin] }, async () => {
    const users = await User.find().sort({ createdAt: -1 }).limit(500)
    return {
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        countryCode: user.countryCode,
        walletBalance: user.walletBalance,
        createdAt: user.createdAt,
      })),
    }
  })

  app.post('/api/admin/users', { preHandler: [app.requireAdmin] }, async (request) => {
    const schema = z.object({
      name: z.string().min(2).max(120),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['customer', 'admin', 'vendor']).default('customer'),
      countryCode: z.string().length(2).optional(),
      locale: z.string().max(10).optional(),
    })
    const payload = schema.parse(request.body)
    const email = payload.email.trim().toLowerCase()

    const existing = await User.findOne({ email })
    if (existing) throw app.httpErrors.conflict('Email already registered')

    const user = await User.create({
      name: payload.name.trim(),
      email,
      passwordHash: hashPassword(payload.password),
      role: payload.role,
      countryCode: payload.countryCode ?? 'IN',
      locale: payload.locale ?? 'en',
      affiliateCode: payload.role === 'customer' ? `REF${Date.now().toString(36).slice(-6).toUpperCase()}` : undefined,
    })

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    }
  })

  app.patch('/api/admin/users/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(2).max(120).optional(),
      email: z.string().email().optional(),
      role: z.enum(['customer', 'admin', 'vendor']).optional(),
      password: z.string().min(6).optional(),
    })
    const payload = schema.parse(request.body ?? {})
    const user = await User.findById(request.params.id)
    if (!user) return reply.notFound('User not found')

    if (payload.email) {
      const email = payload.email.trim().toLowerCase()
      const duplicate = await User.findOne({ email, _id: { $ne: user._id } })
      if (duplicate) throw app.httpErrors.conflict('Email already in use')
      user.email = email
    }

    if (payload.name) user.name = payload.name.trim()

    if (payload.role && payload.role !== user.role) {
      if (user._id.toString() === request.user.sub && payload.role !== 'admin') {
        throw app.httpErrors.badRequest('You cannot remove your own admin role')
      }
      if (user.role === 'admin' && payload.role !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' })
        if (adminCount <= 1) {
          throw app.httpErrors.badRequest('Cannot change role of the last admin account')
        }
      }
      user.role = payload.role
    }

    if (payload.password) {
      user.passwordHash = hashPassword(payload.password)
    }

    await user.save()

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    }
  })

  app.delete('/api/admin/users/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const user = await User.findById(request.params.id)
    if (!user) return reply.notFound('User not found')

    if (user._id.toString() === request.user.sub) {
      throw app.httpErrors.badRequest('You cannot delete your own account')
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' })
      if (adminCount <= 1) {
        throw app.httpErrors.badRequest('Cannot delete the last admin account')
      }
    }

    await User.findByIdAndDelete(user._id)
    return { success: true }
  })

  app.get('/api/admin/vendors', { preHandler: [app.requireAdmin] }, async () => {
    const list = await Vendor.find().sort({ createdAt: -1 })
    const enriched = await Promise.all(
      list.map(async (vendor) => {
        const stats = await vendorStats(vendor._id.toString())
        return {
          ...mapId(vendor),
          permissions: normalizeVendorPermissions(vendor.permissions),
          stats,
        }
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
    const permissionShape = Object.fromEntries(
      VENDOR_PERMISSION_KEYS.map((key) => [key, z.boolean().optional()]),
    )
    const schema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      email: z.string().email(),
      commissionRate: z.number().int().min(0).max(50).default(15),
      password: z.string().min(6).optional(),
      permissions: z.object(permissionShape).optional(),
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

    const permissions = normalizeVendorPermissions({
      ...defaultVendorPermissions(),
      ...(payload.permissions ?? {}),
    })

    const vendor = await Vendor.create({
      userId,
      name: payload.name,
      slug: payload.slug,
      email: payload.email,
      commissionRate: payload.commissionRate,
      permissions,
    })

    return { vendor: { ...mapId(vendor), permissions } }
  })

  app.put('/api/admin/vendors/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const permissionShape = Object.fromEntries(
      VENDOR_PERMISSION_KEYS.map((key) => [key, z.boolean().optional()]),
    )
    const schema = z.object({
      name: z.string().min(2).optional(),
      slug: z.string().min(2).optional(),
      email: z.string().email().optional(),
      commissionRate: z.number().int().min(0).max(50).optional(),
      active: z.boolean().optional(),
      permissions: z.object(permissionShape).optional(),
    })
    const payload = schema.parse(request.body)
    const vendor = await Vendor.findById(request.params.id)
    if (!vendor) return reply.notFound('Vendor not found')

    if (payload.name !== undefined) vendor.name = payload.name
    if (payload.slug !== undefined) vendor.slug = payload.slug
    if (payload.email !== undefined) vendor.email = payload.email
    if (payload.commissionRate !== undefined) vendor.commissionRate = payload.commissionRate
    if (payload.active !== undefined) vendor.active = payload.active
    if (payload.permissions !== undefined) {
      vendor.permissions = normalizeVendorPermissions({
        ...normalizeVendorPermissions(vendor.permissions),
        ...payload.permissions,
      })
    }
    await vendor.save()

    return {
      vendor: {
        ...mapId(vendor),
        permissions: normalizeVendorPermissions(vendor.permissions),
      },
    }
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
    const ids = result.map((row) => row._id)
    const poolStats = await getLicensePoolStatsForProducts(ids)
    return {
      products: result.map((row) => ({
        ...normalizeProduct(row),
        vendorId: row.vendorId?._id?.toString?.() ?? row.vendorId,
        vendorName: row.vendorId?.name,
        licensePool: poolStats[String(row._id)] ?? { available: 0, assigned: 0, total: 0 },
      })),
    }
  })

  app.get('/api/admin/license-keys/overview', { preHandler: [app.requireAdmin] }, async () => {
    const awaitingKeys = await countOrdersAwaitingKeys()
    const available = await LicenseKey.countDocuments({ status: 'available' })
    const assigned = await LicenseKey.countDocuments({ status: 'assigned' })
    return { awaitingKeys, available, assigned, total: available + assigned }
  })

  app.post('/api/admin/orders/auto-deliver-keys', { preHandler: [app.requireAdmin] }, async (request) => {
    const limit = Math.min(200, Math.max(1, Number(request.body?.limit) || 50))
    const result = await processPendingKeyDeliveries({ limit })
    return {
      ...result,
      awaitingKeys: await countOrdersAwaitingKeys(),
    }
  })

  app.get('/api/admin/products/:id/license-keys', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const product = await Product.findById(request.params.id)
    if (!product) return reply.code(404).send({ message: 'Product not found' })
    const stats = await getLicensePoolStats(product._id)
    const recent = await LicenseKey.find({ productId: product._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('licenseKey status assignedAt createdAt orderId')
    return {
      productId: product._id.toString(),
      productName: product.name,
      stats,
      recent: recent.map((row) => ({
        id: row._id.toString(),
        licenseKey: row.status === 'available' ? row.licenseKey : `${String(row.licenseKey).slice(0, 4)}••••`,
        status: row.status,
        assignedAt: row.assignedAt,
        createdAt: row.createdAt,
        orderId: row.orderId?.toString?.() ?? null,
      })),
    }
  })

  app.post('/api/admin/products/:id/license-keys/import', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const product = await Product.findById(request.params.id)
    if (!product) return reply.code(404).send({ message: 'Product not found' })
    if (product.productType === 'bundle') {
      throw app.httpErrors.badRequest(
        'Bundle deals do not use their own key pool. Upload keys on each included product instead.',
      )
    }

    const file = await request.file()
    if (!file) throw app.httpErrors.badRequest('Upload an Excel (.xlsx/.xls) or CSV file of product keys')

    const filename = file.filename || 'keys.xlsx'
    const lower = filename.toLowerCase()
    if (!/\.(xlsx|xls|csv|txt)$/.test(lower)) {
      throw app.httpErrors.badRequest('Only .xlsx, .xls, .csv, or .txt key sheets are supported')
    }

    const chunks = []
    for await (const chunk of file.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)
    if (!buffer.length) throw app.httpErrors.badRequest('Uploaded file is empty')

    let keys
    try {
      keys = parseLicenseKeysFromBuffer(buffer, filename)
    } catch (err) {
      throw app.httpErrors.badRequest(err.message || 'Could not read the key sheet')
    }

    if (!keys.length) {
      throw app.httpErrors.badRequest('No product keys found in the file. Put keys in a column named key / license_key.')
    }

    const importResult = await importLicenseKeys(product._id, keys)
    const delivery = await processPendingKeyDeliveries({ limit: 100, productId: product._id })

    return {
      productId: product._id.toString(),
      productName: product.name,
      filename,
      parsed: keys.length,
      ...importResult,
      autoDelivery: delivery,
      awaitingKeys: await countOrdersAwaitingKeys(),
    }
  })

  app.post('/api/admin/products', { preHandler: [app.requireAdmin] }, async (request) => {
    let payload
    try {
      payload = await prepareProductPayload(request.body)
    } catch (err) {
      throw app.httpErrors.badRequest(err.message || 'Invalid product')
    }
    const existing = await Product.findOne({ slug: payload.slug })
    if (existing) throw app.httpErrors.conflict('Slug already exists')

    const product = await Product.create({
      vendorId: payload.vendorId || null,
      ...productWriteFields(payload),
    })

    return { product: normalizeProduct(product) }
  })

  app.put('/api/admin/products/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    let payload
    try {
      payload = await prepareProductPayload(request.body, { excludeProductId: request.params.id })
    } catch (err) {
      throw app.httpErrors.badRequest(err.message || 'Invalid product')
    }
    const product = await Product.findByIdAndUpdate(
      request.params.id,
      {
        ...productWriteFields(payload),
        vendorId: payload.vendorId || null,
      },
      { new: true },
    )
    if (!product) return reply.notFound('Product not found')
    return { product: normalizeProduct(product) }
  })

  app.patch('/api/admin/products/:id/regions', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      allowedCountries: z.array(z.string().trim().toUpperCase().length(2)).default([]),
      blockedCountries: z.array(z.string().trim().toUpperCase().length(2)).default([]),
      regionalPrices: z
        .array(
          z.object({
            countryCode: z.string().trim().toUpperCase().length(2),
            price: z.coerce.number().positive().optional().nullable(),
            currency: z.string().trim().toUpperCase().length(3).optional(),
          }),
        )
        .optional(),
    })
    const payload = schema.parse(request.body ?? {})
    const encode = (list) => (list?.length ? JSON.stringify(list) : null)
    const product = await Product.findByIdAndUpdate(
      request.params.id,
      {
        allowedCountries: encode(payload.allowedCountries),
        blockedCountries: encode(payload.blockedCountries),
      },
      { new: true },
    )
    if (!product) return reply.notFound('Product not found')

    let regionalPrices = []
    if (payload.regionalPrices) {
      regionalPrices = await syncProductRegionalPrices(product, payload.regionalPrices)
    } else {
      regionalPrices = await listProductRegionalPrices(product._id)
    }

    return {
      product: normalizeProduct(product),
      regionalPrices,
    }
  })

  app.get('/api/admin/products/:id/regional-prices', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const product = await Product.findById(request.params.id)
    if (!product) return reply.notFound('Product not found')
    const regionalPrices = await listProductRegionalPrices(product._id)
    return {
      productId: product._id.toString(),
      productName: product.name,
      basePrice: Number(product.price),
      originalPrice: Number(product.originalPrice),
      currency: 'USD',
      regionalPrices,
    }
  })

  app.put('/api/admin/products/:id/regional-prices', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      regionalPrices: z.array(
        z.object({
          countryCode: z.string().trim().toUpperCase().length(2),
          price: z.coerce.number().positive().optional().nullable(),
          currency: z.string().trim().toUpperCase().length(3).optional(),
        }),
      ),
    })
    const payload = schema.parse(request.body ?? {})
    const product = await Product.findById(request.params.id)
    if (!product) return reply.notFound('Product not found')
    const regionalPrices = await syncProductRegionalPrices(product, payload.regionalPrices)
    return {
      productId: product._id.toString(),
      productName: product.name,
      basePrice: Number(product.price),
      regionalPrices,
    }
  })

  app.delete('/api/admin/products/:id', { preHandler: [app.requireAdmin] }, async (request) => {
    await Product.findByIdAndDelete(request.params.id)
    return { success: true }
  })

  app.get('/api/admin/orders', { preHandler: [app.requireAdmin] }, async (request) => {
    const email = request.query?.email
    const filter = { ...PAID_ORDER_DB_FILTER }
    if (email) filter.customerEmail = String(email).toLowerCase()
    const result = await Order.find(filter).sort({ createdAt: -1 }).limit(200)

    const orders = []
    for (const order of result) {
      const method = (order.paymentMethod ?? '').toLowerCase()
      if (method === 'razorpay' && (order.razorpayPaymentId || order.paymentStatus === 'paid')) {
        await reconcileOrderPayment(order, { persist: true })
      } else if (order.paymentStatus === 'paid' && !isGatewayPaymentConfirmed(order)) {
        await reconcileOrderPayment(order, { persist: true })
      }
      if (isGatewayPaymentConfirmed(order)) {
        orders.push(await mapOrderListRow(order))
      }
    }

    const breakdowns = orders.map((o) => o.payment).filter((p) => p.paymentConfirmed)
    const fx = await fetchRatesToInr()
    const reportCurrency = (config.catalogBaseCurrency || 'USD').toUpperCase()
    const summary = summarizePaymentBreakdowns(breakdowns, {
      ratesToInr: fx.ratesToInr,
      reportCurrency,
    })
    return { orders, summary: { ...summary, count: orders.length } }
  })

  app.get('/api/admin/orders/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const order = await Order.findById(request.params.id)
    if (!order) return reply.notFound('Order not found')
    await reconcileOrderPayment(order, { persist: true })
    const detail = await loadAdminOrderDetail(order._id)
    if (!detail) return reply.notFound('Order not found')
    return { order: detail }
  })

  app.patch('/api/admin/orders/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      orderStatus: z.enum(ORDER_STATUSES).optional(),
      customerEmail: z.string().email().optional(),
      customerPhone: z.string().max(40).optional(),
      customerWhatsapp: z.string().max(40).optional(),
    })
    const payload = schema.parse(request.body)
    const order = await Order.findById(request.params.id)
    if (!order) return reply.notFound('Order not found')

    const previousStatus = order.orderStatus ?? 'pending'
    if (payload.orderStatus) order.orderStatus = payload.orderStatus
    if (payload.customerEmail) order.customerEmail = payload.customerEmail
    if (payload.customerPhone !== undefined) order.customerPhone = payload.customerPhone
    if (payload.customerWhatsapp !== undefined) order.customerWhatsapp = payload.customerWhatsapp
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

    await reconcileOrderPayment(order, { persist: true })

    const eligibility = canProcessOrderRefund(order)
    if (!eligibility.ok) {
      throw app.httpErrors.badRequest(eligibility.reason)
    }

    let result
    try {
      result = await processOrderRefund(order, payload)
    } catch (error) {
      throw app.httpErrors.badRequest(error.message ?? 'Refund failed')
    }

    const paidTotal = roundMoney(order.amountPaid ?? order.total)
    const newTotalRefunded = roundMoney((order.refundAmount ?? 0) + result.amount)
    const fullyRefunded = newTotalRefunded >= paidTotal - 0.01

    order.refundAmount = newTotalRefunded
    order.refundId = result.refundId
    order.refundReason = payload.reason ?? result.reason ?? ''
    order.refundedAt = new Date()

    if (fullyRefunded) {
      order.paymentStatus = 'refunded'
      order.orderStatus = 'refunded'
      order.gatewayPaymentStatus = 'refunded'
    }

    await order.save()

    const refundLabel = fullyRefunded ? 'Refund' : 'Partial refund'
    await addOrderNote({
      orderId: order._id,
      authorId: request.user.sub,
      authorName: request.user.email ?? 'Admin',
      content: `${refundLabel} of ${result.amount} processed via ${result.gateway}. Ref ID: ${result.refundId}${payload.reason ? `. Reason: ${payload.reason}` : ''}${fullyRefunded ? '' : `. Remaining refundable: ${getRefundableAmount(order)}`}`,
      noteType: 'private',
    })

    const detail = await loadAdminOrderDetail(order._id)
    return { success: true, refund: { ...result, fullyRefunded }, order: detail }
  })

  app.get('/api/admin/customers', { preHandler: [app.requireAdmin] }, async (request) => {
    const search = typeof request.query.search === 'string' ? request.query.search : ''
    const gmailOnly = request.query.gmail === '1' || request.query.gmail === 'true'
    const customers = await listAdminCustomers({ search, gmailOnly })
    return { customers }
  })

  app.get('/api/admin/customers/:email', { preHandler: [app.requireAdmin] }, async (request) => {
    const email = decodeURIComponent(request.params.email)
    const stats = await getCustomerStats(email)
    const result = await Order.find({
      customerEmail: new RegExp(`^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      ...PAID_ORDER_DB_FILTER,
    }).sort({ createdAt: -1 }).limit(100)

    const orderRows = []
    for (const order of result) {
      const method = (order.paymentMethod ?? '').toLowerCase()
      if (method === 'razorpay' && (order.razorpayPaymentId || order.paymentStatus === 'paid')) {
        await reconcileOrderPayment(order, { persist: true })
      } else if (order.paymentStatus === 'paid' && !isGatewayPaymentConfirmed(order)) {
        await reconcileOrderPayment(order, { persist: true })
      }
      if (isGatewayPaymentConfirmed(order)) {
        orderRows.push(await mapOrderListRow(order))
      }
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() })
    return {
      email,
      user: user
        ? { id: user._id.toString(), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }
        : null,
      stats,
      contact: orderRows[0]?.contact ?? null,
      orders: orderRows,
    }
  })

  app.get('/api/admin/coupons', { preHandler: [app.requireAdmin] }, async () => {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).limit(200)
    return { coupons: coupons.map(mapCoupon) }
  })

  app.post('/api/admin/coupons', { preHandler: [app.requireAdmin] }, async (request) => {
    const payload = couponBodySchema.parse(request.body)
    if (payload.discountType === 'percent' && payload.discountValue > 100) {
      throw app.httpErrors.badRequest('Percent discount cannot exceed 100')
    }

    let code = (payload.code || '').toUpperCase().replace(/\s+/g, '')
    if (!code) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = generateCouponCode(payload.prefix)
        const exists = await Coupon.findOne({ code: candidate })
        if (!exists) {
          code = candidate
          break
        }
      }
    }
    if (!code) throw app.httpErrors.badRequest('Could not generate a unique coupon code')

    const existing = await Coupon.findOne({ code })
    if (existing) throw app.httpErrors.conflict('Coupon code already exists')

    const coupon = await Coupon.create({
      code,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      minAmount: payload.minAmount ?? 0,
      maxUses: payload.maxUses ?? null,
      countryCodes: payload.countryCodes || undefined,
      productIds: payload.productIds || undefined,
      active: payload.active ?? true,
      expiresAt: parseExpiresAt(payload.expiresAt),
      usedCount: 0,
    })

    return { coupon: mapCoupon(coupon) }
  })

  app.post('/api/admin/coupons/generate', { preHandler: [app.requireAdmin] }, async (request) => {
    const schema = z.object({
      prefix: z.string().trim().max(8).optional(),
      count: z.number().int().min(1).max(20).default(1),
      discountType: z.enum(['percent', 'fixed']).default('percent'),
      discountValue: z.number().positive(),
      minAmount: z.number().min(0).default(0),
      maxUses: z.number().int().positive().nullable().optional(),
      countryCodes: z.string().trim().max(500).optional().nullable(),
      productIds: z.string().trim().max(4000).optional().nullable(),
      active: z.boolean().default(true),
      expiresAt: z.union([z.string(), z.null()]).optional(),
    })
    const payload = schema.parse(request.body)
    if (payload.discountType === 'percent' && payload.discountValue > 100) {
      throw app.httpErrors.badRequest('Percent discount cannot exceed 100')
    }

    const created = []
    for (let i = 0; i < payload.count; i += 1) {
      let code = null
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = generateCouponCode(payload.prefix)
        const exists = await Coupon.findOne({ code: candidate })
        if (!exists) {
          code = candidate
          break
        }
      }
      if (!code) continue
      const coupon = await Coupon.create({
        code,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        minAmount: payload.minAmount ?? 0,
        maxUses: payload.maxUses ?? null,
        countryCodes: payload.countryCodes || undefined,
        productIds: payload.productIds || undefined,
        active: payload.active ?? true,
        expiresAt: parseExpiresAt(payload.expiresAt),
        usedCount: 0,
      })
      created.push(mapCoupon(coupon))
    }

    return { coupons: created, count: created.length }
  })

  app.patch('/api/admin/coupons/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      discountType: z.enum(['percent', 'fixed']).optional(),
      discountValue: z.number().positive().optional(),
      minAmount: z.number().min(0).optional(),
      maxUses: z.number().int().positive().nullable().optional(),
      countryCodes: z.string().trim().max(500).nullable().optional(),
      productIds: z.string().trim().max(4000).nullable().optional(),
      active: z.boolean().optional(),
      expiresAt: z.union([z.string(), z.null()]).optional(),
    })
    const payload = schema.parse(request.body)
    const coupon = await Coupon.findById(request.params.id)
    if (!coupon) return reply.code(404).send({ message: 'Coupon not found' })

    if (payload.discountType !== undefined) coupon.discountType = payload.discountType
    if (payload.discountValue !== undefined) {
      if ((payload.discountType ?? coupon.discountType) === 'percent' && payload.discountValue > 100) {
        throw app.httpErrors.badRequest('Percent discount cannot exceed 100')
      }
      coupon.discountValue = payload.discountValue
    }
    if (payload.minAmount !== undefined) coupon.minAmount = payload.minAmount
    if (payload.maxUses !== undefined) coupon.maxUses = payload.maxUses
    if (payload.countryCodes !== undefined) coupon.countryCodes = payload.countryCodes || undefined
    if (payload.productIds !== undefined) coupon.productIds = payload.productIds || undefined
    if (payload.active !== undefined) coupon.active = payload.active
    if (payload.expiresAt !== undefined) coupon.expiresAt = parseExpiresAt(payload.expiresAt)

    await coupon.save()
    return { coupon: mapCoupon(coupon) }
  })

  app.delete('/api/admin/coupons/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const coupon = await Coupon.findByIdAndDelete(request.params.id)
    if (!coupon) return reply.code(404).send({ message: 'Coupon not found' })
    return { ok: true }
  })

  app.get('/api/admin/pages', { preHandler: [app.requireAdmin] }, async () => {
    const pages = await listAdminSitePages()
    return { pages }
  })

  app.get('/api/admin/pages/:key', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const key = request.params.key
    if (!LEGAL_PAGE_KEYS.includes(key)) return reply.code(404).send({ message: 'Page not found' })
    const pages = await listAdminSitePages()
    const page = pages.find((p) => p.key === key)
    if (!page) return reply.code(404).send({ message: 'Page not found' })
    return { page }
  })

  app.put('/api/admin/pages/:key', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const key = request.params.key
    if (!LEGAL_PAGE_KEYS.includes(key)) return reply.code(404).send({ message: 'Page not found' })
    const schema = z.object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(500).optional(),
      updatedLabel: z.string().trim().max(80).optional(),
      sections: z
        .array(
          z.object({
            title: z.string().trim().min(1).max(200),
            paragraphs: z.array(z.string()).default([]),
            list: z.array(z.string()).default([]),
            links: z
              .array(z.object({ label: z.string().trim().min(1), to: z.string().trim().min(1) }))
              .default([]),
          }),
        )
        .optional(),
    })
    const payload = schema.parse(request.body ?? {})
    const page = await updateSitePage(key, payload)
    return { page }
  })

  app.post('/api/admin/pages/:key/reset', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const key = request.params.key
    if (!LEGAL_PAGE_KEYS.includes(key)) return reply.code(404).send({ message: 'Page not found' })
    const page = await resetSitePage(key)
    return { page }
  })

  app.get('/api/admin/guides', { preHandler: [app.requireAdmin] }, async () => {
    const guides = await listAdminGuides()
    return { guides }
  })

  app.get('/api/admin/guides/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const guide = await getAdminGuide(request.params.id)
    if (!guide) return reply.code(404).send({ message: 'Guide not found' })
    return { guide }
  })

  app.post('/api/admin/guides', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      title: z.string().trim().min(1).max(300),
      slug: z.string().trim().max(160).optional(),
      excerpt: z.string().max(1000).optional(),
      contentHtml: z.string().optional(),
      imageUrl: z.string().max(800).optional(),
      sourceUrl: z.string().max(500).optional(),
      categories: z.union([z.string(), z.array(z.string())]).optional(),
      publishedAt: z.string().optional().nullable(),
      active: z.boolean().optional(),
    })
    try {
      const payload = schema.parse(request.body ?? {})
      const guide = await createGuide(payload)
      return reply.code(201).send({ guide })
    } catch (err) {
      if (err?.name === 'ZodError') throw err
      return reply.code(400).send({ message: err.message || 'Could not create guide' })
    }
  })

  app.put('/api/admin/guides/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      title: z.string().trim().min(1).max(300).optional(),
      slug: z.string().trim().max(160).optional(),
      excerpt: z.string().max(1000).optional(),
      contentHtml: z.string().optional(),
      imageUrl: z.string().max(800).optional(),
      sourceUrl: z.string().max(500).optional(),
      categories: z.union([z.string(), z.array(z.string())]).optional(),
      publishedAt: z.string().optional().nullable(),
      active: z.boolean().optional(),
    })
    try {
      const payload = schema.parse(request.body ?? {})
      const guide = await updateGuide(request.params.id, payload)
      if (!guide) return reply.code(404).send({ message: 'Guide not found' })
      return { guide }
    } catch (err) {
      if (err?.name === 'ZodError') throw err
      return reply.code(400).send({ message: err.message || 'Could not update guide' })
    }
  })

  app.delete('/api/admin/guides/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const ok = await deleteGuide(request.params.id)
    if (!ok) return reply.code(404).send({ message: 'Guide not found' })
    return { ok: true }
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
