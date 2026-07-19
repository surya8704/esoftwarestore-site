import dotenv from 'dotenv'

dotenv.config()

function normalizeEmailFrom(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return 'eSoftware Store <info@esoftwarestore.com>'

  const bracketed = trimmed.match(/^(.+?)\s*<([^>]+@[^>]+)>$/)
  if (bracketed) return `${bracketed[1].trim()} <${bracketed[2].trim()}>`

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `eSoftware Store <${trimmed}>`
  }

  const loose = trimmed.match(/^(.+?)\s+([\w.%+-]+@[\w.-]+\.[a-z]{2,})$/i)
  if (loose) return `${loose[1].trim()} <${loose[2].trim()}>`

  return trimmed
}

function resolveEmailFrom() {
  if (process.env.RESEND_SANDBOX === '1' || process.env.RESEND_SANDBOX === 'true') {
    return 'eSoftware Store <onboarding@resend.dev>'
  }
  return normalizeEmailFrom(process.env.EMAIL_FROM ?? 'eSoftware Store <info@esoftwarestore.com>')
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  mongoUrl:
    process.env.MONGO_URL ??
    (process.env.DATABASE_URL?.startsWith('mongodb') ? process.env.DATABASE_URL : 'mongodb://127.0.0.1:27017/esoftwarestore'),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  payuMerchantKey: process.env.PAYU_MERCHANT_KEY ?? '',
  payuMerchantSalt: process.env.PAYU_MERCHANT_SALT ?? '',
  payuEnv: (process.env.PAYU_ENV ?? 'production').toLowerCase() === 'test' ? 'test' : 'production',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  apiPublicUrl:
    process.env.API_PUBLIC_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    `http://localhost:${process.env.PORT ?? 4000}`,
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendSandbox: process.env.RESEND_SANDBOX === '1' || process.env.RESEND_SANDBOX === 'true',
  emailFrom: resolveEmailFrom(),
  resendAccountEmail: process.env.RESEND_ACCOUNT_EMAIL ?? '',
  whatsappToken: process.env.WHATSAPP_TOKEN ?? '',
  whatsappPhoneId: process.env.WHATSAPP_PHONE_ID ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  cdnUrl: process.env.CDN_URL ?? '',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  facebookAppId: process.env.FACEBOOK_APP_ID ?? '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET ?? '',
  defaultCountry: process.env.DEFAULT_COUNTRY ?? 'US',
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'USD',
  defaultLocale: process.env.DEFAULT_LOCALE ?? 'en',
  /** Catalog product.price is stored in this currency (admin base currency). */
  catalogBaseCurrency: (process.env.CATALOG_BASE_CURRENCY || process.env.DEFAULT_CURRENCY || 'USD').toUpperCase(),
  nodeEnv: process.env.NODE_ENV ?? 'development',
}

/** True when Razorpay keys are live (rzp_live_…) and PayU is not on the test host. */
export function isPaymentsLiveMode() {
  const razorpayLive = String(config.razorpayKeyId || '').startsWith('rzp_live_')
  const payuLive = config.payuEnv === 'production'
  return razorpayLive && payuLive
}

export function assertLivePaymentGateway(method) {
  const isProd =
    config.nodeEnv === 'production' ||
    /esoftwarestore\.com/i.test(config.clientUrl || '') ||
    /onrender\.com/i.test(config.apiPublicUrl || '')

  if (!isProd) return

  if (method === 'razorpay') {
    if (!config.razorpayKeyId || !config.razorpayKeySecret) {
      throw new Error('Razorpay live keys are not configured. Set RAZORPAY_KEY_ID (rzp_live_…) and RAZORPAY_KEY_SECRET.')
    }
    if (config.razorpayKeyId.startsWith('rzp_test_')) {
      throw new Error(
        'Razorpay is still in test mode. Replace RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET with live keys (rzp_live_…) on the server.',
      )
    }
  }

  if (method === 'payu') {
    if (config.payuEnv !== 'production') {
      throw new Error('PayU is still in test mode. Set PAYU_ENV=production on the server.')
    }
    if (!config.payuMerchantKey || !config.payuMerchantSalt) {
      throw new Error('PayU production merchant key/salt are not configured.')
    }
  }
}

export const CURRENCIES = {
  INR: { symbol: '₹', rate: 1 },
  USD: { symbol: '$', rate: 0.012 },
  EUR: { symbol: '€', rate: 0.011 },
  GBP: { symbol: '£', rate: 0.0095 },
  AED: { symbol: 'د.إ', rate: 0.044 },
  CAD: { symbol: 'C$', rate: 0.016 },
  AUD: { symbol: 'A$', rate: 0.018 },
  JPY: { symbol: '¥', rate: 1.8 },
  RUB: { symbol: '₽', rate: 1.1 },
  BRL: { symbol: 'R$', rate: 0.06 },
}

export const LOCALES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ar']

/** Razorpay + PayU for India and international; wallet for logged-in INR balance. */
export const COUNTRY_PAYMENTS = {
  IN: ['razorpay', 'payu', 'wallet'],
  default: ['razorpay', 'payu'],
}
