import { REGION_OPTIONS } from '../../lib/region'

export function toggleCode(list, code) {
  const next = new Set(list ?? [])
  if (next.has(code)) next.delete(code)
  else next.add(code)
  return [...next]
}

export function CountryRestrictionPicker({
  label,
  hint,
  selected = [],
  onChange,
}) {
  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <p className="mb-1 text-xs font-medium">{label}</p>
      {hint ? <p className="mb-2 text-xs text-slate-500">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {REGION_OPTIONS.map((region) => {
          const active = selected.includes(region.country)
          return (
            <button
              key={region.country}
              type="button"
              onClick={() => onChange(toggleCode(selected, region.country))}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'
              }`}
            >
              {region.flag} {region.country}
            </button>
          )
        })}
      </div>
      {selected.length ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-2 text-xs font-semibold text-slate-500 hover:text-sky-600"
        >
          Clear selection
        </button>
      ) : null}
    </div>
  )
}

export function ProductRestrictionPicker({
  products = [],
  selected = [],
  onChange,
}) {
  const toggle = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <p className="mb-1 text-xs font-medium">Product restriction (optional)</p>
      <p className="mb-2 text-xs text-slate-500">
        Leave empty for all products. Selected products only can use this coupon.
      </p>
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-white/10">
        {products.length === 0 ? (
          <p className="text-xs text-slate-500">No products loaded</p>
        ) : (
          products.map((product) => (
            <label key={product.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5">
              <input
                type="checkbox"
                checked={selected.includes(product.id)}
                onChange={() => toggle(product.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm">
                <span className="font-medium">{product.name}</span>
                <span className="ml-2 text-xs text-slate-500">{product.category}</span>
              </span>
            </label>
          ))
        )}
      </div>
      {selected.length ? (
        <p className="mt-2 text-xs text-slate-500">{selected.length} product(s) selected</p>
      ) : null}
    </div>
  )
}

export function encodeList(list) {
  if (!list?.length) return null
  return JSON.stringify(list)
}
