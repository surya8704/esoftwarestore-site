import { useMemo } from 'react'
import { ShieldCheck, Star } from 'lucide-react'
import { useApp } from '../context/AppContext'

function hashDaySeed(dayKey) {
  let hash = 2166136261
  for (let i = 0; i < dayKey.length; i += 1) {
    hash ^= dayKey.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Same deterministic growth algorithm as the backend, so UI stays consistent. */
export function computeDynamicReviewCount({
  baselineReviews = 1000,
  dailyGrowthMin = 3,
  dailyGrowthMax = 9,
  growthStartDate = '2026-01-01',
  asOf = new Date(),
} = {}) {
  const baseline = Math.max(0, Math.floor(Number(baselineReviews) || 0))
  let min = Math.max(0, Math.floor(Number(dailyGrowthMin) || 0))
  let max = Math.max(0, Math.floor(Number(dailyGrowthMax) || 0))
  if (max < min) {
    const swap = min
    min = max
    max = swap
  }

  const start = new Date(`${String(growthStartDate).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) return baseline

  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()))
  if (end < start) return baseline

  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.floor((end - start) / dayMs) + 1
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

function formatReviewCount(n) {
  return Number(n || 0).toLocaleString()
}

function StarRow({ rating, size = 12, className = '' }) {
  const value = Number(rating) || 0
  return (
    <span className={`trust-badge-stars ${className}`} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = value >= i + 1
        const half = !filled && value >= i + 0.5
        return (
          <Star
            key={i}
            size={size}
            className={filled || half ? 'trust-star-on' : 'trust-star-off'}
            fill={filled ? 'currentColor' : half ? 'url(#trustHalf)' : 'none'}
            strokeWidth={1.75}
          />
        )
      })}
    </span>
  )
}

function SealIcon({ style }) {
  if (style === 'hex-dark') return <span className="trust-seal-icon" aria-hidden>🔒</span>
  if (style === 'octagon-green') return <span className="trust-seal-icon" aria-hidden>↺</span>
  if (style === 'shield-silver') return <span className="trust-seal-icon" aria-hidden>🎧</span>
  if (style === 'circular-gold') return <span className="trust-seal-icon" aria-hidden>♛</span>
  if (style === 'ribbon-gold') return <span className="trust-seal-icon" aria-hidden>🛡</span>
  return <span className="trust-seal-icon" aria-hidden>🤝</span>
}

/**
 * @param {'home'|'product'|'cart'} placement
 * @param {'default'|'compact'|'preview'} [size]
 * @param {object} [override] — admin preview payload
 */
export default function TrustBadge({
  placement = 'product',
  size = 'default',
  override = null,
  className = '',
}) {
  const { config } = useApp()
  const badge = override || config?.trustBadge

  const reviewCount = useMemo(() => {
    if (!badge) return 0
    if (typeof badge.reviewCount === 'number' && Number.isFinite(badge.reviewCount)) {
      return badge.reviewCount
    }
    return computeDynamicReviewCount(badge)
  }, [badge])

  if (!badge || badge.enabled === false) return null
  if (!override) {
    if (placement === 'home' && badge.showOnHome === false) return null
    if (placement === 'product' && badge.showOnProduct === false) return null
    if (placement === 'cart' && badge.showOnCart === false) return null
  }

  const style = badge.style || 'simple'
  const rating = Number(badge.rating) || 4.9
  const title = badge.title || 'BEST SERVICE'
  const tagline = badge.tagline || 'Trusted by thousands of buyers'
  const compact = size === 'compact'
  // Keep sticky / tight CTA areas as a clean strip even when seal styles are selected.
  const renderStyle = compact ? 'simple' : style
  const classes = [
    'trust-badge',
    `trust-badge--${renderStyle}`,
    compact ? 'trust-badge--compact' : '',
    size === 'preview' ? 'trust-badge--preview' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (renderStyle === 'simple') {
    return (
      <div className={classes} role="group" aria-label={`${rating} star rating from ${formatReviewCount(reviewCount)} reviews`}>
        <div className="trust-badge-simple-inner">
          <ShieldCheck size={compact ? 16 : 18} className="trust-badge-check" aria-hidden />
          <div className="min-w-0">
            <div className="trust-badge-simple-row">
              <span className="trust-badge-score">{rating.toFixed(1)}</span>
              <StarRow rating={rating} size={compact ? 11 : 13} />
              <span className="trust-badge-reviews">{formatReviewCount(reviewCount)} reviews</span>
            </div>
            {!compact && tagline ? <p className="trust-badge-tagline">{tagline}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={classes} role="group" aria-label={`${title}: ${rating} from ${formatReviewCount(reviewCount)} reviews`}>
      <div className="trust-seal">
        {style === 'ribbon-gold' ? <span className="trust-seal-ribbon">{title}</span> : null}
        {style !== 'ribbon-gold' ? <p className="trust-seal-title">{title}</p> : null}
        <SealIcon style={style} />
        <p className="trust-seal-score">{rating.toFixed(1)}</p>
        <StarRow rating={rating} size={compact ? 10 : 12} />
        <p className="trust-seal-reviews">{formatReviewCount(reviewCount)} Reviews</p>
        {!compact && tagline ? <p className="trust-seal-tagline">{tagline}</p> : null}
      </div>
    </div>
  )
}
