import { AbandonedCart, Cart, Order } from '../db/models.js'
import { mapId } from '../db/client.js'
import { loadCartSnapshot } from './marketing.js'

const SUBMITTED_PAYMENT_STATUSES = new Set(['created', 'pending', 'processing'])

export function resolveAbandonedCartStatus({ row, order, snapshot }) {
  if (row.recovered) return 'recovered'
  if (order && SUBMITTED_PAYMENT_STATUSES.has(String(order.paymentStatus || '').toLowerCase())) {
    return 'submitted_order'
  }
  if (snapshot?.empty) return 'recovered'
  return 'abandoned'
}

function formatLastActive(dates) {
  const valid = dates.filter(Boolean).map((d) => new Date(d).getTime()).filter(Number.isFinite)
  if (!valid.length) return null
  return new Date(Math.max(...valid))
}

export async function listAbandonedCartsForAdmin({
  status = 'all',
  search = '',
  limit = 200,
} = {}) {
  const filter = {}
  const q = String(search || '').trim().toLowerCase()
  if (q) filter.email = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }

  const rows = await AbandonedCart.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 500)).lean()
  const cartIds = rows.map((r) => r.cartId).filter(Boolean)

  const cartDocs = cartIds.length ? await Cart.find({ _id: { $in: cartIds } }).lean() : []
  const cartById = new Map(cartDocs.map((c) => [String(c._id), c]))
  const sessionIds = cartDocs.map((c) => c.sessionId).filter(Boolean)

  const orders = sessionIds.length
    ? await Order.find({ sessionId: { $in: sessionIds } })
        .sort({ createdAt: -1 })
        .lean()
    : []
  const orderBySession = new Map()
  for (const order of orders) {
    const key = order.sessionId
    if (!key || orderBySession.has(key)) continue
    orderBySession.set(key, order)
  }

  const enriched = []
  for (const row of rows) {
    const cart = cartById.get(String(row.cartId)) ?? null
    const order = cart?.sessionId ? orderBySession.get(cart.sessionId) ?? null : null
    const snapshot = row.cartId ? await loadCartSnapshot(row.cartId) : null
    const trackingStatus = resolveAbandonedCartStatus({ row, order, snapshot })
    const lastActive = formatLastActive([
      cart?.updatedAt,
      row.lastEmailAt,
      row.createdAt,
      order?.createdAt,
    ])

    enriched.push({
      id: String(row._id),
      email: row.email || cart?.email || '—',
      step: row.step || 'cart',
      trackingStatus,
      recovered: Boolean(row.recovered),
      followUpStage: Number(row.followUpStage) || 0,
      lastEmailAt: row.lastEmailAt ?? null,
      createdAt: row.createdAt,
      lastActive,
      amount: snapshot?.subtotal ?? order?.total ?? 0,
      currency: snapshot?.currency ?? order?.currency ?? cart?.currency ?? 'USD',
      products: (snapshot?.items ?? []).slice(0, 6).map((p) => ({
        name: p.name,
        slug: p.slug,
        imageUrl: p.imageUrl,
        quantity: p.quantity,
      })),
      productCount: snapshot?.items?.length ?? 0,
      cartEmpty: Boolean(snapshot?.empty),
      orderId: order?._id ? String(order._id) : null,
      orderPaymentStatus: order?.paymentStatus ?? null,
      countryCode: cart?.countryCode ?? order?.countryCode ?? null,
    })
  }

  const summary = {
    total: enriched.length,
    abandoned: enriched.filter((r) => r.trackingStatus === 'abandoned').length,
    recovered: enriched.filter((r) => r.trackingStatus === 'recovered').length,
    submitted_order: enriched.filter((r) => r.trackingStatus === 'submitted_order').length,
  }

  const carts =
    status === 'all' ? enriched : enriched.filter((item) => item.trackingStatus === status)

  return { carts, summary }
}

export async function getAbandonedCartAdminDetail(id) {
  const row = await AbandonedCart.findById(id).lean()
  if (!row) return null

  const snapshot = row.cartId ? await loadCartSnapshot(row.cartId) : null
  const cart = row.cartId ? await Cart.findById(row.cartId).lean() : null
  const order = cart?.sessionId
    ? await Order.findOne({ sessionId: cart.sessionId }).sort({ createdAt: -1 }).lean()
    : null

  return {
    ...mapId(row),
    trackingStatus: resolveAbandonedCartStatus({ row, order, snapshot }),
    cart: cart ? mapId(cart) : null,
    order: order ? mapId(order) : null,
    snapshot: snapshot
      ? {
          subtotal: snapshot.subtotal,
          currency: snapshot.currency,
          items: snapshot.items,
          empty: snapshot.empty,
        }
      : null,
  }
}
