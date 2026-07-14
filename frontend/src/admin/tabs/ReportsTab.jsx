import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, Globe2, IndianRupee, LoaderCircle, RefreshCw, TrendingUp } from 'lucide-react'
import { dashboardApi, formatMoney } from '../api'

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10)
}

function formatInr(amount) {
  return formatMoney(amount, 'INR')
}

function BarRow({ label, valueLabel, share, accent = 'bg-sky-500' }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="tabular-nums text-slate-500">{valueLabel}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.max(4, share || 0)}%` }} />
      </div>
    </div>
  )
}

export default function ReportsTab() {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [country, setCountry] = useState('ALL')
  const [groupBy, setGroupBy] = useState('day')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        from,
        to,
        groupBy,
      })
      if (country && country !== 'ALL') params.set('country', country)
      const report = await dashboardApi(`/api/admin/reports/earnings?${params}`)
      setData(report)
    } catch (err) {
      setData(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [from, to, country, groupBy])

  useEffect(() => {
    load()
  }, [load])

  const countries = useMemo(() => data?.countries ?? [], [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Reports</h2>
          <p className="mt-1 text-sm text-slate-500">
            Paid-order earnings by region and period, converted to INR using live FX rates.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
        >
          {loading ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <CalendarRange size={12} /> From
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Globe2 size={12} /> Region
          </span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"
          >
            <option value="ALL">All regions</option>
            {countries.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Group by</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      {loading && !data ? <p className="text-sm text-slate-500">Loading report…</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <IndianRupee size={12} /> Total earnings (INR)
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                {formatInr(data.summary.totalInr)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid orders</p>
              <p className="mt-2 text-2xl font-bold">{data.summary.totalOrders}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg order (INR)</p>
              <p className="mt-2 text-2xl font-bold">{formatInr(data.summary.averageOrderInr)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <TrendingUp size={12} /> FX source
              </p>
              <p className="mt-2 text-lg font-bold capitalize">{data.fx.source}</p>
              <p className="mt-1 text-xs text-slate-500">
                Rate date {data.fx.baseDate}
                {data.fx.source === 'static' ? ' · live feed unavailable, catalog fallback' : ''}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
              <h3 className="text-lg font-bold">Earnings by region</h3>
              <p className="mt-1 text-sm text-slate-500">Converted totals in INR</p>
              <div className="mt-5 space-y-4">
                {data.byRegion.length ? (
                  data.byRegion.map((row) => (
                    <BarRow
                      key={row.countryCode}
                      label={`${row.countryName} · ${row.orders} orders`}
                      valueLabel={formatInr(row.totalInr)}
                      share={row.share}
                      accent="bg-emerald-500"
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No paid earnings in this range.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
              <h3 className="text-lg font-bold">Earnings over time</h3>
              <p className="mt-1 text-sm text-slate-500">Grouped by {groupBy}</p>
              <div className="mt-5 space-y-4">
                {data.byPeriod.length ? (
                  data.byPeriod.map((row) => (
                    <BarRow
                      key={row.period}
                      label={`${row.period} · ${row.orders} orders`}
                      valueLabel={formatInr(row.totalInr)}
                      share={row.share}
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No paid earnings in this range.</p>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="text-lg font-bold">Original currencies → INR</h3>
            <p className="mt-1 text-sm text-slate-500">How each checkout currency contributes after conversion</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-white/10">
                    <th className="py-2 pr-4">Currency</th>
                    <th className="py-2 pr-4">Orders</th>
                    <th className="py-2 pr-4">Original total</th>
                    <th className="py-2 pr-4">INR total</th>
                    <th className="py-2">Live rate → INR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCurrency.map((row) => (
                    <tr key={row.currency} className="border-b border-slate-100 dark:border-white/5">
                      <td className="py-3 pr-4 font-semibold">{row.currency}</td>
                      <td className="py-3 pr-4">{row.orders}</td>
                      <td className="py-3 pr-4">{formatMoney(row.originalTotal, row.currency)}</td>
                      <td className="py-3 pr-4 font-semibold text-emerald-700">{formatInr(row.totalInr)}</td>
                      <td className="py-3 text-slate-500">
                        {row.currency === 'INR'
                          ? '1'
                          : data.fx.ratesToInr[row.currency]
                            ? `1 ${row.currency} = ₹${data.fx.ratesToInr[row.currency]}`
                            : '—'}
                      </td>
                    </tr>
                  ))}
                  {!data.byCurrency.length ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-slate-500">No currency breakdown yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="text-lg font-bold">Region details</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-white/10">
                    <th className="py-2 pr-4">Region</th>
                    <th className="py-2 pr-4">Orders</th>
                    <th className="py-2 pr-4">Earnings (INR)</th>
                    <th className="py-2">Currencies collected</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byRegion.map((row) => (
                    <tr key={row.countryCode} className="border-b border-slate-100 dark:border-white/5">
                      <td className="py-3 pr-4 font-semibold">
                        {row.countryName} <span className="text-xs font-normal text-slate-400">{row.countryCode}</span>
                      </td>
                      <td className="py-3 pr-4">{row.orders}</td>
                      <td className="py-3 pr-4 font-semibold text-emerald-700">{formatInr(row.totalInr)}</td>
                      <td className="py-3 text-slate-500">
                        {row.currencies.map((c) => `${formatMoney(c.originalTotal, c.currency)}`).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
