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
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? 'rzp_test_key',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? 'rzp_test_secret',
  payuMerchantKey: process.env.PAYU_MERCHANT_KEY ?? '',
  payuMerchantSalt: process.env.PAYU_MERCHANT_SALT ?? '',
  payuEnv: process.env.PAYU_ENV ?? 'test',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
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
  defaultCountry: process.env.DEFAULT_COUNTRY ?? 'IN',
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'INR',
  defaultLocale: process.env.DEFAULT_LOCALE ?? 'en',
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

export const COUNTRY_PAYMENTS = {
  IN: ['razorpay', 'payu', 'upi', 'wallet'],
  US: ['stripe', 'paypal', 'apple_pay'],
  GB: ['stripe', 'paypal'],
  DE: ['stripe', 'paypal', 'klarna'],
  default: ['stripe', 'razorpay'],
}
