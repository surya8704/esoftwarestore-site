import { StoreSettings } from '../db/models.js'
import { mapId } from '../db/client.js'

export const TRUST_BADGE_STYLES = [
  { id: 'simple', label: 'Simple strip', description: 'Compact stars + rating + reviews' },
  { id: 'shield-gold', label: 'Gold shield', description: 'Classic gold shield seal' },
  { id: 'circular-gold', label: 'Gold circle', description: 'Round gold seal with crown feel' },
  { id: 'shield-silver', label: 'Silver support', description: 'Cool silver/blue shield' },
  { id: 'hex-dark', label: 'Secure hex', description: 'Dark hexagonal secure badge' },
  { id: 'octagon-green', label: 'Guarantee', description: 'Green money-back style' },
  { id: 'ribbon-gold', label: 'Secure ribbon', description: 'Gold seal with ribbon banner' },
]

export const DEFAULT_TRUST_BADGE = {
  enabled: true,
  title: 'BEST SERVICE',
  rating: 4.9,
  baselineReviews: 1000,
  dailyGrowthMin: 3,
  dailyGrowthMax: 9,
  growthStartDate: '2026-01-01',
  tagline: 'Trusted by thousands of buyers',
  style: 'simple',
  showOnHome: true,
  showOnProduct: true,
  showOnCart: true,
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function normalizeTrustBadge(raw = {}) {
  const styleIds = new Set(TRUST_BADGE_STYLES.map((s) => s.id))
  const rating = Number(raw.rating)
  const baseline = Math.floor(Number(raw.baselineReviews))
  const growthMin = Math.floor(Number(raw.dailyGrowthMin))
  const growthMax = Math.floor(Number(raw.dailyGrowthMax))
  const style = styleIds.has(raw.style) ? raw.style : DEFAULT_TRUST_BADGE.style

  return {
    enabled: raw.enabled !== false,
    title: String(raw.title || DEFAULT_TRUST_BADGE.title).trim().slice(0, 40) || DEFAULT_TRUST_BADGE.title,
    rating: Number.isFinite(rating) ? clamp(Math.round(rating * 10) / 10, 1, 5) : DEFAULT_TRUST_BADGE.rating,
    baselineReviews: Number.isFinite(baseline) ? clamp(baseline, 0, 5_000_000) : DEFAULT_TRUST_BADGE.baselineReviews,
    dailyGrowthMin: Number.isFinite(growthMin) ? clamp(growthMin, 0, 500) : DEFAULT_TRUST_BADGE.dailyGrowthMin,
    dailyGrowthMax: Number.isFinite(growthMax) ? clamp(growthMax, 0, 500) : DEFAULT_TRUST_BADGE.dailyGrowthMax,
    growthStartDate: String(raw.growthStartDate || DEFAULT_TRUST_BADGE.growthStartDate).slice(0, 10),
    tagline: String(raw.tagline || DEFAULT_TRUST_BADGE.tagline).trim().slice(0, 80) || DEFAULT_TRUST_BADGE.tagline,
    style,
    showOnHome: raw.showOnHome !== false,
    showOnProduct: raw.showOnProduct !== false,
    showOnCart: raw.showOnCart !== false,
  }
}

/** Deterministic daily bump so all visitors see the same count on a given day. */
export function hashDaySeed(dayKey) {
  let hash = 2166136261
  for (let i = 0; i < dayKey.length; i += 1) {
    hash ^= dayKey.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function computeDynamicReviewCount({
  baselineReviews,
  dailyGrowthMin,
  dailyGrowthMax,
  growthStartDate,
  asOf = new Date(),
} = DEFAULT_TRUST_BADGE) {
  const baseline = Math.max(0, Math.floor(Number(baselineReviews) || 0))
  let min = Math.max(0, Math.floor(Number(dailyGrowthMin) || 0))
  let max = Math.max(0, Math.floor(Number(dailyGrowthMax) || 0))
  if (max < min) {
    const swap = min
    min = max
    max = swap
  }

  const start = new Date(`${String(growthStartDate || DEFAULT_TRUST_BADGE.growthStartDate).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) return baseline

  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
  if (end < start) return baseline

  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.floor((end - start) / dayMs) + 1
  // Cap loop for safety; beyond that use average growth
  const maxDays = 4000
  let total = baseline
  const span = max - min + 1
  const limit = Math.min(days, maxDays)
  for (let i = 0; i < limit; i += 1) {
    const day = new Date(start.getTime() + i * dayMs)
    const key = day.toISOString().slice(0, 10)
    const seed = hashDaySeed(`trust-reviews:${key}`)
    total += min + (span > 0 ? seed % span : 0)
  }
  if (days > maxDays) {
    const avg = (min + max) / 2
    total += Math.round((days - maxDays) * avg)
  }
  return total
}

export function publicTrustBadge(settings) {
  const badge = normalizeTrustBadge(settings?.trustBadge)
  if (!badge.enabled) {
    return { ...badge, reviewCount: badge.baselineReviews, enabled: false }
  }
  const min = Math.min(badge.dailyGrowthMin, badge.dailyGrowthMax)
  const max = Math.max(badge.dailyGrowthMin, badge.dailyGrowthMax)
  return {
    ...badge,
    dailyGrowthMin: min,
    dailyGrowthMax: max,
    reviewCount: computeDynamicReviewCount({
      baselineReviews: badge.baselineReviews,
      dailyGrowthMin: min,
      dailyGrowthMax: max,
      growthStartDate: badge.growthStartDate,
    }),
  }
}

export async function getStoreSettingsDoc() {
  let doc = await StoreSettings.findOne({ key: 'default' })
  if (!doc) {
    doc = await StoreSettings.create({
      key: 'default',
      trustBadge: { ...DEFAULT_TRUST_BADGE },
    })
  }
  return doc
}

export async function getPublicTrustBadgeSettings() {
  const doc = await getStoreSettingsDoc()
  return publicTrustBadge(doc)
}

export async function getAdminTrustBadgeSettings() {
  const doc = await getStoreSettingsDoc()
  const badge = publicTrustBadge(doc)
  return {
    settings: mapId(doc),
    trustBadge: badge,
    styles: TRUST_BADGE_STYLES,
  }
}

export async function updateTrustBadgeSettings(payload) {
  const next = normalizeTrustBadge(payload)
  const min = Math.min(next.dailyGrowthMin, next.dailyGrowthMax)
  const max = Math.max(next.dailyGrowthMin, next.dailyGrowthMax)
  next.dailyGrowthMin = min
  next.dailyGrowthMax = max

  const doc = await StoreSettings.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        trustBadge: next,
        updatedAt: new Date(),
      },
      $setOnInsert: { key: 'default', createdAt: new Date() },
    },
    { upsert: true, new: true },
  )
  return publicTrustBadge(doc)
}
