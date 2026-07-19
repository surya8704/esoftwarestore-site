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

export function convertPrice(amountInBase, currency, currencies, baseCurrency = 'USD') {
  const from = String(baseCurrency || 'USD').toUpperCase()
  const to = String(currency || baseCurrency || 'USD').toUpperCase()
  const value = Number(amountInBase) || 0
  if (from === to) return Math.round(value)
  const fromRate = currencies[from]?.rate ?? 1
  const toRate = currencies[to]?.rate ?? 1
  if (!fromRate) return Math.round(value * toRate)
  return Math.round((value / fromRate) * toRate)
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
