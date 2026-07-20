import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoaderCircle, Mail, RefreshCw, Search, Send } from 'lucide-react'
import { dashboardApi, formatMoney } from '../api'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'abandoned', label: 'Abandoned' },
  { value: 'recovered', label: 'Recovered' },
  { value: 'submitted_order', label: 'Submitted order' },
]

function formatLastActive(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function statusLabel(status) {
  const map = {
    abandoned: 'Abandoned',
    recovered: 'Recovered',
    submitted_order: 'Submitted order',
  }
  return map[status] ?? status
}

function statusClass(status) {
  const map = {
    abandoned: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    recovered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    submitted_order: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  }
  return map[status] ?? 'bg-slate-100 text-slate-700'
}

function ProductThumbs({ products = [] }) {
  if (!products.length) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 dark:border-white/10">
        —
      </div>
    )
  }

  return (
    <div className="flex items-center -space-x-2">
      {products.slice(0, 4).map((product) => (
        <div
          key={`${product.slug}-${product.name}`}
          className="h-10 w-10 overflow-hidden rounded-lg border-2 border-white bg-slate-100 shadow-sm dark:border-slate-900 dark:bg-white/10"
          title={product.name}
        >
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
              {product.name?.slice(0, 2)?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
      ))}
      {products.length > 4 ? (
        <span className="ml-3 text-xs font-semibold text-slate-500">+{products.length - 4}</span>
      ) : null}
    </div>
  )
}

export default function AbandonedCartsTab() {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())
      const data = await dashboardApi(`/api/admin/abandoned-carts?${params.toString()}`)
      setRows(data.carts ?? [])
      setSummary(data.summary ?? null)
      setSelected(new Set())
    } catch (err) {
      setRows([])
      setSummary(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const allSelected = rows.length > 0 && selected.size === rows.length

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(rows.map((row) => row.id)))
  }

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runFollowUps = async () => {
    setProcessing(true)
    setStatus('')
    try {
      const result = await dashboardApi('/api/admin/abandoned-carts/process', { method: 'POST' })
      setStatus(
        `Processed ${result.checked ?? 0} carts · ${result.sent ?? 0} sent · ${result.skipped ?? 0} skipped · ${result.failed ?? 0} failed`,
      )
      await load()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const statCards = useMemo(
    () => [
      { label: 'Abandoned', value: summary?.abandoned ?? 0, tone: 'text-rose-600' },
      { label: 'Recovered', value: summary?.recovered ?? 0, tone: 'text-emerald-600' },
      { label: 'Submitted order', value: summary?.submitted_order ?? 0, tone: 'text-orange-600' },
      { label: 'Total tracked', value: summary?.total ?? rows.length, tone: 'text-sky-600' },
    ],
    [summary, rows.length],
  )

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Mail size={22} className="text-sky-600" /> Abandoned cart tracking
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor customers who left checkout and track reminder emails (1h · 24h · 72h).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-white/10"
          >
            {loading ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button
            type="button"
            onClick={runFollowUps}
            disabled={processing}
            className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {processing ? <LoaderCircle className="animate-spin" size={14} /> : <Send size={14} />}
            Send due reminders
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          load()
        }}
        className="mt-5 flex flex-wrap items-center gap-2"
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer email..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm dark:border-white/10 dark:bg-white/5"
          />
        </div>
        <button type="submit" className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      {status ? (
        <p className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
          {status}
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-rose-500">{error}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reminders</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  <LoaderCircle className="mx-auto mb-2 animate-spin" size={18} />
                  Loading abandoned carts…
                </td>
              </tr>
            ) : null}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No abandoned carts match this filter yet.
                </td>
              </tr>
            ) : null}
            {!loading
              ? rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                    <td className="px-4 py-4 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.email}`}
                      />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{row.email}</p>
                      {row.countryCode ? (
                        <p className="mt-0.5 text-xs text-slate-500">{row.countryCode}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <ProductThumbs products={row.products} />
                    </td>
                    <td className="px-4 py-4 align-middle font-semibold">
                      {formatMoney(row.amount, row.currency)}
                    </td>
                    <td className="px-4 py-4 align-middle text-slate-600 dark:text-slate-300">
                      {formatLastActive(row.lastActive)}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.trackingStatus)}`}>
                        {statusLabel(row.trackingStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle text-xs text-slate-500">
                      {row.followUpStage}/3 sent
                      {row.lastEmailAt ? (
                        <span className="mt-0.5 block">Last {formatLastActive(row.lastEmailAt)}</span>
                      ) : (
                        <span className="mt-0.5 block">No emails yet</span>
                      )}
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
