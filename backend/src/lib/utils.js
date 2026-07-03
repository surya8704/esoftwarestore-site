import crypto from 'node:crypto'

export function parseJsonList(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
}

export function isProductVisible(product, countryCode) {
  const allowed = parseJsonList(product.allowedCountries)
  const blocked = parseJsonList(product.blockedCountries)
  if (allowed?.length && !allowed.includes(countryCode)) return false
  if (blocked?.includes(countryCode)) return false
  return product.active !== false && product.active !== 0
}

export function convertPrice(amountInr, currency, currencies) {
  const rate = currencies[currency]?.rate ?? 1
  return Math.round(amountInr * rate)
}

export function formatMoney(amount, currency, currencies) {
  const symbol = currencies[currency]?.symbol ?? currency
  return `${symbol}${amount.toLocaleString()}`
}

export function generateConfirmationCode() {
  return `ES${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function generateSessionId() {
  return crypto.randomUUID().replace(/-/g, '')
}
