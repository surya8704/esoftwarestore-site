import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { config } from '../config.js'
import { User, WalletTransaction } from '../db/models.js'
import { isGatewayPaymentConfirmed } from './paymentFees.js'

function roundMoney(value) {
  return Math.round(Number(value ?? 0) * 100) / 100
}

export { roundMoney }

function sha512(value) {
  return crypto.createHash('sha512').update(value).digest('hex').toLowerCase()
}

function payuPostServiceUrl() {
  return config.payuEnv === 'production'
    ? 'https://info.payu.in/merchant/postservice?form=2'
    : 'https://test.payu.in/merchant/postservice?form=2'
}

function getRazorpayClient() {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    throw new Error('Razorpay is not configured')
  }
  return new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret,
  })
}

function parseGatewayError(error, fallback = 'Refund failed') {
  if (error?.error?.description) return error.error.description
  if (error?.description) return error.description
  if (error?.message) return error.message
  return fallback
}

export function getRefundableAmount(order) {
  if (order.paymentStatus === 'refunded') return 0
  if (!isGatewayPaymentConfirmed(order)) return 0
  const paid = roundMoney(order.amountPaid ?? order.total)
  const alreadyRefunded = roundMoney(order.refundAmount ?? 0)
  return roundMoney(Math.max(paid - alreadyRefunded, 0))
}

export function canProcessOrderRefund(order) {
  if (order.paymentStatus === 'refunded') {
    return { ok: false, reason: 'Order is already fully refunded' }
  }
  if (order.paymentStatus !== 'paid') {
    return { ok: false, reason: 'Only paid orders can be refunded' }
  }
  if (!isGatewayPaymentConfirmed(order)) {
    return { ok: false, reason: 'Payment is not confirmed at the gateway yet' }
  }
  const amount = getRefundableAmount(order)
  if (amount <= 0) {
    return { ok: false, reason: 'No refundable amount remaining on this order' }
  }
  return { ok: true, amount }
}

async function fetchRazorpayPayment(paymentId) {
  const rzp = getRazorpayClient()
  try {
    return await rzp.payments.fetch(paymentId)
  } catch (error) {
    throw new Error(parseGatewayError(error, 'Could not fetch payment from Razorpay'))
  }
}

async function refundViaRazorpay(order, amount, reason) {
  const paymentId = order.razorpayPaymentId
  if (!paymentId) throw new Error('Razorpay payment ID not found on this order')

  const payment = await fetchRazorpayPayment(paymentId)
  if (payment.status !== 'captured') {
    throw new Error(`Cannot refund: Razorpay payment is ${payment.status}, not captured`)
  }

  const capturedAmount = roundMoney((payment.amount ?? 0) / 100)
  const alreadyRefunded = roundMoney((payment.amount_refunded ?? 0) / 100)
  const remaining = roundMoney(capturedAmount - alreadyRefunded)

  if (remaining <= 0) {
    throw new Error('This payment is already fully refunded at Razorpay')
  }

  const refundAmount = roundMoney(Math.min(amount, remaining))
  const amountPaise = Math.round(refundAmount * 100)

  const rzp = getRazorpayClient()
  try {
    const refund = await rzp.payments.refund(paymentId, {
      amount: amountPaise,
      notes: {
        orderId: order._id.toString(),
        reason: reason || 'Admin refund',
      },
    })

    return {
      refundId: refund.id,
      gateway: 'razorpay',
      amount: refundAmount,
      gatewayStatus: refund.status ?? 'processed',
    }
  } catch (error) {
    throw new Error(parseGatewayError(error, 'Razorpay refund failed'))
  }
}

async function refundViaPayU(order, amount, reason) {
  const paymentId = order.payuPaymentId
  if (!paymentId) throw new Error('PayU payment ID not found on this order')
  if (!config.payuMerchantKey || !config.payuMerchantSalt) {
    throw new Error('PayU merchant credentials are not configured')
  }

  const command = 'cancel_refund_transaction'
  const var1 = paymentId
  const var2 = `REF-${order._id.toString().slice(-8)}-${Date.now()}`
  const var3 = Number(amount).toFixed(2)
  const hash = sha512(`${config.payuMerchantKey}|${command}|${var1}|${config.payuMerchantSalt}`)

  const body = new URLSearchParams({
    key: config.payuMerchantKey,
    command,
    var1,
    var2,
    var3,
    hash,
  })

  const response = await fetch(payuPostServiceUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`PayU refund failed: ${text.slice(0, 200)}`)
  }

  if (data.status !== 1 && data.status !== '1') {
    throw new Error(data.msg ?? data.message ?? 'PayU refund request failed')
  }

  return {
    refundId: data.request_id ?? var2,
    gateway: 'payu',
    amount: roundMoney(amount),
    gatewayStatus: 'requested',
    raw: data,
  }
}

async function refundViaStripe(order, amount) {
  if (!config.stripeSecretKey) throw new Error('Stripe is not configured')

  const chargeId = order.stripeChargeId
  const paymentIntentId = order.stripePaymentId
  if (!chargeId && !paymentIntentId) throw new Error('Stripe payment reference not found on this order')

  const params = new URLSearchParams()
  if (chargeId) params.set('charge', chargeId)
  else params.set('payment_intent', paymentIntentId)
  params.set('amount', String(Math.round(amount * 100)))

  const response = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Stripe refund failed')
  }

  return {
    refundId: data.id,
    gateway: 'stripe',
    amount: roundMoney(amount),
    gatewayStatus: data.status ?? 'succeeded',
  }
}

async function refundViaWallet(order, amount) {
  if (order.userId) {
    await User.findByIdAndUpdate(order.userId, { $inc: { walletBalance: amount } })
    await WalletTransaction.create({
      userId: order.userId,
      amount,
      type: 'refund',
      reference: `order-${order._id}`,
    })
  }

  return {
    refundId: `wallet-${Date.now()}`,
    gateway: 'wallet',
    amount: roundMoney(amount),
    gatewayStatus: 'credited',
  }
}

export async function processOrderRefund(order, { amount, reason } = {}) {
  const eligibility = canProcessOrderRefund(order)
  if (!eligibility.ok) throw new Error(eligibility.reason)

  const maxRefundable = eligibility.amount
  const refundAmount = roundMoney(amount ?? maxRefundable)

  if (refundAmount <= 0) throw new Error('Refund amount must be greater than zero')
  if (refundAmount > maxRefundable) {
    throw new Error(`Refund amount cannot exceed ${maxRefundable}`)
  }

  const method = (order.paymentMethod ?? '').toLowerCase()
  let result

  if (method === 'razorpay') {
    result = await refundViaRazorpay(order, refundAmount, reason)
  } else if (method === 'payu') {
    result = await refundViaPayU(order, refundAmount, reason)
  } else if (method === 'stripe') {
    result = await refundViaStripe(order, refundAmount)
  } else if (method === 'wallet') {
    result = await refundViaWallet(order, refundAmount)
  } else {
    throw new Error(`Refunds are not supported for payment method: ${method || 'unknown'}`)
  }

  return { ...result, reason: reason ?? '' }
}
