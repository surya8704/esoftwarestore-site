import { Order } from '../db/models.js'
import { convertToInr, fetchRatesToInr } from './fxRates.js'
import { PAID_ORDER_DB_FILTER } from './orders.js'

const CONFIRMED_PAID = {
  ...PAID_ORDER_DB_FILTER,
  gatewayPaymentStatus: { $in: ['captured', 'success', 'paid', 'wallet'] },
}

const COUNTRY_NAMES = {
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  DE: 'Germany',
  AT: 'Austria',
  CH: 'Switzerland',
  FR: 'France',
  BE: 'Belgium',
  ES: 'Spain',
  MX: 'Mexico',
  IT: 'Italy',
  PT: 'Portugal',
  BR: 'Brazil',
  NL: 'Netherlands',
  PL: 'Poland',
  RU: 'Russia',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  CA: 'Canada',
  AU: 'Australia',
  NZ: 'New Zealand',
  JP: 'Japan',
  SG: 'Singapore',
  IE: 'Ireland',
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function periodKey(date, groupBy) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  if (groupBy === 'month') return `${y}-${m}`
  if (groupBy === 'week') {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = tmp.getUTCDay() || 7
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
    const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7)
    return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  }
  return `${y}-${m}-${day}`
}

function orderAmount(order) {
  const paid = Number(order.amountPaid)
  if (Number.isFinite(paid) && paid > 0) return paid
  return Number(order.total) || 0
}

/**
 * Build earnings report converted to INR using live FX rates.
 */
export async function buildEarningsReport({
  from,
  to,
  countryCode,
  groupBy = 'day',
} = {}) {
  const fx = await fetchRatesToInr()
  const match = { ...CONFIRMED_PAID }

  if (from || to) {
    match.createdAt = {}
    if (from) match.createdAt.$gte = startOfDay(from)
    if (to) match.createdAt.$lte = endOfDay(to)
  }
  if (countryCode && countryCode !== 'ALL') {
    match.countryCode = String(countryCode).toUpperCase()
  }

  const orders = await Order.find(match)
    .select('total amountPaid currency countryCode createdAt paymentMethod gatewayPaymentStatus')
    .sort({ createdAt: 1 })
    .lean()

  const byRegionMap = new Map()
  const byPeriodMap = new Map()
  const byCurrencyMap = new Map()
  let totalInr = 0
  let totalOrders = 0

  for (const order of orders) {
    const amount = orderAmount(order)
    const currency = String(order.currency || 'INR').toUpperCase()
    const country = String(order.countryCode || 'UN').toUpperCase()
    const inr = convertToInr(amount, currency, fx.ratesToInr)

    totalInr += inr
    totalOrders += 1

    if (!byCurrencyMap.has(currency)) {
      byCurrencyMap.set(currency, { currency, orders: 0, originalTotal: 0, totalInr: 0 })
    }
    const cur = byCurrencyMap.get(currency)
    cur.orders += 1
    cur.originalTotal += amount
    cur.totalInr += inr

    if (!byRegionMap.has(country)) {
      byRegionMap.set(country, {
        countryCode: country,
        countryName: COUNTRY_NAMES[country] ?? country,
        orders: 0,
        totalInr: 0,
        currencies: {},
      })
    }
    const region = byRegionMap.get(country)
    region.orders += 1
    region.totalInr += inr
    region.currencies[currency] = (region.currencies[currency] ?? 0) + amount

    const key = periodKey(order.createdAt, groupBy)
    if (!byPeriodMap.has(key)) {
      byPeriodMap.set(key, { period: key, orders: 0, totalInr: 0 })
    }
    const bucket = byPeriodMap.get(key)
    bucket.orders += 1
    bucket.totalInr += inr
  }

  const byRegion = [...byRegionMap.values()]
    .map((row) => ({
      ...row,
      currencies: Object.entries(row.currencies).map(([currency, originalTotal]) => ({
        currency,
        originalTotal: Math.round(originalTotal),
      })),
    }))
    .sort((a, b) => b.totalInr - a.totalInr)

  const byPeriod = [...byPeriodMap.values()].sort((a, b) => a.period.localeCompare(b.period))
  const byCurrency = [...byCurrencyMap.values()]
    .map((row) => ({
      ...row,
      originalTotal: Math.round(row.originalTotal),
      totalInr: Math.round(row.totalInr),
    }))
    .sort((a, b) => b.totalInr - a.totalInr)

  const maxPeriod = Math.max(1, ...byPeriod.map((p) => p.totalInr))
  const maxRegion = Math.max(1, ...byRegion.map((r) => r.totalInr))

  return {
    filters: {
      from: from ? startOfDay(from).toISOString() : null,
      to: to ? endOfDay(to).toISOString() : null,
      countryCode: countryCode && countryCode !== 'ALL' ? String(countryCode).toUpperCase() : 'ALL',
      groupBy,
    },
    summary: {
      totalOrders,
      totalInr: Math.round(totalInr),
      averageOrderInr: totalOrders ? Math.round(totalInr / totalOrders) : 0,
      regionCount: byRegion.length,
    },
    byRegion: byRegion.map((row) => ({
      ...row,
      totalInr: Math.round(row.totalInr),
      share: Math.round((row.totalInr / maxRegion) * 100),
    })),
    byPeriod: byPeriod.map((row) => ({
      ...row,
      totalInr: Math.round(row.totalInr),
      share: Math.round((row.totalInr / maxPeriod) * 100),
    })),
    byCurrency,
    fx: {
      source: fx.source,
      baseDate: fx.baseDate,
      fetchedAt: new Date(fx.fetchedAt).toISOString(),
      ratesToInr: Object.fromEntries(
        Object.entries(fx.ratesToInr)
          .filter(([code]) => CURRENCY_WHITELIST.has(code) || byCurrencyMap.has(code) || code === 'INR')
          .map(([code, rate]) => [code, Math.round(rate * 10000) / 10000]),
      ),
    },
    countries: Object.entries(COUNTRY_NAMES)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

const CURRENCY_WHITELIST = new Set([
  'INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY', 'RUB', 'BRL',
])
