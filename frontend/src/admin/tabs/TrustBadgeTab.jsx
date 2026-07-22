import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, ImagePlus, LoaderCircle, RefreshCw, Save, Trash2, Upload } from 'lucide-react'
import { dashboardApi, uploadTrustBadgeImage } from '../api'
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
  displayMode: 'builtin',
  customBadgeId: '',
  activeCustomBadgeIds: [],
  customBadges: [],
}

function isAllowedImageFile(file) {
  const type = String(file?.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  const ext = String(file?.name || '').split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'webp', 'wepg', 'gif'].includes(ext)
}

function makeBadgeId() {
  return `badge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function TrustBadgeTab() {
  const [form, setForm] = useState(emptyForm)
  const [styles, setStyles] = useState(STYLE_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef(null)

  const previewCount = useMemo(() => computeDynamicReviewCount(form), [form])

  const previewBadge = useMemo(() => {
    const byId = new Map((form.customBadges ?? []).map((item) => [item.id, item]))
    const customImageUrl =
      form.displayMode === 'custom' && form.customBadgeId
        ? byId.get(form.customBadgeId)?.imageUrl || null
        : null
    const customImageUrls =
      form.displayMode === 'multiple'
        ? (form.activeCustomBadgeIds ?? []).map((id) => byId.get(id)?.imageUrl).filter(Boolean)
        : []
    return {
      ...form,
      enabled: true,
      reviewCount: previewCount,
      customImageUrl,
      customImageUrls,
    }
  }, [form, previewCount])

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
        displayMode: badge.displayMode ?? emptyForm.displayMode,
        customBadgeId: badge.customBadgeId ?? '',
        activeCustomBadgeIds: badge.activeCustomBadgeIds ?? [],
        customBadges: badge.customBadges ?? [],
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

  const handleBadgeUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const invalid = files.find((file) => !isAllowedImageFile(file))
    if (invalid) {
      setStatus('Please choose JPEG, PNG, WebP, or GIF images only')
      return
    }
    const tooLarge = files.find((file) => file.size > 5 * 1024 * 1024)
    if (tooLarge) {
      setStatus('Each badge image must be 5MB or smaller')
      return
    }

    setUploading(true)
    setStatus('')
    try {
      const uploaded = []
      for (const file of files) {
        const data = await uploadTrustBadgeImage(file)
        uploaded.push({
          id: makeBadgeId(),
          label: file.name.replace(/\.[^.]+$/, '').slice(0, 60),
          imageUrl: data.imageUrl,
          createdAt: new Date().toISOString(),
        })
      }
      setForm((prev) => {
        const customBadges = [...(prev.customBadges ?? []), ...uploaded].slice(0, 20)
        const next = { ...prev, customBadges }
        if (!next.customBadgeId && customBadges.length) next.customBadgeId = customBadges[0].id
        if (!(next.activeCustomBadgeIds?.length)) {
          next.activeCustomBadgeIds = customBadges.slice(0, 3).map((b) => b.id)
        }
        return next
      })
      setStatus(`Uploaded ${uploaded.length} badge image${uploaded.length === 1 ? '' : 's'} — save to publish`)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeCustomBadge = (badgeId) => {
    setForm((prev) => {
      const customBadges = (prev.customBadges ?? []).filter((b) => b.id !== badgeId)
      const activeCustomBadgeIds = (prev.activeCustomBadgeIds ?? []).filter((id) => id !== badgeId)
      let customBadgeId = prev.customBadgeId
      if (customBadgeId === badgeId) customBadgeId = customBadges[0]?.id || ''
      let displayMode = prev.displayMode
      if (!customBadges.length && displayMode !== 'builtin') displayMode = 'builtin'
      return { ...prev, customBadges, activeCustomBadgeIds, customBadgeId, displayMode }
    })
  }

  const toggleActiveBadge = (badgeId) => {
    setForm((prev) => {
      const current = prev.activeCustomBadgeIds ?? []
      const exists = current.includes(badgeId)
      const activeCustomBadgeIds = exists
        ? current.filter((id) => id !== badgeId)
        : [...current, badgeId].slice(0, 6)
      return { ...prev, activeCustomBadgeIds }
    })
  }

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

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <p className="text-sm font-semibold">Badge display</p>
            <p className="mt-1 text-xs text-slate-500">
              Use built-in seal styles, one uploaded badge, or show multiple uploaded badges side by side.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {[
                { id: 'builtin', label: 'Built-in style' },
                { id: 'custom', label: 'Single custom image' },
                { id: 'multiple', label: 'Multiple custom images' },
              ].map((mode) => (
                <label key={mode.id} className="inline-flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="display-mode"
                    checked={form.displayMode === mode.id}
                    disabled={mode.id !== 'builtin' && !(form.customBadges?.length)}
                    onChange={() => setForm({ ...form, displayMode: mode.id })}
                  />
                  {mode.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Your badge library</p>
            <p className="mt-1 text-xs text-amber-900/70 dark:text-amber-100/70">
              Upload one or more PNG, WebP, JPEG, or GIF badge images. Max 5MB each, up to 20 badges.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              multiple
              onChange={handleBadgeUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || (form.customBadges?.length ?? 0) >= 20}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {uploading ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
              {uploading ? 'Uploading...' : 'Upload badge images'}
            </button>

            {(form.customBadges?.length ?? 0) > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {form.customBadges.map((badge) => {
                  const isSingle = form.displayMode === 'custom' && form.customBadgeId === badge.id
                  const isMulti = form.displayMode === 'multiple' && (form.activeCustomBadgeIds ?? []).includes(badge.id)
                  return (
                    <div
                      key={badge.id}
                      className={`rounded-xl border bg-white p-3 dark:bg-slate-900/40 ${
                        isSingle || isMulti
                          ? 'border-amber-400 ring-1 ring-amber-300'
                          : 'border-slate-200 dark:border-white/10'
                      }`}
                    >
                      <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-slate-50 dark:bg-white/5">
                        <img src={badge.imageUrl} alt={badge.label || 'Badge'} className="max-h-full max-w-full object-contain" />
                      </div>
                      <input
                        value={badge.label || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            customBadges: (prev.customBadges ?? []).map((item) =>
                              item.id === badge.id ? { ...item, label: e.target.value } : item,
                            ),
                          }))
                        }
                        placeholder="Badge label"
                        className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.displayMode === 'custom' ? (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, customBadgeId: badge.id })}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isSingle ? 'bg-amber-600 text-white' : 'border border-slate-200 dark:border-white/10'
                            }`}
                          >
                            Use this badge
                          </button>
                        ) : null}
                        {form.displayMode === 'multiple' ? (
                          <button
                            type="button"
                            onClick={() => toggleActiveBadge(badge.id)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isMulti ? 'bg-amber-600 text-white' : 'border border-slate-200 dark:border-white/10'
                            }`}
                          >
                            {isMulti ? 'Selected' : 'Show on site'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeCustomBadge(badge.id)}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <ImagePlus size={16} /> No custom badges yet
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium">Built-in badge style</p>
            <p className="mb-2 text-xs text-slate-500">Used when display mode is “Built-in style”.</p>
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
            {form.displayMode === 'builtin'
              ? `${form.style === 'simple' ? 'Compact CTA companion' : 'Seal-style badge'} · ${previewCount.toLocaleString()} reviews`
              : form.displayMode === 'multiple'
                ? `${previewBadge.customImageUrls?.length ?? 0} custom badge${(previewBadge.customImageUrls?.length ?? 0) === 1 ? '' : 's'}`
                : 'Single custom badge'}
          </p>
        </aside>
      </form>
    </div>
  )
}
