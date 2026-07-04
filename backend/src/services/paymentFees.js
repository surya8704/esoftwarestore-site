import Razorpay from 'razorpay'
import { config } from '../config.js'

const GATEWAY_LABELS = {
  razorpay: 'Razorpay',
  payu: 'PayU',
  stripe: 'Stripe',
  wallet: 'Wallet',
}

function roundMoney(value) {
  return Math.round(Number(value ?? 0) * 100) / 100
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

async function fetchRazorpayFees(paymentId, fallbackAmount) {
  if (!config.razorpayKeyId || !config.razorpayKeySecret || !paymentId) {
    return estimateFees(fallbackAmount, 'razorpay')
  }

  try {
    const rzp = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret,
    })
    const payment = await rzp.payments.fetch(paymentId)
    const amountPaid = roundMoney((payment.amount ?? 0) / 100)
    const gatewayFee = roundMoney((payment.fee ?? 0) / 100)
    const gatewayTax = roundMoney((payment.tax ?? 0) / 100)

    return {
      amountPaid: amountPaid || fallbackAmount,
      gatewayFee,
      gatewayTax,
      netPayout: roundMoney((amountPaid || fallbackAmount) - gatewayFee - gatewayTax),
      feeProvider: 'Razorpay',
      feeSource: payment.fee != null ? 'api' : 'estimated',
    }
  } catch {
    return estimateFees(fallbackAmount, 'razorpay')
  }
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
    const bt = typeof charge?.balance_transaction === 'object' ? charge.balance_transaction : null
    const amountPaid = roundMoney((charge?.amount ?? data.amount ?? 0) / 100) || fallbackAmount
    const gatewayFee = roundMoney((bt?.fee ?? 0) / 100)
    const netPayout = roundMoney((bt?.net ?? charge?.amount ?? 0) / 100) || roundMoney(amountPaid - gatewayFee)

    return {
      amountPaid,
      gatewayFee,
      gatewayTax: 0,
      netPayout,
      feeProvider: 'Stripe',
      feeSource: bt?.fee != null ? 'api' : 'estimated',
    }
  } catch {
    return estimateFees(fallbackAmount, 'stripe')
  }
}

export async function captureOrderPaymentFees(order, { razorpayPaymentId, payuPaymentId } = {}) {
  const amount = roundMoney(order.total)
  const method = (order.paymentMethod ?? 'razorpay').toLowerCase()
  let breakdown

  if (method === 'razorpay') {
    breakdown = await fetchRazorpayFees(razorpayPaymentId || order.razorpayPaymentId, amount)
  } else if (method === 'stripe') {
    breakdown = await fetchStripeFees(order.stripeChargeId, order.stripePaymentId, amount)
  } else if (method === 'payu') {
    breakdown = estimateFees(amount, 'payu')
    breakdown.feeSource = payuPaymentId || order.payuPaymentId ? 'estimated' : 'estimated'
  } else {
    breakdown = estimateFees(amount, method)
  }

  order.amountPaid = breakdown.amountPaid
  order.gatewayFee = breakdown.gatewayFee
  order.gatewayTax = breakdown.gatewayTax
  order.netPayout = breakdown.netPayout
  order.feeProvider = breakdown.feeProvider

  return breakdown
}

export function resolveOrderPaymentBreakdown(order) {
  if (order.amountPaid != null && order.netPayout != null) {
    return {
      amountPaid: roundMoney(order.amountPaid),
      gatewayFee: roundMoney(order.gatewayFee ?? 0),
      gatewayTax: roundMoney(order.gatewayTax ?? 0),
      netPayout: roundMoney(order.netPayout),
      feeProvider: order.feeProvider ?? GATEWAY_LABELS[order.paymentMethod] ?? order.paymentMethod ?? '—',
      feeSource: 'stored',
      currency: order.currency ?? 'INR',
    }
  }

  const estimated = estimateFees(order.total, (order.paymentMethod ?? '').toLowerCase())
  return { ...estimated, currency: order.currency ?? 'INR' }
}

export function summarizePaymentBreakdowns(breakdowns) {
  return breakdowns.reduce(
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
