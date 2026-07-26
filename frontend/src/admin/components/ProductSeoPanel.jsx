import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import { analyzeProductSeo, seoScoreBadgeClass } from '../../lib/productSeo'

function StatusBadge({ status }) {
  const tone =
    status.tone === 'good'
      ? 'bg-emerald-100 text-emerald-800'
      : status.tone === 'warning'
        ? 'bg-amber-100 text-amber-900'
        : 'bg-rose-100 text-rose-800'
  return <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${tone}`}>{status.label}</span>
}

function CheckIcon({ ok, severity }) {
  if (ok) {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check size={12} strokeWidth={3} />
      </span>
    )
  }
  if (severity === 'warning') {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
        !
      </span>
    )
  }
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
      <X size={12} strokeWidth={3} />
    </span>
  )
}

/**
 * Rank Math–style SEO score & checklist for admin product editing.
 */
export default function ProductSeoPanel({
  name,
  slug,
  description,
  imageUrl,
  seoTitle,
  seoDescription,
  focusKeywords = [],
  variantDescriptions = [],
  onChange,
}) {
  const [tab, setTab] = useState('general')
  const [keywordDraft, setKeywordDraft] = useState('')
  const [openSections, setOpenSections] = useState({ basic: true, additional: false, title: false, content: false })
  const [editSnippet, setEditSnippet] = useState(false)

  const analysis = useMemo(
    () =>
      analyzeProductSeo({
        name,
        slug,
        description,
        imageUrl,
        seoTitle,
        seoDescription,
        focusKeywords,
        variantDescriptions,
      }),
    [name, slug, description, imageUrl, seoTitle, seoDescription, focusKeywords, variantDescriptions],
  )

  const addKeyword = () => {
    const value = keywordDraft.trim().toLowerCase()
    if (!value) return
    if (focusKeywords.some((k) => k.toLowerCase() === value)) {
      setKeywordDraft('')
      return
    }
    onChange({ focusKeywords: [...focusKeywords, value].slice(0, 10) })
    setKeywordDraft('')
  }

  const removeKeyword = (keyword) => {
    onChange({ focusKeywords: focusKeywords.filter((k) => k !== keyword) })
  }

  const toggleSection = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="sm:col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Rank Math SEO</p>
          <p className="text-[11px] text-slate-500">Live score and optimization checklist for this product</p>
        </div>
        <div className={`rounded-lg border px-3 py-1.5 text-sm font-extrabold ${seoScoreBadgeClass(analysis.score)}`}>
          {analysis.score} / 100
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 px-2 pt-2 dark:border-white/10">
        {[
          { id: 'general', label: 'General' },
          { id: 'advanced', label: 'Advanced' },
          { id: 'social', label: 'Social' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${
              tab === item.id
                ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-4">
        {tab === 'general' ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search Preview</p>
                <button
                  type="button"
                  onClick={() => setEditSnippet((v) => !v)}
                  className="text-xs font-semibold text-[#f97316] hover:underline"
                >
                  {editSnippet ? 'Hide snippet editor' : 'Edit Snippet'}
                </button>
              </div>
              <p className="truncate text-xs text-emerald-700">{analysis.preview.url}</p>
              <p className="mt-1 text-base font-semibold leading-snug text-[#1a0dab] line-clamp-2">
                {analysis.preview.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#4d5156] line-clamp-3">{analysis.preview.description}</p>
            </div>

            {editSnippet ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium">SEO title</span>
                  <input
                    value={seoTitle ?? ''}
                    onChange={(e) => onChange({ seoTitle: e.target.value })}
                    placeholder={name || 'Product SEO title'}
                    maxLength={200}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">{(seoTitle || name || '').length}/60 ideal</span>
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium">Meta description</span>
                  <textarea
                    value={seoDescription ?? ''}
                    onChange={(e) => onChange({ seoDescription: e.target.value })}
                    placeholder="Write a compelling meta description with your focus keyword…"
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {(seoDescription || '').length}/160 ideal
                  </span>
                </label>
              </div>
            ) : null}

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium">Focus Keyword(s)</span>
                <span className={`rounded-lg border px-2.5 py-1 text-xs font-extrabold ${seoScoreBadgeClass(analysis.score)}`}>
                  {analysis.score} / 100
                </span>
              </div>
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                {focusKeywords.map((keyword) => {
                  const result = analysis.keywordResults.find((k) => k.keyword === keyword)
                  return (
                    <span
                      key={keyword}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        result?.ok
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {keyword}
                      <button type="button" onClick={() => removeKeyword(keyword)} aria-label={`Remove ${keyword}`}>
                        <X size={12} />
                      </button>
                    </span>
                  )
                })}
                <input
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addKeyword()
                    }
                  }}
                  onBlur={addKeyword}
                  placeholder={focusKeywords.length ? 'Add another…' : 'e.g. windows 11 pro'}
                  className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Press Enter to add. Primary keyword is the first tag.</p>
            </div>

            <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
              {analysis.sections.map((section) => {
                const open = openSections[section.id]
                return (
                  <div key={section.id}>
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        {section.label}
                      </span>
                      <StatusBadge status={section.status} />
                    </button>
                    {open ? (
                      <ul className="space-y-2 px-3 pb-3">
                        {section.checks.map((check) => (
                          <li key={check.id} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <CheckIcon ok={check.ok} severity={check.severity} />
                            <span>{check.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </>
        ) : null}

        {tab === 'advanced' ? (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Canonical URL:{' '}
              <span className="font-medium text-slate-800 dark:text-slate-100">
                https://www.esoftwarestore.com/product/{slug || '…'}
              </span>
            </p>
            <p>Robots: index, follow (storefront default)</p>
            <p className="text-xs text-slate-500">
              Word count {analysis.stats.words} · Title {analysis.stats.titleLen} chars · Meta{' '}
              {analysis.stats.metaLen} chars · Density {analysis.stats.density}%
            </p>
          </div>
        ) : null}

        {tab === 'social' ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Graph preview</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-black/20">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 items-center justify-center bg-slate-100 text-xs text-slate-400 dark:bg-white/5">
                  No image
                </div>
              )}
              <div className="p-3">
                <p className="text-[11px] uppercase text-slate-400">esoftwarestore.com</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                  {analysis.preview.title}
                </p>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{analysis.preview.description}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
