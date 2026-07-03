import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { dashboardApi } from '../api'

function shortId(id) {
  if (!id) return '—'
  const value = String(id)
  return value.length > 8 ? value.slice(-8) : value
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export default function OrdersTab({ isAdmin, formatMoney }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const path = isAdmin ? '/api/admin/orders' : '/api/vendor/orders'
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

  const paidCount = orders.filter((o) => o.paymentStatus === 'paid').length
  const revenue = orders
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + Number(o.total ?? o.amount ?? (o.unitPrice ? o.unitPrice * (o.quantity ?? 1) : 0)), 0)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{isAdmin ? 'All orders' : 'My orders'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {orders.length} records • {paidCount} paid • {formatMoney(revenue)} revenue
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-500">{error}</p> : null}
      {loading ? <p className="mt-6 text-sm text-slate-500">Loading orders...</p> : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-white/10">
              <th className="py-3 pr-4">Order</th>
              <th className="py-3 pr-4">Date</th>
              <th className="py-3 pr-4">Customer</th>
              <th className="py-3 pr-4">Products</th>
              <th className="py-3 pr-4">Amount</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3">License</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const amount = o.total ?? o.amount ?? (o.unitPrice ? o.unitPrice * (o.quantity ?? 1) : 0)
              return (
                <tr key={o.id ?? `${o.orderId}-${o.productName}`} className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-3 pr-4 font-medium">#{shortId(o.orderId ?? o.id)}</td>
                  <td className="py-3 pr-4 text-slate-500">{formatDate(o.createdAt)}</td>
                  <td className="py-3 pr-4">{o.customerEmail ?? '—'}</td>
                  <td className="py-3 pr-4">{o.productName ?? '—'}</td>
                  <td className="py-3 pr-4">{formatMoney(amount)}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                      o.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : o.paymentStatus === 'created' || o.paymentStatus === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}>
                      {o.paymentStatus ?? 'unknown'}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-xs">{o.licenseKey ?? '—'}</td>
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
