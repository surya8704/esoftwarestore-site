import { CURRENCIES } from '../config.js'

/** Cache live FX multipliers: 1 unit of currency → INR */
let cached = {
  ratesToInr: null,
  fetchedAt: 0,
  source: 'static',
  baseDate: null,
}

const CACHE_MS = 60 * 60 * 1000

function staticRatesToInr() {
  const rates = { INR: 1 }
  for (const [code, meta] of Object.entries(CURRENCIES)) {
    const rate = Number(meta?.rate)
    if (!Number.isFinite(rate) || rate <= 0) continue
    // Catalog convertPrice: INR * rate = foreign → foreign / rate = INR
    rates[code] = code === 'INR' ? 1 : 1 / rate
  }
  return rates
}

/**
 * Fetch live multipliers to INR.
 * Uses free CDN currency API; falls back to static catalog rates.
 */
export async function fetchRatesToInr({ force = false } = {}) {
  const now = Date.now()
  if (!force && cached.ratesToInr && now - cached.fetchedAt < CACHE_MS) {
    return {
      ratesToInr: cached.ratesToInr,
      fetchedAt: cached.fetchedAt,
      source: cached.source,
      baseDate: cached.baseDate,
    }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.json',
      { signal: controller.signal },
    )
    clearTimeout(timer)
    if (!response.ok) throw new Error(`FX HTTP ${response.status}`)
    const payload = await response.json()
    const inrMap = payload.inr ?? payload.INR ?? {}
    const ratesToInr = { INR: 1 }

    // payload.inr.usd = how many USD equal 1 INR → INR per USD = 1 / that
    for (const [code, value] of Object.entries(inrMap)) {
      const upper = String(code).toUpperCase()
      const perInr = Number(value)
      if (!Number.isFinite(perInr) || perInr <= 0) continue
      ratesToInr[upper] = upper === 'INR' ? 1 : 1 / perInr
    }

    // Ensure catalog currencies exist even if missing from live feed
    const fallback = staticRatesToInr()
    for (const [code, rate] of Object.entries(fallback)) {
      if (ratesToInr[code] == null) ratesToInr[code] = rate
    }

    cached = {
      ratesToInr,
      fetchedAt: now,
      source: 'live',
      baseDate: payload.date ?? new Date().toISOString().slice(0, 10),
    }
  } catch (err) {
    console.warn('[fx] live rates unavailable, using static catalog rates:', err.message)
    cached = {
      ratesToInr: staticRatesToInr(),
      fetchedAt: now,
      source: 'static',
      baseDate: new Date().toISOString().slice(0, 10),
    }
  }

  return {
    ratesToInr: cached.ratesToInr,
    fetchedAt: cached.fetchedAt,
    source: cached.source,
    baseDate: cached.baseDate,
  }
}

export function convertToInr(amount, currency, ratesToInr) {
  const value = Number(amount) || 0
  const code = String(currency || 'INR').toUpperCase()
  if (code === 'INR') return Math.round(value)
  const multiplier = ratesToInr?.[code]
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    // Unknown currency — treat as INR units to avoid zeroing revenue silently
    return Math.round(value)
  }
  return Math.round(value * multiplier)
}

/** Convert via INR pivot using rates where ratesToInr[code] = INR per 1 unit of code. */
export function convertViaInr(amount, fromCurrency, toCurrency, ratesToInr) {
  const from = String(fromCurrency || 'INR').toUpperCase()
  const to = String(toCurrency || 'USD').toUpperCase()
  const inr = convertToInr(amount, from, ratesToInr)
  if (to === 'INR') return inr
  const toPerInrUnit = ratesToInr?.[to]
  if (!Number.isFinite(toPerInrUnit) || toPerInrUnit <= 0) return inr
  return Math.round(inr / toPerInrUnit)
}
