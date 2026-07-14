import { useEffect, useMemo, useState } from 'react'
import { Globe2, LoaderCircle, Search, Save } from 'lucide-react'
import { dashboardApi } from '../api'
import { CountryRestrictionPicker } from '../components/RestrictionPickers'
import { REGION_OPTIONS } from '../../lib/region'

function summarize(product) {
  const allowed = product.allowedCountries ?? []
  const blocked = product.blockedCountries ?? []
  if (!allowed.length && !blocked.length) return 'Worldwide'
  const parts = []
  if (allowed.length) {
    parts.push(`Allow ${allowed.map((code) => REGION_OPTIONS.find((r) => r.country === code)?.flag ?? code).join(' ')}`)
  }
  if (blocked.length) {
    parts.push(`Block ${blocked.map((code) => REGION_OPTIONS.find((r) => r.country === code)?.flag ?? code).join(' ')}`)
  }
  return parts.join(' · ')
}

export default function RegionsTab() {
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [allowedCountries, setAllowedCountries] = useState([])
  const [blockedCountries, setBlockedCountries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await dashboardApi('/api/admin/products')
      setProducts(data.products ?? [])
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q),
    )
  }, [products, query])

  const selected = products.find((p) => p.id === selectedId) ?? null

  const openProduct = (product) => {
    setSelectedId(product.id)
    setAllowedCountries(product.allowedCountries ?? [])
    setBlockedCountries(product.blockedCountries ?? [])
    setStatus('')
  }

  const save = async (e) => {
    e.preventDefault()
    if (!selectedId) return
    setSaving(true)
    setStatus('')
    try {
      const result = await dashboardApi(`/api/admin/products/${selectedId}/regions`, {
        method: 'PATCH',
        body: JSON.stringify({
          allowedCountries,
          blockedCountries,
        }),
      })
      setProducts((prev) =>
        prev.map((p) =>
          p.id === selectedId
            ? {
                ...p,
                allowedCountries: result.product.allowedCountries ?? [],
                blockedCountries: result.product.blockedCountries ?? [],
              }
            : p,
        ),
      )
      setStatus(`Saved region rules for ${result.product.name}`)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Regions</h2>
        <p className="mt-1 text-sm text-slate-500">
          Control which countries can see each product. Leave allowed empty for worldwide, then optionally block specific countries.
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 dark:border-white/10 dark:bg-white/5"
        />
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading products…</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          {filtered.map((product) => {
            const active = product.id === selectedId
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => openProduct(product)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30'
                    : 'border-slate-200 hover:border-sky-300 dark:border-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-sky-700 dark:bg-white/10 dark:text-sky-300">
                    <Globe2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{product.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {product.category} · /{product.slug}
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {summarize(product)}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
          {!loading && !filtered.length ? (
            <p className="text-sm text-slate-500">No products match your search.</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
          {!selected ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-500">
              <Globe2 size={28} className="mb-3 text-slate-400" />
              <p className="font-medium">Select a product</p>
              <p className="mt-1 text-sm">Choose a product on the left to set allowed and blocked countries.</p>
            </div>
          ) : (
            <form onSubmit={save} className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Editing</p>
                <h3 className="mt-1 text-xl font-bold">{selected.name}</h3>
              </div>

              <CountryRestrictionPicker
                label="Allowed countries (optional)"
                hint="Leave empty for worldwide. If set, product is only visible in selected countries."
                selected={allowedCountries}
                onChange={setAllowedCountries}
              />
              <CountryRestrictionPicker
                label="Blocked countries (optional)"
                hint="Customers in these countries will not see this product."
                selected={blockedCountries}
                onChange={setBlockedCountries}
              />

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/5">
                Preview: {summarize({ allowedCountries, blockedCountries })}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />}
                Save region rules
              </button>
            </form>
          )}
        </div>
      </div>

      {status ? <p className="text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
