import crypto from 'node:crypto'
import { config } from '../config.js'

/** Currencies Stripe treats as zero-decimal (amount is already in major units). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

export function toStripeAmount(amount, currency) {
  const cur = String(currency ?? 'USD').toUpperCase()
  const value = Number(amount) || 0
  if (ZERO_DECIMAL_CURRENCIES.has(cur)) return Math.round(value)
  return Math.round(value * 100)
}

export function fromStripeAmount(amount, currency) {
  const cur = String(currency ?? 'USD').toUpperCase()
  const value = Number(amount) || 0
  if (ZERO_DECIMAL_CURRENCIES.has(cur)) return value
  return value / 100
}

function assertStripeConfigured() {
  if (!config.stripeSecretKey) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY on the server.')
  }
}

async function stripeRequest(method, path, params) {
  assertStripeConfigured()
  const url = `https://api.stripe.com/v1/${path}`
  const headers = {
    Authorization: `Bearer ${config.stripeSecretKey}`,
  }
  const options = { method, headers }

  if (params && (method === 'POST' || method === 'PUT')) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    options.body = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString()
  }

  const response = await fetch(url, options)
  const data = await response.json()
  if (!response.ok) {
    const message = data?.error?.message ?? `Stripe API error (${response.status})`
    const error = new Error(message)
    error.statusCode = response.status
    error.stripe = data?.error
    throw error
  }
  return data
}

/**
 * Hosted Stripe Checkout — cards, Apple Pay, Google Pay, and other methods enabled in the Dashboard.
 */
export async function createStripeCheckoutSession({
  orderId,
  amount,
  currency,
  customerEmail,
  productLabel,
  successUrl,
  cancelUrl,
}) {
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('success_url', successUrl)
  params.set('cancel_url', cancelUrl)
  params.set('client_reference_id', String(orderId))
  params.set('customer_email', customerEmail)
  params.set('metadata[orderId]', String(orderId))
  params.set('payment_intent_data[metadata][orderId]', String(orderId))
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', String(currency).toLowerCase())
  params.set('line_items[0][price_data][unit_amount]', String(toStripeAmount(amount, currency)))
  params.set('line_items[0][price_data][product_data][name]', productLabel || 'eSoftware Store order')
  params.set('line_items[0][price_data][product_data][description]', `Order ${orderId}`)

  return stripeRequest('POST', 'checkout/sessions', params)
}

export async function retrieveStripeCheckoutSession(sessionId, { expandPaymentIntent = true } = {}) {
  const path = expandPaymentIntent
    ? `checkout/sessions/${sessionId}?expand[]=payment_intent.latest_charge`
    : `checkout/sessions/${sessionId}`
  return stripeRequest('GET', path)
}

export async function retrieveStripePaymentIntent(paymentIntentId) {
  return stripeRequest('GET', `payment_intents/${paymentIntentId}?expand[]=latest_charge`)
}

export function extractStripePaymentRefs(sessionOrIntent) {
  let paymentIntent = sessionOrIntent?.payment_intent
  if (typeof paymentIntent === 'string') {
    return { stripePaymentId: paymentIntent, stripeChargeId: null }
  }
  if (!paymentIntent && sessionOrIntent?.object === 'payment_intent') {
    paymentIntent = sessionOrIntent
  }
  if (!paymentIntent) {
    return { stripePaymentId: null, stripeChargeId: null }
  }

  let charge = paymentIntent.latest_charge
  if (typeof charge === 'object' && charge?.id) {
    charge = charge.id
  }
  return {
    stripePaymentId: paymentIntent.id ?? null,
    stripeChargeId: typeof charge === 'string' ? charge : null,
  }
}

export function verifyStripeWebhookSignature(rawBody, signatureHeader) {
  assertStripeConfigured()
  if (!config.stripeWebhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }
  if (!signatureHeader || !rawBody) {
    throw new Error('Missing Stripe webhook signature')
  }

  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(',')
      .map((part) => part.split('='))
      .filter((pair) => pair.length === 2),
  )
  const timestamp = parts.t
  const expected = parts.v1
  if (!timestamp || !expected) {
    throw new Error('Invalid Stripe-Signature header')
  }

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (Number.isNaN(ageSec) || ageSec > 300) {
    throw new Error('Stripe webhook timestamp outside tolerance')
  }

  const payload = `${timestamp}.${typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')}`
  const computed = crypto
    .createHmac('sha256', config.stripeWebhookSecret)
    .update(payload, 'utf8')
    .digest('hex')

  const a = Buffer.from(computed, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid Stripe webhook signature')
  }

  return JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
}
