import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, LoaderCircle, RefreshCw, Save } from 'lucide-react'
import { dashboardApi } from '../api'
import TrustBadge, { computeDynamicReviewCount } from '../../components/TrustBadge'

const STYLE_OPTIONS = [
  { id: 'simple', label: 'Simple strip' },
  { id: 'shield-gold', label: 'Gold shield' },
  { id: 'circular-gold', label: 'Gold circle' },
  { id: 'shield-silver', label: 'Silver support' },
  { id: 'hex-dark', label: 'Secure hex' },
  { id: 'octagon-green', label: 'Guarantee' },
  { id: 'ribbon-gold', label: 'Secure ribbon' },
]

const emptyForm = {
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

export default function TrustBadgeTab() {
  const [form, setForm] = useState(emptyForm)
  const [styles, setStyles] = useState(STYLE_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  const previewCount = useMemo(() => computeDynamicReviewCount(form), [form])

  const load = async () => {
    setLoading(true)
    setStatus('')
    try {
      const data = await dashboardApi('/api/admin/settings/trust-badge')
      const badge = data.trustBadge ?? emptyForm
      setForm({
        enabled: badge.enabled !== false,
        title: badge.title ?? emptyForm.title,
        rating: badge.rating ?? emptyForm.rating,
        baselineReviews: badge.baselineReviews ?? emptyForm.baselineReviews,
        dailyGrowthMin: badge.dailyGrowthMin ?? emptyForm.dailyGrowthMin,
        dailyGrowthMax: badge.dailyGrowthMax ?? emptyForm.dailyGrowthMax,
        growthStartDate: badge.growthStartDate ?? emptyForm.growthStartDate,
        tagline: badge.tagline ?? emptyForm.tagline,
        style: badge.style ?? emptyForm.style,
        showOnHome: badge.showOnHome !== false,
        showOnProduct: badge.showOnProduct !== false,
        showOnCart: badge.showOnCart !== false,
      })
      if (data.styles?.length) setStyles(data.styles)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setStatus('')
    try {
      const data = await dashboardApi('/api/admin/settings/trust-badge', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          rating: Number(form.rating),
          baselineReviews: Math.floor(Number(form.baselineReviews) || 0),
          dailyGrowthMin: Math.floor(Number(form.dailyGrowthMin) || 0),
          dailyGrowthMax: Math.floor(Number(form.dailyGrowthMax) || 0),
        }),
      })
      const badge = data.trustBadge ?? form
      setForm((prev) => ({ ...prev, ...badge }))
      setStatus(`Saved · live review count ${Number(badge.reviewCount ?? previewCount).toLocaleString()}`)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="flex items-center gap-2 text-slate-500"><LoaderCircle className="animate-spin" size={16} /> Loading trust badge settings…</p>
  }

  const previewBadge = {
    ...form,
    enabled: true,
    reviewCount: previewCount,
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <BadgeCheck size={22} className="text-amber-500" /> Trust badge
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Shown near Buy Now / Checkout. Review total starts at your baseline and grows a few reviews each day.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <form onSubmit={save} className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Enable trust badge on storefront
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium">
              Badge title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                placeholder="BEST SERVICE"
              />
            </label>
            <label className="block text-xs font-medium">
              Rating score
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
            </label>
            <label className="block text-xs font-medium sm:col-span-2">
              Tagline
              <input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                placeholder="Trusted by thousands of buyers"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <p className="text-sm font-semibold">Review growth</p>
            <p className="mt-1 text-xs text-slate-500">
              Baseline starts at 1,000 (or your value). Each day adds a random amount between min and max (same for every visitor).
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium">
                Baseline reviews
                <input
                  type="number"
                  min="0"
                  value={form.baselineReviews}
                  onChange={(e) => setForm({ ...form, baselineReviews: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <label className="block text-xs font-medium">
                Growth start date
                <input
                  type="date"
                  value={form.growthStartDate}
                  onChange={(e) => setForm({ ...form, growthStartDate: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <label className="block text-xs font-medium">
                Daily growth min
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={form.dailyGrowthMin}
                  onChange={(e) => setForm({ ...form, dailyGrowthMin: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <label className="block text-xs font-medium">
                Daily growth max
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={form.dailyGrowthMax}
                  onChange={(e) => setForm({ ...form, dailyGrowthMax: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                />
              </label>
            </div>
            <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Live total today: {previewCount.toLocaleString()} reviews
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium">Badge style</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {styles.map((style) => (
                <label
                  key={style.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                    form.style === style.id
                      ? 'border-amber-400 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
                      : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="trust-style"
                    checked={form.style === style.id}
                    onChange={() => setForm({ ...form, style: style.id })}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold">{style.label}</span>
                    {style.description ? (
                      <span className="mt-0.5 block text-xs text-slate-500">{style.description}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={form.showOnHome}
                onChange={(e) => setForm({ ...form, showOnHome: e.target.checked })}
              />
              Home
            </label>
            <label className="inline-flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={form.showOnProduct}
                onChange={(e) => setForm({ ...form, showOnProduct: e.target.checked })}
              />
              Product
            </label>
            <label className="inline-flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={form.showOnCart}
                onChange={(e) => setForm({ ...form, showOnCart: e.target.checked })}
              />
              Cart
            </label>
          </div>

          {status ? (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                /saved|live/i.test(status)
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
              }`}
            >
              {status}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
            Save trust badge
          </button>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview</p>
          <div className="mt-4 flex justify-center bg-white p-6 dark:bg-slate-900/40 rounded-xl">
            <TrustBadge placement="product" size="preview" override={previewBadge} />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            {form.style === 'simple' ? 'Compact CTA companion' : 'Seal-style badge'} · {previewCount.toLocaleString()} reviews
          </p>
        </aside>
      </form>
    </div>
  )
}
