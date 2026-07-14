const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

let regionHeaders = {
  country: localStorage.getItem('country') ?? 'IN',
  currency: localStorage.getItem('currency') ?? 'INR',
  locale: localStorage.getItem('locale') ?? 'en',
}

export function setApiRegion({ country, currency, locale }) {
  regionHeaders = { country, currency, locale }
}

export function getApiRegion() {
  return { ...regionHeaders }
}

export function getSessionId() {
  let id = localStorage.getItem('sessionId')
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '')
    localStorage.setItem('sessionId', id)
  }
  return id
}

export async function api(path, options = {}) {
  const headers = {
    'X-Session-Id': getSessionId(),
    'X-Country': regionHeaders.country,
    'X-Currency': regionHeaders.currency,
    'X-Locale': regionHeaders.locale,
    'Accept-Language': regionHeaders.locale,
    ...(options.headers ?? {}),
  }

  const hasBody = options.body !== undefined && options.body !== null && options.body !== ''
  if (hasBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message = data.message ?? data.error ?? 'Request failed'
    throw new Error(message)
  }

  return data
}

export function trackPage(path) {
  api('/api/track/page', {
    method: 'POST',
    body: JSON.stringify({
      path,
      referrer: document.referrer,
      locale: regionHeaders.locale,
    }),
  }).catch(() => {})
}

const LOCALE_FORMAT = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'ar-AE',
  CAD: 'en-CA',
  AUD: 'en-AU',
  JPY: 'ja-JP',
  RUB: 'ru-RU',
  BRL: 'pt-BR',
}

export function formatPrice(amount, currency = 'INR') {
  const value = Number(amount ?? 0)
  const formatLocale = LOCALE_FORMAT[currency] ?? undefined

  if (currency === 'INR') {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  try {
    return new Intl.NumberFormat(formatLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function discountPercent(price, originalPrice) {
  if (!originalPrice || originalPrice <= price) return 0
  return Math.round((1 - price / originalPrice) * 100)
}

/** Stable pseudo-random "sold recently" count per product (12–87). */
export function soldRecentlyCount(product) {
  const key = String(product?.id ?? product?.slug ?? product?.name ?? 'product')
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return 12 + (hash % 76)
}
