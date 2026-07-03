import { config, CURRENCIES, LOCALES } from '../config.js'

/** Country → default currency & locale */
export const COUNTRY_REGION = {
  IN: { currency: 'INR', locale: 'en' },
  US: { currency: 'USD', locale: 'en' },
  GB: { currency: 'GBP', locale: 'en' },
  UK: { currency: 'GBP', locale: 'en' },
  DE: { currency: 'EUR', locale: 'de' },
  AT: { currency: 'EUR', locale: 'de' },
  CH: { currency: 'EUR', locale: 'de' },
  FR: { currency: 'EUR', locale: 'fr' },
  BE: { currency: 'EUR', locale: 'fr' },
  ES: { currency: 'EUR', locale: 'es' },
  MX: { currency: 'USD', locale: 'es' },
  AR: { currency: 'USD', locale: 'es' },
  CO: { currency: 'USD', locale: 'es' },
  IT: { currency: 'EUR', locale: 'it' },
  PT: { currency: 'EUR', locale: 'pt' },
  BR: { currency: 'BRL', locale: 'pt' },
  NL: { currency: 'EUR', locale: 'nl' },
  PL: { currency: 'EUR', locale: 'pl' },
  RU: { currency: 'RUB', locale: 'ru' },
  UA: { currency: 'EUR', locale: 'ru' },
  AE: { currency: 'AED', locale: 'ar' },
  SA: { currency: 'AED', locale: 'ar' },
  EG: { currency: 'AED', locale: 'ar' },
  CA: { currency: 'CAD', locale: 'en' },
  AU: { currency: 'AUD', locale: 'en' },
  NZ: { currency: 'AUD', locale: 'en' },
  JP: { currency: 'JPY', locale: 'en' },
  SG: { currency: 'USD', locale: 'en' },
  HK: { currency: 'USD', locale: 'en' },
  MY: { currency: 'USD', locale: 'en' },
  PH: { currency: 'USD', locale: 'en' },
  ID: { currency: 'USD', locale: 'en' },
  TH: { currency: 'USD', locale: 'en' },
  ZA: { currency: 'USD', locale: 'en' },
  NG: { currency: 'USD', locale: 'en' },
  IE: { currency: 'EUR', locale: 'en' },
  SE: { currency: 'EUR', locale: 'en' },
  NO: { currency: 'EUR', locale: 'en' },
  DK: { currency: 'EUR', locale: 'en' },
  FI: { currency: 'EUR', locale: 'en' },
}

const EU_COUNTRIES = new Set([
  'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'PL', 'AT', 'BE', 'IE', 'SE', 'NO', 'DK', 'FI',
  'GR', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY',
])

function resolveRegion(countryCode, preferredLocale) {
  const country = String(countryCode ?? config.defaultCountry).toUpperCase()
  let mapped = COUNTRY_REGION[country]

  if (!mapped && EU_COUNTRIES.has(country)) {
    mapped = { currency: 'EUR', locale: 'en' }
  }

  if (!mapped) {
    mapped = {
      currency: config.defaultCurrency,
      locale: config.defaultLocale,
    }
  }

  let locale = mapped.locale
  if (preferredLocale && LOCALES.includes(preferredLocale)) {
    locale = preferredLocale
  }

  let currency = mapped.currency
  if (!CURRENCIES[currency]) {
    currency = config.defaultCurrency
  }

  return { country, currency, locale }
}

function getClientIp(request) {
  const forwarded = request.headers['x-forwarded-for']
  if (forwarded) return String(forwarded).split(',')[0].trim()
  const realIp = request.headers['x-real-ip']
  if (realIp) return String(realIp).trim()
  return request.ip
}

function isPrivateIp(ip) {
  if (!ip) return true
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('fe80:')
  )
}

async function lookupCountryByIp(ip) {
  if (isPrivateIp(ip)) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await response.json()
    if (data.status === 'success' && data.countryCode) {
      return data.countryCode.toUpperCase()
    }
  } catch {
    /* fallback below */
  }
  return null
}

function parsePreferredLocale(acceptLanguage) {
  if (!acceptLanguage) return null
  const first = acceptLanguage.split(',')[0]?.trim().toLowerCase()
  if (!first) return null
  const lang = first.split('-')[0]
  return LOCALES.includes(lang) ? lang : null
}

export async function detectRegion(request) {
  const headerCountry =
    request.headers['cf-ipcountry'] ??
    request.headers['x-vercel-ip-country'] ??
    request.headers['x-country-code']

  let country = headerCountry && headerCountry !== 'XX' ? String(headerCountry).toUpperCase() : null

  if (!country) {
    const ip = getClientIp(request)
    country = await lookupCountryByIp(ip)
  }

  if (!country) {
    const accept = request.headers['accept-language'] ?? ''
    const part = accept.split(',')[0]
    const region = part?.split('-')[1]?.toUpperCase()
    if (region && (COUNTRY_REGION[region] || EU_COUNTRIES.has(region))) {
      country = region === 'UK' ? 'GB' : region
    }
  }

  if (!country) country = config.defaultCountry

  const preferredLocale = parsePreferredLocale(request.headers['accept-language'])
  const region = resolveRegion(country, preferredLocale)

  return {
    ...region,
    detected: true,
    source: headerCountry ? 'cdn' : 'ip',
  }
}

export function getRegionForCountry(countryCode, locale) {
  return resolveRegion(countryCode, locale)
}
