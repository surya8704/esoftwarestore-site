import { mapId } from '../db/client.js'
import {
  Affiliate,
  Cart,
  OrderItem,
  Product,
  User,
  WalletTransaction,
} from '../db/models.js'
import { deliverKeysForPaidOrder } from './license.js'
import { markCartRecovered } from './marketing.js'
import { captureOrderPaymentFees } from './paymentFees.js'

export async function fulfillPaidOrder(order, { razorpayPaymentId, payuPaymentId } = {}) {
  // Already paid — if keys still missing, try again; otherwise return snapshot
  if (order.paymentStatus === 'paid') {
    const items = await OrderItem.find({ orderId: order._id })
    const needsKeys = items.some((item) => !item.licenseKey?.trim())
    if (needsKeys || (!order.emailSent && items.some((item) => item.licenseKey?.trim()))) {
      return deliverKeysForPaidOrder(order)
    }
    return {
      confirmationCode: order.confirmationCode,
      licenseKey: order.licenseKey ?? items[0]?.licenseKey ?? null,
      items: items.map((item) => ({
        productName: item.productName,
        licenseKey: item.licenseKey,
      })),
      emailDelivered: order.emailSent,
      awaitingKeys: items.some((item) => !item.licenseKey?.trim()),
      delivered: items.every((item) => Boolean(item.licenseKey?.trim())),
    }
  }

  if (razorpayPaymentId) order.razorpayPaymentId = razorpayPaymentId
  if (payuPaymentId) order.payuPaymentId = payuPaymentId
  order.paymentStatus = 'paid'
  order.orderStatus = 'pending'
  order.emailSent = false
  await captureOrderPaymentFees(order, { razorpayPaymentId, payuPaymentId })
  await order.save()

  // Decrement stock once payment is confirmed (even if keys are pending)
  const items = await OrderItem.find({ orderId: order._id })
  for (const item of items) {
    const product = await Product.findById(item.productId)
    if (product) {
      product.stock = Math.max(product.stock - item.quantity, 0)
      await product.save()
    }
  }

  if (order.sessionId) {
    const cart = await Cart.findOne({ sessionId: order.sessionId })
    if (cart) await markCartRecovered(cart._id)
  }

  if (order.affiliateId) {
    const aff = await Affiliate.findById(order.affiliateId)
    if (aff) {
      const commission = Math.round((order.total * aff.commissionRate) / 100)
      aff.totalEarnings += commission
      await aff.save()
      await WalletTransaction.create({
        userId: aff.userId,
        amount: commission,
        type: 'affiliate_commission',
        reference: `order-${order._id}`,
      })
      await User.findByIdAndUpdate(aff.userId, { $inc: { walletBalance: commission } })
    }
  }

  // Assign keys from Excel pool → email + completed, or leave pending for manual
  return deliverKeysForPaidOrder(order)
}
