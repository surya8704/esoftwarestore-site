import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { z } from 'zod'
import { config, COUNTRY_PAYMENTS } from '../config.js'
import { mapId } from '../db/client.js'
import {
  Affiliate,
  Cart,
  CartItem,
  ConfirmationCode,
  Coupon,
  Order,
  OrderItem,
  Product,
  User,
} from '../db/models.js'
import { generateConfirmationCode } from '../lib/utils.js'
import { fulfillPaidOrder } from '../services/checkoutFulfillment.js'
import { listOrdersForUser, lookupOrdersByEmail } from '../services/customerOrders.js'
import { isGatewayPaymentConfirmed, markOrderPaymentCancelled, reconcileOrderPayment, verifyRazorpayPaymentCaptured } from '../services/paymentFees.js'
import {
  buildPayuPaymentParams,
  generatePayuTxnId,
  getPayuPaymentUrl,
  validateResponseHash,
} from '../services/payu.js'
import { resolveProductPrice, validateCoupon } from '../services/pricing.js'

function normalizePayuStatus(status) {
  const value = String(status ?? '').toLowerCase()
  if (value === 'success') return 'success'
  if (value === 'failure' || value === 'failed') return 'failed'
  return 'cancelled'
}

export async function checkoutRoutes(app) {
  const razorpay = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret,
  })

  if (!app.hasContentTypeParser('application/x-www-form-urlencoded')) {
    app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (request, body, done) => {
      try {
        done(null, Object.fromEntries(new URLSearchParams(body)))
      } catch (error) {
        done(error)
      }
    })
  }

  async function buildCartTotals(sessionId) {
    const cart = await Cart.findOne({ sessionId })
    if (!cart) throw app.httpErrors.notFound('Cart not found')
    const items = await CartItem.find({ cartId: cart._id })

    const lineItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.productId)
        const pricing = await resolveProductPrice(product, {
          countryCode: cart.countryCode,
          currency: cart.currency,
          variantId: item.variantId,
          quantity: item.quantity,
        })
        return {
          ...mapId(item),
          product,
          unitPrice: pricing.unitPrice,
          lineTotal: pricing.unitPrice * item.quantity,
        }
      }),
    )

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)
    let discount = 0
    if (cart.couponCode) {
      const couponResult = await validateCoupon(cart.couponCode, {
        subtotal,
        countryCode: cart.countryCode,
        productIds: lineItems.map((i) => i.productId?.toString?.() ?? i.productId),
      })
      if (couponResult.valid) discount = couponResult.discount
    }

    return { cart, lineItems, subtotal, discount, total: subtotal - discount }
  }

  app.post('/api/checkout/create-order', async (request) => {
    const billingSchema = z.object({
      firstName: z.string().trim().min(1, 'First name is required'),
      lastName: z.string().trim().min(1, 'Last name is required'),
      countryCode: z.string().length(2),
      streetAddress: z.string().trim().min(1, 'Street address is required'),
      addressLine2: z.string().trim().optional(),
      city: z.string().trim().min(1, 'Town / City is required'),
      state: z.string().trim().min(1, 'State is required'),
      postalCode: z.string().trim().min(1, 'PIN / Postal code is required'),
      orderNotes: z.string().trim().optional(),
    })

    const schema = z.object({
      customerEmail: z.string().email(),
      customerPhone: z.string().optional(),
      billing: billingSchema,
      paymentMethod: z.string().default('razorpay'),
      affiliateCode: z.string().optional(),
      useWallet: z.boolean().optional(),
      termsAccepted: z.literal(true, {
        error: 'You must accept the terms and conditions',
      }),
    })
    const payload = schema.parse(request.body)
    const sessionId = request.headers['x-session-id']
    if (!sessionId) throw app.httpErrors.badRequest('Session required')

    const { cart, lineItems, subtotal, discount, total } = await buildCartTotals(sessionId)
    if (lineItems.length === 0) throw app.httpErrors.badRequest('Cart is empty')

    if (payload.billing.countryCode !== cart.countryCode) {
      cart.countryCode = payload.billing.countryCode
      await cart.save()
    }

    let userId = null
    try {
      await request.jwtVerify()
      userId = request.user.sub
    } catch {
      /* guest checkout */
    }

    let affiliateId = null
    if (payload.affiliateCode) {
      const aff = await Affiliate.findOne({ code: payload.affiliateCode })
      if (aff) affiliateId = aff._id
    }

    let walletApplied = 0
    if (payload.useWallet && userId) {
      const user = await User.findById(userId)
      walletApplied = Math.min(user?.walletBalance ?? 0, total)
    }

    const payable = total - walletApplied
    const confirmationCode = generateConfirmationCode()
    const paymentMethods = COUNTRY_PAYMENTS[cart.countryCode] ?? COUNTRY_PAYMENTS.default

    if (!paymentMethods.includes(payload.paymentMethod) && payload.paymentMethod !== 'wallet') {
      throw app.httpErrors.badRequest('Payment method not available in your country')
    }

    let razorpayOrderId = null
    let payuTxnId = null
    if (payable > 0 && payload.paymentMethod === 'razorpay') {
      const razorpayOrder = await razorpay.orders.create({
        amount: payable * 100,
        currency: cart.currency === 'INR' ? 'INR' : 'USD',
        receipt: `es-${Date.now()}`,
        notes: { customerEmail: payload.customerEmail },
      })
      razorpayOrderId = razorpayOrder.id
    }

    if (payable > 0 && payload.paymentMethod === 'payu') {
      if (cart.currency !== 'INR') {
        throw app.httpErrors.badRequest('PayU is only available for INR payments')
      }
      if (!config.payuMerchantKey || !config.payuMerchantSalt) {
        throw app.httpErrors.badRequest('PayU is not configured')
      }
      payuTxnId = generatePayuTxnId()
    }

    const order = await Order.create({
      userId,
      sessionId,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
      countryCode: payload.billing.countryCode,
      currency: cart.currency,
      subtotal,
      discount,
      total: payable,
      couponCode: cart.couponCode,
      paymentStatus: payable === 0 ? 'paid' : 'created',
      paymentMethod: payload.paymentMethod,
      razorpayOrderId,
      payuTxnId,
      confirmationCode,
      affiliateId,
      productId: lineItems[0]?.productId,
      amount: payable,
      orderNotes: payload.billing.orderNotes,
      billing: {
        firstName: payload.billing.firstName,
        lastName: payload.billing.lastName,
        streetAddress: payload.billing.streetAddress,
        addressLine2: payload.billing.addressLine2,
        city: payload.billing.city,
        state: payload.billing.state,
        postalCode: payload.billing.postalCode,
      },
    })

    await ConfirmationCode.create({
      orderId: order._id,
      code: confirmationCode,
      type: 'order',
    })

    for (const item of lineItems) {
      await OrderItem.create({
        orderId: order._id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })
    }

    if (cart.couponCode) {
      const coupon = await Coupon.findOne({ code: cart.couponCode })
      if (coupon) {
        coupon.usedCount += 1
        await coupon.save()
      }
    }

    const response = {
      order: { id: order._id.toString(), total: payable, paymentStatus: payable === 0 ? 'paid' : 'created', confirmationCode },
      paymentMethod: payload.paymentMethod,
      razorpayOrderId,
      keyId: config.razorpayKeyId,
      currency: cart.currency,
      amount: payable,
      walletApplied,
    }

    if (payload.paymentMethod === 'payu' && payable > 0) {
      const productinfo = lineItems.map((item) => item.product.name).join(', ')
      const callbackUrl = `${config.apiPublicUrl}/api/checkout/payu/callback`
      response.payu = {
        action: getPayuPaymentUrl(),
        params: buildPayuPaymentParams({
          txnid: payuTxnId,
          amount: payable,
          productinfo,
          firstname: payload.billing.firstName,
          email: payload.customerEmail,
          phone: payload.customerPhone ?? '',
          udf1: order._id.toString(),
          surl: callbackUrl,
          furl: callbackUrl,
          address1: payload.billing.streetAddress,
          city: payload.billing.city,
          state: payload.billing.state,
          country: payload.billing.countryCode,
          zipcode: payload.billing.postalCode,
        }),
      }
    }

    return response
  })

  app.post('/api/checkout/verify', async (request) => {
    const schema = z.object({
      orderId: z.string(),
      razorpayOrderId: z.string().optional(),
      razorpayPaymentId: z.string().optional(),
      razorpaySignature: z.string().optional(),
    })
    const payload = schema.parse(request.body)

    const order = await Order.findById(payload.orderId)
    if (!order) throw app.httpErrors.notFound('Order not found')

    if (isGatewayPaymentConfirmed(order)) {
      const delivery = await fulfillPaidOrder(order)
      return { success: true, alreadyPaid: true, delivery }
    }

    if (order.paymentMethod === 'razorpay' && order.total > 0) {
      if (!payload.razorpayPaymentId || !payload.razorpayOrderId || !payload.razorpaySignature) {
        throw app.httpErrors.badRequest('Payment verification required')
      }
      if (payload.razorpayOrderId !== order.razorpayOrderId) {
        throw app.httpErrors.badRequest('Order mismatch')
      }
      const body = `${payload.razorpayOrderId}|${payload.razorpayPaymentId}`
      const expected = crypto
        .createHmac('sha256', config.razorpayKeySecret)
        .update(body)
        .digest('hex')
      if (expected !== payload.razorpaySignature) {
        throw app.httpErrors.unauthorized('Invalid payment signature')
      }

      await verifyRazorpayPaymentCaptured(payload.razorpayPaymentId, order.razorpayOrderId)

      const delivery = await fulfillPaidOrder(order, {
        razorpayPaymentId: payload.razorpayPaymentId,
      })

      return { success: true, delivery }
    }

    if (order.total === 0 && (order.paymentMethod === 'wallet' || order.paymentStatus === 'paid')) {
      const delivery = await fulfillPaidOrder(order)
      return { success: true, delivery }
    }

    throw app.httpErrors.badRequest('Payment has not been completed')
  })

  app.post('/api/checkout/cancel-payment', async (request) => {
    const schema = z.object({
      orderId: z.string(),
      reason: z.string().max(200).optional(),
    })
    const payload = schema.parse(request.body ?? {})
    const order = await Order.findById(payload.orderId)
    if (!order) throw app.httpErrors.notFound('Order not found')

    if (isGatewayPaymentConfirmed(order)) {
      throw app.httpErrors.badRequest('This order is already paid and cannot be cancelled')
    }

    await markOrderPaymentCancelled(order, { persist: true, reason: payload.reason ?? 'Payment cancelled' })
    return { success: true, orderId: order._id.toString(), paymentStatus: order.paymentStatus }
  })

  app.post('/api/checkout/payu/callback', async (request, reply) => {
    const body = request.body ?? {}
    const redirectBase = config.clientUrl

    const orderId = body.udf1
    const order = orderId
      ? await Order.findById(orderId)
      : await Order.findOne({ payuTxnId: body.txnid })

    if (!order) {
      return reply.redirect(`${redirectBase}/checkout?payu=not_found`)
    }

    if (!validateResponseHash(body, config.payuMerchantSalt)) {
      app.log.warn({ txnid: body.txnid }, 'PayU hash validation failed')
      return reply.redirect(`${redirectBase}/checkout?payu=invalid`)
    }

    if (body.txnid && order.payuTxnId && body.txnid !== order.payuTxnId) {
      return reply.redirect(`${redirectBase}/checkout?payu=mismatch`)
    }

    if (body.status !== 'success') {
      if (!isGatewayPaymentConfirmed(order)) {
        order.paymentStatus = 'cancelled'
        order.orderStatus = 'cancelled'
        order.gatewayPaymentStatus = normalizePayuStatus(body.status)
        await order.save()
      }
      return reply.redirect(`${redirectBase}/checkout?payu=failed&orderId=${order._id}`)
    }

    try {
      await fulfillPaidOrder(order, { payuPaymentId: body.mihpayid ?? body.payuMoneyId })
    } catch (error) {
      app.log.error({ err: error, orderId: order._id }, 'PayU fulfillment failed')
      return reply.redirect(`${redirectBase}/checkout?payu=error&orderId=${order._id}`)
    }

    const code = encodeURIComponent(order.confirmationCode ?? '')
    return reply.redirect(`${redirectBase}/checkout/complete?orderId=${order._id}&code=${code}`)
  })

  app.get('/api/checkout/result/:orderId', async (request, reply) => {
    const order = await Order.findById(request.params.orderId)
    if (!order) return reply.notFound('Order not found')

    const sessionId = request.headers['x-session-id']
    let authorized = sessionId && order.sessionId === sessionId

    if (!authorized) {
      try {
        await request.jwtVerify()
        const user = await User.findById(request.user.sub)
        authorized =
          order.userId?.toString() === request.user.sub ||
          order.customerEmail === user?.email
      } catch {
        authorized = false
      }
    }

    if (!authorized) return reply.forbidden('Not allowed to view this order')

    if (order.paymentMethod === 'razorpay' && (order.razorpayPaymentId || order.paymentStatus === 'paid')) {
      await reconcileOrderPayment(order, { persist: true })
    }

    if (!isGatewayPaymentConfirmed(order)) {
      return {
        paid: false,
        paymentStatus: order.paymentStatus,
        gatewayPaymentStatus: order.gatewayPaymentStatus ?? null,
        cancelled: order.paymentStatus === 'cancelled' || order.orderStatus === 'cancelled',
      }
    }

    const items = await OrderItem.find({ orderId: order._id })
    return {
      paid: true,
      delivery: {
        confirmationCode: order.confirmationCode,
        licenseKey: order.licenseKey ?? items[0]?.licenseKey ?? null,
        items: items.map((item) => ({
          productName: item.productName,
          licenseKey: item.licenseKey,
        })),
        emailDelivered: order.emailSent,
      },
    }
  })

  app.post('/api/orders/lookup', async (request) => {
    const { email, confirmationCode } = request.body ?? {}
    try {
      const orders = await lookupOrdersByEmail(email, { confirmationCode })
      return { orders }
    } catch (error) {
      throw app.httpErrors.notFound(error.message ?? 'No orders found')
    }
  })

  app.get('/api/orders', { preHandler: [app.authenticate] }, async (request) => {
    const user = await User.findById(request.user.sub)
    if (!user) throw app.httpErrors.notFound('User not found')
    const orders = await listOrdersForUser(user)
    return { orders }
  })

  app.get('/api/orders/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await User.findById(request.user.sub)
    if (!user) throw app.httpErrors.notFound('User not found')

    const order = await Order.findById(request.params.id)
    if (!order) return reply.notFound('Order not found')

    const ownsOrder =
      order.userId?.toString() === user._id.toString() || order.customerEmail === user.email
    if (!ownsOrder) return reply.forbidden('Not your order')

    const items = await OrderItem.find({ orderId: order._id })
    return { order: mapId(order), items: items.map(mapId) }
  })
}
