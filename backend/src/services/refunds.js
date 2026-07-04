import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { config } from '../config.js'

function sha512(value) {
  return crypto.createHash('sha512').update(value).digest('hex').toLowerCase()
}

function payuPostServiceUrl() {
  return config.payuEnv === 'production'
    ? 'https://info.payu.in/merchant/postservice?form=2'
    : 'https://test.payu.in/merchant/postservice?form=2'
}

async function refundViaRazorpay(order, amount) {
  const rzp = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret,
  })

  const paymentId = order.razorpayPaymentId
  if (!paymentId) throw new Error('Razorpay payment ID not found on this order')

  const amountPaise = Math.round(amount * 100)
  const refund = await rzp.payments.refund(paymentId, {
    amount: amountPaise,
    notes: { orderId: order._id.toString(), reason: 'Admin refund' },
  })

  return { refundId: refund.id, gateway: 'razorpay' }
}

async function refundViaPayU(order, amount) {
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

  return { refundId: var2, gateway: 'payu', raw: data }
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

  return { refundId: data.id, gateway: 'stripe' }
}

export async function processOrderRefund(order, { amount, reason }) {
  const refundAmount = amount ?? order.total
  if (refundAmount <= 0) throw new Error('Refund amount must be greater than zero')
  if (refundAmount > order.total) throw new Error('Refund amount cannot exceed order total')
  if (order.paymentStatus === 'refunded') throw new Error('Order is already refunded')

  const method = (order.paymentMethod ?? '').toLowerCase()
  let result

  if (method === 'razorpay') {
    result = await refundViaRazorpay(order, refundAmount)
  } else if (method === 'payu') {
    result = await refundViaPayU(order, refundAmount)
  } else if (method === 'stripe') {
    result = await refundViaStripe(order, refundAmount)
  } else if (method === 'wallet') {
    result = { refundId: `wallet-${Date.now()}`, gateway: 'wallet' }
  } else {
    throw new Error(`Refunds are not supported for payment method: ${method || 'unknown'}`)
  }

  return { ...result, amount: refundAmount, reason }
}
