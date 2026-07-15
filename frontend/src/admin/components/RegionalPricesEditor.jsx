import { COUNTRY_REGION, CURRENCY_SYMBOLS, REGION_OPTIONS } from '../../lib/region'

export function currencyForCountry(countryCode) {
  return COUNTRY_REGION[countryCode]?.currency ?? 'INR'
}

export function symbolForCurrency(currency) {
  return CURRENCY_SYMBOLS[currency] ?? currency
}

export function regionalPricesToMap(rows = []) {
  const map = {}
  for (const row of rows) {
    if (!row?.countryCode) continue
    map[row.countryCode] = String(row.price ?? '')
  }
  return map
}

export function mapToRegionalPricesPayload(priceByCountry = {}) {
  return REGION_OPTIONS.map((region) => {
    const raw = priceByCountry[region.country]
    const price = raw === '' || raw == null ? null : Number(raw)
    return {
      countryCode: region.country,
      price: Number.isFinite(price) && price > 0 ? price : null,
      currency: currencyForCountry(region.country),
    }
  })
}

export function countRegionalOverrides(priceByCountry = {}) {
  return REGION_OPTIONS.filter((region) => {
    const n = Number(priceByCountry[region.country])
    return Number.isFinite(n) && n > 0
  }).length
}

/**
 * Per-product regional price editor.
 * Values are local-currency sale prices keyed by ISO country code.
 */
export default function RegionalPricesEditor({
  priceByCountry = {},
  onChange,
  disabled = false,
  compact = false,
}) {
  const pricedCount = countRegionalOverrides(priceByCountry)

  const setPrice = (countryCode, value) => {
    onChange({
      ...priceByCountry,
      [countryCode]: value,
    })
  }

  const clearPrice = (countryCode) => {
    const next = { ...priceByCountry }
    delete next[countryCode]
    onChange(next)
  }

  return (
    <div className={compact ? '' : 'rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10'}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
            Regional prices (this product only)
          </p>
          <p className="mt-0.5 text-xs text-emerald-900/70 dark:text-emerald-200/70">
            Set a local sale price per country for this product. Leave blank to use the base INR price with currency conversion.
          </p>
        </div>
        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
          {pricedCount} override{pricedCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className={`mt-3 space-y-2 pr-1 ${compact ? 'max-h-[22rem] overflow-y-auto' : 'max-h-[26rem] overflow-y-auto'}`}>
        {REGION_OPTIONS.map((region) => {
          const currency = currencyForCountry(region.country)
          const value = priceByCountry[region.country] ?? ''
          return (
            <div
              key={region.country}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/80 bg-white px-3 py-2 dark:border-emerald-500/20 dark:bg-white/5"
            >
              <span className="w-28 shrink-0 text-sm font-medium">
                <span className="mr-1">{region.flag}</span>
                {region.country}
              </span>
              <span className="w-10 shrink-0 text-xs text-slate-400">{currency}</span>
              <div className="relative min-w-[8rem] flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {symbolForCurrency(currency)}
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="Auto"
                  disabled={disabled}
                  value={value}
                  onChange={(e) => setPrice(region.country, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm disabled:opacity-60 dark:border-white/10 dark:bg-transparent"
                />
              </div>
              {value ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => clearPrice(region.country)}
                  className="rounded-full px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-500/10"
                >
                  Clear
                </button>
              ) : (
                <span className="w-12 text-center text-[10px] uppercase tracking-wide text-slate-400">FX</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
