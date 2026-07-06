import { mapId } from '../db/client.js'
import { Order, OrderItem } from '../db/models.js'
import { isGatewayPaymentConfirmed } from './paymentFees.js'

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

export function getCustomerFacingStatus(order) {
  const orderStatus = (order.orderStatus ?? '').toLowerCase()
  const paymentStatus = (order.paymentStatus ?? '').toLowerCase()
  const gatewayStatus = (order.gatewayPaymentStatus ?? '').toLowerCase()

  if (orderStatus === 'cancelled' || paymentStatus === 'cancelled') return 'Cancelled'
  if (gatewayStatus === 'cancelled' || gatewayStatus === 'canceled') return 'Payment cancelled'
  if (orderStatus === 'refunded' || paymentStatus === 'refunded') return 'Refunded'
  if (paymentStatus === 'failed' || gatewayStatus === 'failed') return 'Payment failed'
  if (orderStatus === 'completed') return 'Completed'
  if (orderStatus === 'on_hold') return 'On hold'
  if (orderStatus === 'processing') return 'Processing'
  if (isGatewayPaymentConfirmed(order)) return 'Paid — processing'
  if (paymentStatus === 'created') return 'Awaiting payment'
  return order.orderStatus ?? order.paymentStatus ?? 'Pending'
}

async function mapCustomerOrder(order, { includeKeys = true } = {}) {
  const items = await OrderItem.find({ orderId: order._id })
  const paid = isGatewayPaymentConfirmed(order)

  return {
    ...mapId(order),
    customerStatus: getCustomerFacingStatus(order),
    items: items.map((item) => {
      const mapped = mapId(item)
      return {
        ...mapped,
        licenseKey: includeKeys && paid ? mapped.licenseKey : null,
      }
    }),
    licenseKey: includeKeys && paid ? order.licenseKey : null,
    confirmationCode: order.confirmationCode ?? null,
  }
}

export async function listOrdersForUser(user) {
  await Order.updateMany(
    { customerEmail: user.email, userId: null },
    { userId: user._id },
  )

  const result = await Order.find({
    $or: [{ userId: user._id }, { customerEmail: user.email }],
  }).sort({ createdAt: -1 })

  return Promise.all(result.map((order) => mapCustomerOrder(order)))
}

export async function lookupOrdersByEmail(email, { confirmationCode } = {}) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) throw new Error('Email address is required')

  const filter = { customerEmail: normalizedEmail }
  if (confirmationCode?.trim()) {
    filter.confirmationCode = confirmationCode.trim().toUpperCase()
  }

  const result = await Order.find(filter).sort({ createdAt: -1 }).limit(50)
  if (!result.length) {
    throw new Error('No orders found for this email. Check the address used at checkout.')
  }

  return Promise.all(result.map((order) => mapCustomerOrder(order)))
}
