import { useCallback, useEffect, useState } from 'react'
import { Eye, RefreshCw, Search } from 'lucide-react'
import { dashboardApi } from '../api'
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

export default function OrdersTab({ isAdmin, formatMoney }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [searchEmail, setSearchEmail] = useState('')

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
    } catch (err) {
      setOrders([])
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
    load(searchEmail.trim())
  }

  const paidCount = orders.filter((o) => o.paymentStatus === 'paid').length
  const revenue = orders
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + Number(o.total ?? o.amount ?? 0), 0)

  if (isAdmin && selectedId) {
    return (
      <OrderDetailPanel
        orderId={selectedId}
        formatMoney={formatMoney}
        onBack={() => setSelectedId(null)}
        onUpdated={() => load(searchEmail.trim() || undefined)}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{isAdmin ? 'Orders' : 'My orders'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {orders.length} records • {paidCount} paid • {formatMoney(revenue)} revenue
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

      {isAdmin ? (
        <form onSubmit={handleSearch} className="mt-4 flex flex-wrap gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Search by customer email..."
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

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-white/10">
              <th className="py-3 pr-4">Order</th>
              <th className="py-3 pr-4">Date</th>
              <th className="py-3 pr-4">Customer</th>
              <th className="py-3 pr-4">Products</th>
              <th className="py-3 pr-4">Amount</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Payment</th>
              {isAdmin ? <th className="py-3">Actions</th> : <th className="py-3">License</th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const amount = o.total ?? o.amount ?? 0
              const displayStatus = o.orderStatus ?? o.paymentStatus
              return (
                <tr key={o.id ?? `${o.orderId}-${o.productName}`} className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-3 pr-4 font-medium">#{shortId(o.orderId ?? o.id)}</td>
                  <td className="py-3 pr-4 text-slate-500">{formatDate(o.createdAt)}</td>
                  <td className="py-3 pr-4">{o.customerEmail ?? '—'}</td>
                  <td className="py-3 pr-4 max-w-[200px] truncate">{o.productName ?? '—'}</td>
                  <td className="py-3 pr-4">{formatMoney(amount)}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge(displayStatus)}`}>
                      {displayStatus?.replace('_', ' ') ?? 'unknown'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 capitalize text-slate-500">{o.paymentMethod ?? '—'}</td>
                  {isAdmin ? (
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(o.id ?? o.orderId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:border-sky-900/40 dark:text-sky-300"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  ) : (
                    <td className="py-3 font-mono text-xs">{o.licenseKey ?? '—'}</td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && orders.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No orders yet. Completed checkouts will appear here.</p>
        ) : null}
      </div>
    </div>
  )
}
