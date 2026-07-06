import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react'
import { dashboardApi, formatMoney } from '../api'
import OrderDetailPanel from '../components/OrderDetailPanel'

function shortId(id) {
  if (!id) return '—'
  const value = String(id)
  return value.length > 8 ? value.slice(-8).toUpperCase() : value.toUpperCase()
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function statusBadge(status) {
  const map = {
    paid: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-emerald-100 text-emerald-700',
    processing: 'bg-sky-100 text-sky-700',
    pending: 'bg-amber-100 text-amber-700',
    created: 'bg-amber-100 text-amber-700',
    refunded: 'bg-rose-100 text-rose-700',
    cancelled: 'bg-slate-100 text-slate-700',
    on_hold: 'bg-orange-100 text-orange-700',
  }
  return map[status] ?? 'bg-slate-100 text-slate-700'
}

function money(amount, currency = 'INR') {
  return formatMoney(amount, currency)
}

export default function OrdersTab({ isAdmin, formatMoney: formatMoneyProp }) {
  const fmt = formatMoneyProp ?? formatMoney
  const [orders, setOrders] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [searchEmail, setSearchEmail] = useState('')

  const toggleExpanded = (id) => {
    setExpandedId((current) => (current === id ? null : id))
  }

  const load = useCallback(async (email) => {
    setLoading(true)
    setError('')
    try {
      const path = isAdmin
        ? email
          ? `/api/admin/orders?email=${encodeURIComponent(email)}`
          : '/api/admin/orders'
        : '/api/vendor/orders'
      const data = await dashboardApi(path)
      setOrders(data.orders ?? [])
      setSummary(isAdmin ? data.summary ?? null : null)
    } catch (err) {
      setOrders([])
      setSummary(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    load()
  }, [load])

  const handleSearch = (e) => {
    e.preventDefault()
    setExpandedId(null)
    load(searchEmail.trim())
  }

  const adminColCount = 4

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{isAdmin ? 'Paid orders' : 'My orders'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? `${summary?.count ?? orders.length} paid orders • Net payout ${fmt(summary?.totalNetPayout ?? 0)}`
              : `${orders.length} records`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(searchEmail.trim() || undefined)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {isAdmin && summary ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer paid</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{fmt(summary.totalPaid)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gateway fees</p>
            <p className="mt-1 text-xl font-bold text-rose-600">{fmt(summary.totalGatewayFee)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gateway tax</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{fmt(summary.totalGatewayTax)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net payout</p>
            <p className="mt-1 text-xl font-bold text-sky-600">{fmt(summary.totalNetPayout)}</p>
          </div>
        </div>
      ) : null}

      {isAdmin ? (
        <form onSubmit={handleSearch} className="mt-4 flex flex-wrap gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Search paid orders by customer email..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <button type="submit" className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white">
            Search
          </button>
          {searchEmail ? (
            <button
              type="button"
              onClick={() => { setSearchEmail(''); load() }}
              className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-white/10"
            >
              Clear
            </button>
          ) : null}
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-500">{error}</p> : null}
      {loading ? <p className="mt-6 text-sm text-slate-500">Loading orders...</p> : null}

      <div className="mt-6">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-white/10">
              <th className="py-3 pr-4">Date</th>
              <th className="py-3 pr-4">Customer</th>
              <th className="py-3 pr-4">Products</th>
              {!isAdmin ? (
                <>
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">License</th>
                </>
              ) : (
                <th className="py-3 text-right"> </th>
              )}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const payment = o.payment ?? {}
              const currency = payment.currency ?? o.currency ?? 'INR'
              const displayStatus = o.orderStatus ?? o.paymentStatus
              const orderId = o.id ?? o.orderId
              if (isAdmin && !payment.paymentConfirmed) return null
              const isExpanded = expandedId === orderId
              return (
                <Fragment key={orderId}>
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-3 pr-4 text-slate-500">{formatDate(o.createdAt)}</td>
                    <td className="py-3 pr-4">{o.customerEmail ?? '—'}</td>
                    <td className="py-3 pr-4">{o.productName ?? '—'}</td>
                    {!isAdmin ? (
                      <>
                        <td className="py-3 pr-4">{fmt(o.total ?? o.amount ?? 0, currency)}</td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge(displayStatus)}`}>
                            {displayStatus?.replace('_', ' ') ?? 'unknown'}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-xs">{o.licenseKey ?? '—'}</td>
                      </>
                    ) : (
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(orderId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    )}
                  </tr>
                  {isAdmin && isExpanded ? (
                    <tr className="border-b border-slate-100 dark:border-white/5">
                      <td colSpan={adminColCount} className="bg-slate-50 p-4 dark:bg-white/5">
                        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-white/10 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Order</p>
                            <p className="mt-1 font-semibold">#{shortId(o.orderId ?? o.id)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                            <p className="mt-1">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge(displayStatus)}`}>
                                {displayStatus?.replace('_', ' ') ?? 'unknown'}
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Customer paid</p>
                            <p className="mt-1 font-semibold text-emerald-700">{money(payment.amountPaid ?? o.total, currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Gateway fee</p>
                            <p className="mt-1 font-semibold text-rose-600">
                              {money((payment.gatewayFee ?? 0) + (payment.gatewayTax ?? 0), currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Net payout</p>
                            <p className="mt-1 font-semibold text-sky-700">{money(payment.netPayout ?? o.total, currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Gateway</p>
                            <p className="mt-1 font-semibold capitalize">{payment.feeProvider ?? o.paymentMethod ?? '—'}</p>
                          </div>
                        </div>
                        <OrderDetailPanel
                          embedded
                          orderId={orderId}
                          formatMoney={fmt}
                          onUpdated={() => load(searchEmail.trim() || undefined)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!loading && orders.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {isAdmin ? 'No paid orders yet. Only successful payments appear here.' : 'No orders yet.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
