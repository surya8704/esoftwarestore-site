import { mapId } from '../db/client.js'
import {
  Affiliate,
  Cart,
  Order,
  OrderItem,
  Product,
  User,
  WalletTransaction,
} from '../db/models.js'
import { sendOrderDeliveryEmail } from './email.js'
import { assignLicenseKey } from './license.js'
import { markCartRecovered } from './marketing.js'
import { sendOrderWhatsApp } from './whatsapp.js'

export async function fulfillPaidOrder(order, { razorpayPaymentId, payuPaymentId } = {}) {
  if (order.paymentStatus === 'paid') {
    const items = await OrderItem.find({ orderId: order._id })
    const primaryKey = order.licenseKey ?? items[0]?.licenseKey ?? null
    return {
      confirmationCode: order.confirmationCode,
      licenseKey: primaryKey,
      items: items.map((item) => ({
        productName: item.productName,
        licenseKey: item.licenseKey,
      })),
      emailDelivered: order.emailSent,
    }
  }

  const items = await OrderItem.find({ orderId: order._id })
  const deliveredItems = []

  for (const item of items) {
    const key = await assignLicenseKey({
      productId: item.productId,
      variantId: item.variantId,
      orderId: order._id,
    })
    item.licenseKey = key
    await item.save()
    deliveredItems.push(mapId(item))

    const product = await Product.findById(item.productId)
    if (product) {
      product.stock = Math.max(product.stock - item.quantity, 0)
      await product.save()
    }
  }

  const primaryKey = deliveredItems[0]?.licenseKey ?? null
  order.paymentStatus = 'paid'
  order.orderStatus = 'processing'
  if (razorpayPaymentId) order.razorpayPaymentId = razorpayPaymentId
  if (payuPaymentId) order.payuPaymentId = payuPaymentId
  order.licenseKey = primaryKey
  order.emailSent = true
  await order.save()

  await sendOrderDeliveryEmail({
    order: mapId(order),
    items: deliveredItems,
    confirmationCode: order.confirmationCode,
  })
  await sendOrderWhatsApp({
    phone: order.customerPhone,
    order: mapId(order),
    confirmationCode: order.confirmationCode,
    licenseKey: primaryKey,
  })

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

  return {
    confirmationCode: order.confirmationCode,
    licenseKey: primaryKey,
    items: deliveredItems.map((i) => ({
      productName: i.productName,
      licenseKey: i.licenseKey,
    })),
    emailDelivered: true,
  }
}
