import { useEffect, useRef, useState } from 'react'
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { LOCALE_LABELS, REGION_OPTIONS } from '../lib/region'

export default function RegionSelector() {
  const { t } = useTranslation()
  const { country, currency, locale, setRegion, regionAuto } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = REGION_OPTIONS.find((r) => r.country === country) ?? {
    country,
    label: country,
    flag: '🌍',
  }

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-store bg-store-subtle px-2.5 py-1.5 text-xs font-semibold text-store-body transition-colors hover:border-[#f97316] hover:text-[#f97316] sm:px-3"
        aria-expanded={open}
        aria-label={t('region')}
      >
        <Globe size={14} className="text-store-muted" />
        <span className="hidden sm:inline">{current.flag}</span>
        <span>{currency}</span>
        <span className="hidden text-store-muted md:inline">· {LOCALE_LABELS[locale] ?? locale}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[60] mt-2 w-72 overflow-hidden rounded-2xl border border-store bg-store-surface shadow-xl animate-fade-in-up">
          <div className="border-b border-store bg-store-subtle px-4 py-3">
            <p className="text-sm font-bold text-store-heading">{t('region')}</p>
            {regionAuto ? (
              <p className="mt-0.5 text-[11px] text-store-muted">{t('autoDetected')}</p>
            ) : null}
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-store-muted">
              {t('region')}
            </p>
            {REGION_OPTIONS.map((opt) => (
              <button
                key={opt.country}
                type="button"
                onClick={() => {
                  setRegion({ country: opt.country }, true)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  country === opt.country
                    ? 'bg-store-primary-muted font-semibold text-[#f97316]'
                    : 'hover:bg-store-hover text-store-body'
                }`}
              >
                <span>{opt.flag}</span>
                <span className="flex-1">{opt.label}</span>
                <span className="text-xs text-store-muted">{opt.country}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-store p-2">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-store-muted">
              {t('language')}
            </p>
            <div className="flex flex-wrap gap-1.5 p-1">
              {Object.entries(LOCALE_LABELS).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setRegion({ locale: code }, true)
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    locale === code
                      ? 'bg-[#f97316] text-white'
                      : 'bg-store-hover text-store-body hover:bg-store-primary-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
