import { mapId } from '../db/client.js'
import { buildContactSummary } from '../lib/phone.js'
import { Order, OrderItem, OrderNote, Product, User } from '../db/models.js'
import { isGatewayPaymentConfirmed, resolveOrderPaymentBreakdown } from './paymentFees.js'
import { canProcessOrderRefund, getRefundableAmount, roundMoney } from './refunds.js'

function normalizeCustomerEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

export const PAID_ORDER_DB_FILTER = {
  paymentStatus: 'paid',
  orderStatus: { $nin: ['cancelled', 'canceled'] },
}

function customerEmailRegex(email) {
  const normalized = normalizeCustomerEmail(email)
  return new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
}

export function filterConfirmedPaidOrders(orders) {
  return orders.filter((o) => isGatewayPaymentConfirmed(o))
}

export function buildCustomerCurrencyStats(orders) {
  const paid = filterConfirmedPaidOrders(orders)
  const byCurrency = new Map()

  for (const order of paid) {
    const currency = order.currency || 'INR'
    const row = byCurrency.get(currency) ?? { currency, totalRevenue: 0, paidOrders: 0 }
    row.totalRevenue += Number(order.total ?? 0)
    row.paidOrders += 1
    byCurrency.set(currency, row)
  }

  const currencyStats = [...byCurrency.values()]
    .map((row) => ({
      ...row,
      averageOrderValue: row.paidOrders ? Math.round(row.totalRevenue / row.paidOrders) : 0,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))

  const primary = currencyStats[0] ?? null

  return {
    totalOrders: paid.length,
    paidOrders: paid.length,
    currencyStats,
    totalRevenue: primary?.totalRevenue ?? 0,
    averageOrderValue: primary?.averageOrderValue ?? 0,
    primaryCurrency: primary?.currency ?? 'INR',
  }
}

export async function getCustomerStats(customerEmail) {
  const email = normalizeCustomerEmail(customerEmail)
  const orders = filterConfirmedPaidOrders(
    await Order.find({ customerEmail: customerEmailRegex(email), ...PAID_ORDER_DB_FILTER }).sort({ createdAt: -1 }),
  )
  const summary = buildCustomerCurrencyStats(orders)
  const user = await User.findOne({ email })

  return {
    ...summary,
    userId: user?._id?.toString() ?? null,
    userName: user?.name ?? null,
    recentOrders: orders.slice(0, 10).map((o) => ({
      id: o._id.toString(),
      total: o.total,
      currency: o.currency || 'INR',
      orderStatus: o.orderStatus ?? o.paymentStatus,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
    })),
  }
}

export async function listAdminCustomers({ search, gmailOnly = false } = {}) {
  const rows = await Order.aggregate([
    { $match: { customerEmail: { $exists: true, $ne: '' }, ...PAID_ORDER_DB_FILTER } },
    {
      $group: {
        _id: { $toLower: { $trim: { input: '$customerEmail' } } },
        email: { $first: '$customerEmail' },
        orders: {
          $push: {
            total: '$total',
            currency: '$currency',
            paymentStatus: '$paymentStatus',
            gatewayPaymentStatus: '$gatewayPaymentStatus',
            orderStatus: '$orderStatus',
            paymentMethod: '$paymentMethod',
            razorpayPaymentId: '$razorpayPaymentId',
            payuPaymentId: '$payuPaymentId',
            stripeChargeId: '$stripeChargeId',
            stripePaymentId: '$stripePaymentId',
            createdAt: '$createdAt',
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ])

  let customers = rows
    .filter((row) => row._id)
    .map((row) => {
      const paidOrders = filterConfirmedPaidOrders(
        row.orders.map((o) => ({
          total: o.total,
          currency: o.currency || 'INR',
          paymentStatus: o.paymentStatus,
          gatewayPaymentStatus: o.gatewayPaymentStatus,
          orderStatus: o.orderStatus,
          paymentMethod: o.paymentMethod,
          razorpayPaymentId: o.razorpayPaymentId,
          payuPaymentId: o.payuPaymentId,
          stripeChargeId: o.stripeChargeId,
          stripePaymentId: o.stripePaymentId,
          createdAt: o.createdAt,
        })),
      )
      if (!paidOrders.length) return null

      const summary = buildCustomerCurrencyStats(paidOrders)
      const lastOrderAt = paidOrders.reduce((latest, order) => {
        const at = order.createdAt ? new Date(order.createdAt).getTime() : 0
        return at > latest ? at : latest
      }, 0)

      return {
        email: row.email,
        totalOrders: summary.totalOrders,
        paidOrders: summary.paidOrders,
        currencyStats: summary.currencyStats,
        primaryCurrency: summary.primaryCurrency,
        totalRevenue: summary.totalRevenue,
        averageOrderValue: summary.averageOrderValue,
        lastOrderAt: lastOrderAt ? new Date(lastOrderAt) : null,
      }
    })
    .filter(Boolean)

  if (gmailOnly) {
    customers = customers.filter((c) => normalizeCustomerEmail(c.email).endsWith('@gmail.com'))
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase()
    customers = customers.filter((c) => normalizeCustomerEmail(c.email).includes(q))
  }

  const emails = customers.map((c) => normalizeCustomerEmail(c.email))
  const users = await User.find({ email: { $in: emails } })
  const userMap = new Map(users.map((u) => [normalizeCustomerEmail(u.email), u]))

  return customers.map((customer) => {
    const user = userMap.get(normalizeCustomerEmail(customer.email))
    return {
      ...customer,
      userId: user?._id?.toString() ?? null,
      userName: user?.name ?? null,
      isRegistered: Boolean(user),
      isGmail: normalizeCustomerEmail(customer.email).endsWith('@gmail.com'),
    }
  })
}

export async function loadAdminOrderDetail(orderId) {
  const order = await Order.findById(orderId)
  if (!order) return null

  const [items, notes, customerStats] = await Promise.all([
    OrderItem.find({ orderId: order._id }),
    OrderNote.find({ orderId: order._id }).sort({ createdAt: -1 }),
    getCustomerStats(order.customerEmail),
  ])

  const productIds = items.map((i) => i.productId).filter(Boolean)
  const products = await Product.find({ _id: { $in: productIds } })
  const productMap = new Map(products.map((p) => [p._id.toString(), p]))

  const mapped = mapId(order)
  const payment = resolveOrderPaymentBreakdown(order)
  const refundEligibility = canProcessOrderRefund(order)
  return {
    ...mapped,
    orderId: mapped.id,
    payment: {
      ...payment,
      refundableAmount: getRefundableAmount(order),
      totalRefunded: roundMoney(order.refundAmount ?? 0),
      canRefund: refundEligibility.ok,
      refundBlockedReason: refundEligibility.ok ? null : refundEligibility.reason,
    },
    items: items.map((item) => {
      const mappedItem = mapId(item)
      const product = productMap.get(item.productId?.toString?.() ?? String(item.productId))
      return {
        ...mappedItem,
        downloadUrl: item.downloadUrl || product?.downloadUrl || null,
        deliveryDescription: item.deliveryDescription ?? '',
        deliveryAttachments: item.deliveryAttachments?.length
          ? item.deliveryAttachments
          : item.downloadUrl
            ? [{ type: 'link', url: item.downloadUrl, label: 'Download' }]
            : [],
        keySentAt: item.keySentAt ?? null,
        sku: product?.slug ?? null,
      }
    }),
    notes: notes.map(mapId),
    customerStats,
    contact: buildContactSummary(order),
    billingName: [order.billing?.firstName, order.billing?.lastName].filter(Boolean).join(' ') || null,
  }
}

export async function addOrderNote({ orderId, authorId, authorName, content, noteType = 'private' }) {
  const note = await OrderNote.create({
    orderId,
    authorId,
    authorName,
    content,
    noteType,
  })
  return mapId(note)
}
