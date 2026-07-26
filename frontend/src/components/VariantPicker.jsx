import { formatPrice } from '../lib/api'

/**
 * Amazon-style edition / variant picker for the product page.
 */
export default function VariantPicker({
  variants = [],
  selectedId,
  onSelect,
  currency,
  hidePrice = false,
  label = 'Edition',
}) {
  const options = (variants ?? []).filter((v) => v && (v.active !== false))
  if (options.length <= 1) return null

  const selected = options.find((v) => v.id === selectedId) ?? options[0]
  const basePrice = Number(
    options.reduce((min, v) => {
      const p = Number(v.displayPrice ?? v.price ?? Infinity)
      return p < min ? p : min
    }, Infinity),
  )

  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-store-heading">
          {label}:{' '}
          <span className="font-bold text-[#ea580c]">{selected?.tierLabel || selected?.name}</span>
        </p>
        {!hidePrice && Number.isFinite(basePrice) ? (
          <p className="text-xs text-store-muted">From {formatPrice(basePrice, currency)}</p>
        ) : null}
      </div>

      <div
        className="grid gap-2 sm:grid-cols-2"
        role="listbox"
        aria-label={`Select ${label.toLowerCase()}`}
      >
        {options.map((v) => {
          const active = v.id === selectedId
          const price = Number(v.displayPrice ?? v.price ?? 0)
          const original = Number(v.displayOriginalPrice ?? v.originalPrice ?? 0)
          const delta = Number.isFinite(basePrice) ? price - basePrice : 0
          const outOfStock = Number(v.stock) <= 0

          return (
            <button
              key={v.id}
              type="button"
              role="option"
              aria-selected={active}
              disabled={outOfStock}
              onClick={() => onSelect(v.id)}
              className={[
                'relative rounded-xl border-2 px-3 py-3 text-left transition-all',
                active
                  ? 'border-[#f97316] bg-[#fff7ed] shadow-sm dark:bg-[#431407]/40'
                  : 'border-store hover:border-[#f97316]/55 bg-store-card',
                outOfStock ? 'cursor-not-allowed opacity-55' : '',
              ].join(' ')}
            >
              {active ? (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#f97316]" aria-hidden />
              ) : null}
              <span className="flex gap-3">
                {v.imageUrl ? (
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-store-hover">
                    <img src={v.imageUrl} alt="" className="h-full w-full object-cover" />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-store-heading">
                    {v.tierLabel || v.name}
                  </span>
                  {!hidePrice ? (
                    <span className="mt-1 flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="font-bold text-[#ea580c]">{formatPrice(price, currency)}</span>
                      {original > price ? (
                        <span className="text-xs text-store-muted line-through">
                          {formatPrice(original, currency)}
                        </span>
                      ) : null}
                      {delta > 0 ? (
                        <span className="text-[11px] font-medium text-store-muted">
                          +{formatPrice(delta, currency)}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <span className="mt-1 block text-[11px] text-store-muted">
                    {outOfStock ? 'Out of stock' : `${v.stock} in stock`}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
