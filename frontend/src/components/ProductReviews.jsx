import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Star, Languages } from 'lucide-react'
import { api } from '../lib/api'
import { averageRatingForProduct, reviewCountForProduct } from '../lib/reviews'

function Stars({ rating, size = 14 }) {
  const full = Math.round(Number(rating) || 0)
  return (
    <span className="inline-flex items-center gap-0.5 text-[#f59e0b]" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < full ? 'fill-current' : 'text-store-border'}
          strokeWidth={i < full ? 0 : 1.5}
        />
      ))}
    </span>
  )
}

function formatRelative(daysAgo, createdAt) {
  if (typeof daysAgo === 'number') {
    if (daysAgo <= 1) return 'Yesterday'
    if (daysAgo < 7) return `${daysAgo} days ago`
    if (daysAgo < 30) return `${Math.round(daysAgo / 7)} weeks ago`
    return `${Math.round(daysAgo / 30)} months ago`
  }
  if (!createdAt) return ''
  return new Date(createdAt).toLocaleDateString()
}

function RatingSummary({ average, count, distribution }) {
  const maxBar = Math.max(1, ...Object.values(distribution ?? { 5: 1 }))
  return (
    <div className="grid gap-6 sm:grid-cols-[160px_1fr] sm:items-center">
      <div className="text-center sm:text-left">
        <p className="text-4xl font-extrabold text-store-heading">{average.toFixed(1)}</p>
        <div className="mt-1 flex justify-center sm:justify-start">
          <Stars rating={average} size={16} />
        </div>
        <p className="mt-2 text-sm text-store-muted">{count.toLocaleString()} reviews</p>
      </div>
      <div className="space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const value = distribution?.[star] ?? 0
          const pct = Math.round((value / maxBar) * 100)
          return (
            <div key={star} className="flex items-center gap-2 text-xs text-store-muted">
              <span className="w-3 tabular-nums">{star}</span>
              <Star size={10} className="fill-[#f59e0b] text-[#f59e0b]" strokeWidth={0} />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-store-hover">
                <div className="h-full rounded-full bg-[#f59e0b]" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums">{value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ProductReviews({ product, locale = 'en' }) {
  const fallbackAverage = averageRatingForProduct(product)
  const fallbackCount = reviewCountForProduct(product)
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!product?.slug) return undefined
    let cancelled = false
    setLoading(true)
    api(`/api/products/${product.slug}/reviews?locale=${encodeURIComponent(locale)}&limit=12`)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [product?.slug, locale])

  const average = data?.averageRating ?? fallbackAverage
  const count = data?.reviewCount ?? fallbackCount
  const distribution = data?.distribution ?? { 5: Math.round(count * 0.7), 4: Math.round(count * 0.22), 3: Math.round(count * 0.06), 2: 0, 1: 0 }
  const reviews = data?.reviews ?? []

  const localesPresent = useMemo(() => {
    const set = new Map()
    for (const review of reviews) {
      if (!set.has(review.locale)) set.set(review.locale, review.language)
    }
    return [...set.entries()].map(([code, label]) => ({ code, label }))
  }, [reviews])

  const visible = filter === 'all' ? reviews : reviews.filter((r) => r.locale === filter)

  return (
    <section className="mt-10 store-card p-4 sm:mt-12 sm:p-6" id="reviews">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-store pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-store-heading sm:text-xl">Customer reviews</h2>
          <p className="mt-1 text-sm text-store-muted">Verified buyer feedback in multiple languages</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-store-heading">
          <Stars rating={average} />
          <span>{average.toFixed(1)}</span>
          <span className="font-normal text-store-muted">({count.toLocaleString()})</span>
        </div>
      </div>

      <div className="mt-6">
        <RatingSummary average={average} count={count} distribution={distribution} />
      </div>

      {localesPresent.length > 1 ? (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-store-muted">
            <Languages size={12} /> Language
          </span>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === 'all' ? 'bg-[#f97316] text-white' : 'bg-store-hover text-store-body'}`}
          >
            All
          </button>
          {localesPresent.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => setFilter(code)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === code ? 'bg-[#f97316] text-white' : 'bg-store-hover text-store-body'}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {loading && !reviews.length ? (
          <p className="text-sm text-store-muted">Loading reviews…</p>
        ) : null}
        {visible.map((review) => (
          <article key={review.id} className="rounded-2xl border border-store bg-store-subtle/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-store-heading">{review.author}</p>
                  {review.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <BadgeCheck size={11} /> Verified purchase
                    </span>
                  ) : null}
                  <span className="rounded-full bg-store-hover px-2 py-0.5 text-[10px] font-semibold text-store-muted">
                    {review.language}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Stars rating={review.rating} size={12} />
                  <span className="text-xs text-store-muted">{formatRelative(review.daysAgo, review.createdAt)}</span>
                </div>
              </div>
              {typeof review.helpful === 'number' ? (
                <p className="text-xs text-store-muted">{review.helpful} found helpful</p>
              ) : null}
            </div>
            {review.title ? (
              <h3 className="mt-3 text-sm font-bold text-store-heading" dir={review.dir}>
                {review.title}
              </h3>
            ) : null}
            <p className="mt-1.5 text-sm leading-relaxed text-store-body" dir={review.dir}>
              {review.text}
            </p>
          </article>
        ))}
        {!loading && !visible.length ? (
          <p className="text-sm text-store-muted">No reviews in this language yet.</p>
        ) : null}
      </div>
    </section>
  )
}

export function ProductRatingBadge({ product, className = '' }) {
  if (!product?.rating) return null
  const average = averageRatingForProduct(product)
  const count = product.reviewCount ?? reviewCountForProduct(product)
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Stars rating={average} size={14} />
      <span className="text-sm font-semibold text-store-heading">{average.toFixed(1)}</span>
      <a href="#reviews" className="text-sm text-store-muted hover:text-[#f97316]">
        {count.toLocaleString()} reviews
      </a>
    </div>
  )
}
