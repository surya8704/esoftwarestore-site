import { mapId } from '../db/client.js'
import { Order, OrderItem, OrderNote, Product, User } from '../db/models.js'

export async function getCustomerStats(customerEmail) {
  const orders = await Order.find({ customerEmail }).sort({ createdAt: -1 })
  const paid = orders.filter((o) => o.paymentStatus === 'paid' || o.orderStatus === 'completed')
  const totalRevenue = paid.reduce((sum, o) => sum + Number(o.total ?? 0), 0)
  const user = await User.findOne({ email: customerEmail })

  return {
    totalOrders: orders.length,
    paidOrders: paid.length,
    totalRevenue,
    averageOrderValue: paid.length ? Math.round(totalRevenue / paid.length) : 0,
    userId: user?._id?.toString() ?? null,
    userName: user?.name ?? null,
    recentOrders: orders.slice(0, 10).map((o) => ({
      id: o._id.toString(),
      total: o.total,
      orderStatus: o.orderStatus ?? o.paymentStatus,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
    })),
  }
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
  return {
    ...mapped,
    orderId: mapped.id,
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
