import Razorpay from 'razorpay'
import { config } from '../config.js'
import { fromStripeAmount } from './stripe.js'

const GATEWAY_LABELS = {
  razorpay: 'Razorpay',
  payu: 'PayU',
  stripe: 'Stripe',
  wallet: 'Wallet',
}

const CONFIRMED_GATEWAY_STATUSES = new Set(['captured', 'success', 'paid', 'wallet'])
const CANCELLED_GATEWAY_STATUSES = new Set(['cancelled', 'canceled', 'failed'])
const BLOCKED_ORDER_STATUSES = new Set(['cancelled', 'canceled'])

function normalizeStatus(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function isPaymentCancelledOrFailed(order) {
  const paymentStatus = normalizeStatus(order.paymentStatus)
  const orderStatus = normalizeStatus(order.orderStatus)
  const gatewayStatus = normalizeStatus(order.gatewayPaymentStatus)

  if (['cancelled', 'canceled', 'failed'].includes(paymentStatus)) return true
  if (BLOCKED_ORDER_STATUSES.has(orderStatus)) return true
  if (CANCELLED_GATEWAY_STATUSES.has(gatewayStatus)) return true
  return false
}

export async function markOrderPaymentCancelled(order, { persist = true, reason = 'Payment cancelled' } = {}) {
  if (order.paymentStatus === 'paid' && order.gatewayPaymentStatus === 'captured') {
    return { updated: false, reason: 'Order is already paid' }
  }

  order.paymentStatus = 'cancelled'
  order.orderStatus = 'cancelled'
  order.gatewayPaymentStatus = 'cancelled'
  clearStoredPaymentFees(order)
  if (persist) await order.save()

  return { updated: true, reason }
}

function pendingPaymentMessage(order) {
  const status = normalizeStatus(order.gatewayPaymentStatus ?? order.paymentStatus ?? 'pending')
  if (status === 'cancelled' || status === 'canceled') return 'Payment was cancelled'
  if (status === 'authorized') return 'Payment authorized but not captured yet'
  if (status === 'created') return 'Awaiting customer payment'
  if (status === 'failed') return 'Payment failed at gateway'
  if (status === 'missing') return 'Awaiting Razorpay payment'
  return 'This order has not received a confirmed payment from the gateway yet.'
}

function clearStoredPaymentFees(order) {
  order.amountPaid = undefined
  order.gatewayFee = undefined
  order.gatewayTax = undefined
  order.netPayout = undefined
  order.feeProvider = undefined
}

function roundMoney(value) {
  return Math.round(Number(value ?? 0) * 100) / 100
}

function getRazorpayClient() {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) return null
  return new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret,
  })
}

function estimateFees(amountPaid, method) {
  const paid = roundMoney(amountPaid)
  if (!paid || paid <= 0) {
    return {
      amountPaid: paid,
      gatewayFee: 0,
      gatewayTax: 0,
      netPayout: paid,
      feeProvider: GATEWAY_LABELS[method] ?? method ?? 'Unknown',
      feeSource: 'estimated',
    }
  }

  if (method === 'wallet') {
    return {
      amountPaid: paid,
      gatewayFee: 0,
      gatewayTax: 0,
      netPayout: paid,
      feeProvider: 'Wallet',
      feeSource: 'estimated',
    }
  }

  if (method === 'stripe') {
    const fee = roundMoney(paid * 0.029 + 0.3)
    return {
      amountPaid: paid,
      gatewayFee: fee,
      gatewayTax: 0,
      netPayout: roundMoney(paid - fee),
      feeProvider: 'Stripe',
      feeSource: 'estimated',
    }
  }

  if (method === 'payu') {
    const fee = roundMoney(paid * 0.02)
    const tax = roundMoney(fee * 0.18)
    return {
      amountPaid: paid,
      gatewayFee: fee,
      gatewayTax: tax,
      netPayout: roundMoney(paid - fee - tax),
      feeProvider: 'PayU',
      feeSource: 'estimated',
    }
  }

  const fee = roundMoney(paid * 0.02)
  const tax = roundMoney(fee * 0.18)
  return {
    amountPaid: paid,
    gatewayFee: fee,
    gatewayTax: tax,
    netPayout: roundMoney(paid - fee - tax),
    feeProvider: GATEWAY_LABELS[method] ?? 'Razorpay',
    feeSource: 'estimated',
  }
}

async function fetchRazorpayPayment(paymentId) {
  const rzp = getRazorpayClient()
  if (!rzp || !paymentId) return null
  try {
    return await rzp.payments.fetch(paymentId)
  } catch {
    return null
  }
}

function breakdownFromRazorpayPayment(payment, fallbackAmount) {
  const amountPaid = roundMoney((payment.amount ?? 0) / 100) || fallbackAmount
  const gatewayFee = roundMoney((payment.fee ?? 0) / 100)
  const gatewayTax = roundMoney((payment.tax ?? 0) / 100)

  return {
    amountPaid,
    gatewayFee,
    gatewayTax,
    netPayout: roundMoney(amountPaid - gatewayFee - gatewayTax),
    feeProvider: 'Razorpay',
    feeSource: payment.fee != null ? 'api' : 'estimated',
    gatewayPaymentStatus: payment.status,
  }
}

async function fetchRazorpayFees(paymentId, fallbackAmount) {
  const payment = await fetchRazorpayPayment(paymentId)
  if (!payment) return estimateFees(fallbackAmount, 'razorpay')
  return breakdownFromRazorpayPayment(payment, fallbackAmount)
}

async function fetchStripeFees(chargeId, paymentIntentId, fallbackAmount) {
  if (!config.stripeSecretKey) return estimateFees(fallbackAmount, 'stripe')

  try {
    const id = chargeId || paymentIntentId
    if (!id) return estimateFees(fallbackAmount, 'stripe')

    const path = chargeId
      ? `charges/${chargeId}?expand[]=balance_transaction`
      : `payment_intents/${paymentIntentId}?expand[]=latest_charge.balance_transaction`

    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${config.stripeSecretKey}` },
    })
    const data = await response.json()
    if (!response.ok) return estimateFees(fallbackAmount, 'stripe')

    const charge = data.object === 'charge' ? data : data.latest_charge
    const currency = (charge?.currency || data.currency || 'usd').toUpperCase()
    const bt = typeof charge?.balance_transaction === 'object' ? charge.balance_transaction : null
    const amountPaid = roundMoney(fromStripeAmount(charge?.amount ?? data.amount ?? 0, currency)) || fallbackAmount
    const gatewayFee = roundMoney(fromStripeAmount(bt?.fee ?? 0, currency))
    const netPayout =
      roundMoney(fromStripeAmount(bt?.net ?? charge?.amount ?? 0, currency)) || roundMoney(amountPaid - gatewayFee)

    return {
      amountPaid,
      gatewayFee,
      gatewayTax: 0,
      netPayout,
      feeProvider: 'Stripe',
      feeSource: bt?.fee != null ? 'api' : 'estimated',
      gatewayPaymentStatus: charge?.status === 'succeeded' ? 'succeeded' : (charge?.status ?? 'paid'),
    }
  } catch {
    return estimateFees(fallbackAmount, 'stripe')
  }
}

export function hasPaymentProof(order) {
  const method = (order.paymentMethod ?? '').toLowerCase()
  if (method === 'wallet' && roundMoney(order.total) === 0) return true
  if (method === 'razorpay') return Boolean(order.razorpayPaymentId)
  if (method === 'payu') return Boolean(order.payuPaymentId)
  if (method === 'stripe') return Boolean(order.stripeChargeId || order.stripePaymentId)
  return false
}

export function isGatewayPaymentConfirmed(order) {
  if (order.paymentStatus !== 'paid') return false
  if (isPaymentCancelledOrFailed(order)) return false

  const gatewayStatus = normalizeStatus(order.gatewayPaymentStatus)
  const method = normalizeStatus(order.paymentMethod)

  if (method === 'razorpay') {
    return gatewayStatus === 'captured' && Boolean(order.razorpayPaymentId)
  }
  if (method === 'payu') {
    return gatewayStatus === 'success' && Boolean(order.payuPaymentId)
  }
  if (method === 'stripe') {
    return ['paid', 'succeeded'].includes(gatewayStatus) && Boolean(order.stripeChargeId || order.stripePaymentId)
  }
  if (method === 'wallet' && roundMoney(order.total) === 0) {
    return gatewayStatus === 'wallet' || gatewayStatus === 'paid'
  }

  return gatewayStatus && CONFIRMED_GATEWAY_STATUSES.has(gatewayStatus)
}

export async function reconcileOrderPayment(order, { persist = true } = {}) {
  const method = (order.paymentMethod ?? '').toLowerCase()
  const amount = roundMoney(order.total)

  if (method === 'razorpay') {
    if (!order.razorpayPaymentId) {
    if (persist && order.paymentStatus === 'paid') {
      order.paymentStatus = 'created'
      order.orderStatus = order.orderStatus === 'completed' ? 'processing' : (order.orderStatus ?? 'pending')
      clearStoredPaymentFees(order)
      await order.save()
    }
      return {
        paymentConfirmed: false,
        paymentStatus: order.paymentStatus,
        gatewayPaymentStatus: 'missing',
        message: 'Awaiting Razorpay payment',
      }
    }

    const payment = await fetchRazorpayPayment(order.razorpayPaymentId)
    if (!payment) {
      return {
        paymentConfirmed: false,
        paymentStatus: order.paymentStatus,
        gatewayPaymentStatus: order.gatewayPaymentStatus ?? 'unknown',
        message: 'Could not verify payment with Razorpay',
      }
    }

    const gatewayStatus = payment.status
    const breakdown = breakdownFromRazorpayPayment(payment, amount)

    if (gatewayStatus === 'captured') {
      order.paymentStatus = 'paid'
      order.gatewayPaymentStatus = 'captured'
      order.paidAt = order.paidAt ?? new Date((payment.created_at ?? Date.now() / 1000) * 1000)
      order.amountPaid = breakdown.amountPaid
      order.gatewayFee = breakdown.gatewayFee
      order.gatewayTax = breakdown.gatewayTax
      order.netPayout = breakdown.netPayout
      order.feeProvider = breakdown.feeProvider
      if (persist) await order.save()

      return {
        paymentConfirmed: true,
        paymentStatus: 'paid',
        gatewayPaymentStatus: 'captured',
        ...breakdown,
        currency: order.currency ?? 'INR',
        feeSource: breakdown.feeSource,
      }
    }

    if (['failed', 'refunded'].includes(gatewayStatus) || CANCELLED_GATEWAY_STATUSES.has(gatewayStatus)) {
      order.paymentStatus = gatewayStatus === 'refunded' ? 'refunded' : gatewayStatus === 'failed' ? 'failed' : 'cancelled'
      order.orderStatus = gatewayStatus === 'refunded' ? 'refunded' : 'cancelled'
      order.gatewayPaymentStatus = gatewayStatus
      clearStoredPaymentFees(order)
      if (persist) await order.save()
      return {
        paymentConfirmed: false,
        paymentStatus: order.paymentStatus,
        gatewayPaymentStatus: gatewayStatus,
        message:
          gatewayStatus === 'failed'
            ? 'Payment failed at gateway'
            : gatewayStatus === 'refunded'
              ? 'Payment refunded at gateway'
              : 'Payment was cancelled',
      }
    }

    if (persist) {
      order.paymentStatus = 'created'
      order.orderStatus = order.orderStatus === 'completed' ? 'processing' : (order.orderStatus ?? 'pending')
      order.gatewayPaymentStatus = gatewayStatus
      clearStoredPaymentFees(order)
      await order.save()
    }

    const message =
      gatewayStatus === 'authorized' ? 'Payment authorized but not captured yet' : 'Payment not completed'

    return {
      paymentConfirmed: false,
      paymentStatus: 'created',
      gatewayPaymentStatus: gatewayStatus,
      message,
    }
  }

  if (method === 'payu' && order.payuPaymentId && order.paymentStatus === 'paid') {
    const breakdown = estimateFees(amount, 'payu')
    order.gatewayPaymentStatus = order.gatewayPaymentStatus ?? 'success'
    if (persist) await order.save()
    return {
      paymentConfirmed: true,
      paymentStatus: 'paid',
      gatewayPaymentStatus: 'success',
      ...breakdown,
      currency: order.currency ?? 'INR',
    }
  }

  if (method === 'wallet' && amount === 0 && order.paymentStatus === 'paid') {
    return {
      paymentConfirmed: true,
      paymentStatus: 'paid',
      gatewayPaymentStatus: 'wallet',
      ...estimateFees(amount, 'wallet'),
      currency: order.currency ?? 'INR',
    }
  }

  return {
    paymentConfirmed: false,
    paymentStatus: order.paymentStatus,
    gatewayPaymentStatus: order.gatewayPaymentStatus ?? 'pending',
    message: 'Payment not completed',
  }
}

export async function captureOrderPaymentFees(order, { razorpayPaymentId, payuPaymentId } = {}) {
  const amount = roundMoney(order.total)
  const method = (order.paymentMethod ?? 'razorpay').toLowerCase()
  let breakdown

  if (method === 'razorpay') {
    const payment = await fetchRazorpayPayment(razorpayPaymentId || order.razorpayPaymentId)
    if (!payment || payment.status !== 'captured') {
      throw new Error('Razorpay payment is not captured yet')
    }
    breakdown = breakdownFromRazorpayPayment(payment, amount)
    order.gatewayPaymentStatus = 'captured'
    order.paidAt = new Date((payment.created_at ?? Date.now() / 1000) * 1000)
  } else if (method === 'stripe') {
    breakdown = await fetchStripeFees(order.stripeChargeId, order.stripePaymentId, amount)
    order.gatewayPaymentStatus = breakdown.gatewayPaymentStatus ?? 'paid'
    order.paidAt = order.paidAt ?? new Date()
  } else if (method === 'payu') {
    breakdown = estimateFees(amount, 'payu')
    order.gatewayPaymentStatus = 'success'
    order.paidAt = order.paidAt ?? new Date()
  } else {
    breakdown = estimateFees(amount, method)
    order.gatewayPaymentStatus = 'wallet'
    order.paidAt = order.paidAt ?? new Date()
  }

  order.amountPaid = breakdown.amountPaid
  order.gatewayFee = breakdown.gatewayFee
  order.gatewayTax = breakdown.gatewayTax
  order.netPayout = breakdown.netPayout
  order.feeProvider = breakdown.feeProvider

  return breakdown
}

export async function verifyRazorpayPaymentCaptured(paymentId, expectedOrderId) {
  const payment = await fetchRazorpayPayment(paymentId)
  if (!payment) throw new Error('Payment not found at Razorpay')
  if (payment.status !== 'captured') {
    throw new Error(`Payment is ${payment.status}, not captured`)
  }
  if (expectedOrderId && payment.order_id) {
    return { payment, captured: true }
  }
  return { payment, captured: true }
}

export function resolveOrderPaymentBreakdown(order) {
  if (!isGatewayPaymentConfirmed(order)) {
    return {
      paymentConfirmed: false,
      amountPaid: 0,
      gatewayFee: 0,
      gatewayTax: 0,
      netPayout: 0,
      feeProvider: GATEWAY_LABELS[order.paymentMethod] ?? order.paymentMethod ?? '—',
      gatewayPaymentStatus: order.gatewayPaymentStatus ?? order.paymentStatus ?? 'pending',
      message: pendingPaymentMessage(order),
      currency: order.currency ?? 'INR',
    }
  }

  if (order.amountPaid != null && order.netPayout != null) {
    return {
      paymentConfirmed: true,
      amountPaid: roundMoney(order.amountPaid),
      gatewayFee: roundMoney(order.gatewayFee ?? 0),
      gatewayTax: roundMoney(order.gatewayTax ?? 0),
      netPayout: roundMoney(order.netPayout),
      feeProvider: order.feeProvider ?? GATEWAY_LABELS[order.paymentMethod] ?? order.paymentMethod ?? '—',
      gatewayPaymentStatus: order.gatewayPaymentStatus ?? 'captured',
      feeSource: 'stored',
      currency: order.currency ?? 'INR',
    }
  }

  const estimated = estimateFees(order.total, (order.paymentMethod ?? '').toLowerCase())
  return {
    paymentConfirmed: true,
    ...estimated,
    gatewayPaymentStatus: order.gatewayPaymentStatus ?? 'captured',
    currency: order.currency ?? 'INR',
  }
}

export function summarizePaymentBreakdowns(breakdowns) {
  return breakdowns
    .filter((row) => row.paymentConfirmed)
    .reduce(
      (acc, row) => {
        acc.totalPaid += row.amountPaid ?? 0
        acc.totalFees += (row.gatewayFee ?? 0) + (row.gatewayTax ?? 0)
        acc.totalGatewayFee += row.gatewayFee ?? 0
        acc.totalGatewayTax += row.gatewayTax ?? 0
        acc.totalNetPayout += row.netPayout ?? 0
        return acc
      },
      {
        totalPaid: 0,
        totalFees: 0,
        totalGatewayFee: 0,
        totalGatewayTax: 0,
        totalNetPayout: 0,
      },
    )
}
