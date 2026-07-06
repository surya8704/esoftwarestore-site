import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Mail, MessageCircle, Phone, RefreshCw, Search } from 'lucide-react'
import { dashboardApi, formatMoney } from '../api'
import OrderDetailPanel from '../components/OrderDetailPanel'

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

function CurrencyStats({ stats, compact = false }) {
  const rows = stats?.currencyStats ?? []
  if (!rows.length) {
    return <span className="text-slate-400">No paid orders</span>
  }

  if (compact && rows.length === 1) {
    const row = rows[0]
    return (
      <div className="text-xs">
        <p className="font-semibold">{formatMoney(row.totalRevenue, row.currency)}</p>
        <p className="text-slate-500">AOV {formatMoney(row.averageOrderValue, row.currency)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div key={row.currency} className={compact ? 'text-xs' : 'text-sm'}>
          <p className="font-semibold">
            {formatMoney(row.totalRevenue, row.currency)}
            <span className="ml-1 font-normal text-slate-500">({row.currency})</span>
          </p>
          <p className="text-slate-500">
            {row.paidOrders} order{row.paidOrders === 1 ? '' : 's'} • AOV {formatMoney(row.averageOrderValue, row.currency)}
          </p>
        </div>
      ))}
    </div>
  )
}

function CustomerExpandedPanel({ email, formatMoney: fmt, expandedOrderId, onToggleOrder, onOrderUpdated }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await dashboardApi(`/api/admin/customers/${encodeURIComponent(email)}`)
      setData(result)
    } catch (err) {
      setData(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [email])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-sm text-slate-500">Loading customer history...</p>
  if (error) return <p className="text-sm text-rose-500">{error}</p>
  if (!data) return <p className="text-sm text-slate-500">Customer not found.</p>

  const { stats, orders, user } = data
  const contact = data.contact ?? orders[0]?.contact ?? null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/40 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{user?.name ?? email}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Mail size={14} /> {email}
            {user ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">Registered</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Guest only</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {contact ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-white/5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Country</p>
            <p className="mt-1 font-semibold">
              {contact.countryLabel ?? contact.countryCode ?? '—'}
              {contact.countryCode ? <span className="ml-1 text-xs text-slate-400">({contact.countryCode})</span> : null}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500"><Phone size={12} /> Phone</p>
            <p className="mt-1 font-semibold">{contact.phoneDisplay ?? contact.phone ?? '—'}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500"><MessageCircle size={12} /> WhatsApp</p>
            <p className="mt-1 font-semibold text-emerald-700">{contact.whatsappDisplay ?? contact.whatsapp ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Dial code</p>
            <p className="mt-1 font-semibold">{contact.dialCode ?? '—'}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide text-slate-500">Paid orders</p>
          <p className="mt-1 text-xl font-bold">{stats.paidOrders}</p>
        </div>
        {(stats.currencyStats ?? []).map((row) => (
          <div key={row.currency} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Revenue ({row.currency})</p>
            <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-100">{fmt(row.totalRevenue, row.currency)}</p>
            <p className="mt-1 text-xs text-emerald-700">AOV {fmt(row.averageOrderValue, row.currency)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.filter((order) => order.payment?.paymentConfirmed !== false).map((order) => {
              const currency = order.currency || 'INR'
              const status = order.orderStatus ?? order.paymentStatus ?? 'pending'
              const isOrderExpanded = expandedOrderId === order.id
              return (
                <Fragment key={order.id}>
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <td className="px-4 py-3 font-mono text-xs">{String(order.id).slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{order.productName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{fmt(order.total, currency)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onToggleOrder(order.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                        aria-expanded={isOrderExpanded}
                      >
                        {isOrderExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {isOrderExpanded ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {isOrderExpanded ? (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 p-4 dark:bg-white/5">
                        <OrderDetailPanel
                          embedded
                          orderId={order.id}
                          formatMoney={fmt}
                          onUpdated={onOrderUpdated}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {orders.length === 0 ? <p className="p-6 text-sm text-slate-500">No paid orders for this customer.</p> : null}
      </div>
    </div>
  )
}

export default function CustomersTab({ formatMoney: formatMoneyProp }) {
  const fmt = formatMoneyProp ?? formatMoney
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [gmailOnly, setGmailOnly] = useState(false)
  const [expandedEmail, setExpandedEmail] = useState(null)
  const [expandedOrderId, setExpandedOrderId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (gmailOnly) params.set('gmail', '1')
      const qs = params.toString()
      const data = await dashboardApi(`/api/admin/customers${qs ? `?${qs}` : ''}`)
      setCustomers(data.customers ?? [])
    } catch (err) {
      setCustomers([])
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, gmailOnly])

  useEffect(() => {
    load()
  }, [load])

  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.email.localeCompare(b.email, undefined, { sensitivity: 'base' })),
    [customers],
  )

  const toggleCustomer = (email) => {
    setExpandedOrderId(null)
    setExpandedEmail((current) => (current === email ? null : email))
  }

  const toggleOrder = (orderId) => {
    setExpandedOrderId((current) => (current === orderId ? null : orderId))
  }

  const customerColCount = 5

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Customers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Paid customers only • click Details to expand order history
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

      <form
        onSubmit={(e) => { e.preventDefault(); setExpandedEmail(null); setExpandedOrderId(null); load() }}
        className="mt-6 flex flex-wrap items-center gap-3"
      >
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email..."
            className="w-full rounded-full border border-slate-200 py-2 pl-9 pr-4 text-sm dark:border-white/10 dark:bg-white/5"
          />
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-white/10">
          <input
            type="checkbox"
            checked={gmailOnly}
            onChange={(e) => setGmailOnly(e.target.checked)}
            className="rounded"
          />
          Gmail only
        </label>
        <button type="submit" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      {loading ? <p className="mt-6 text-slate-500">Loading customers...</p> : null}
      {error ? <p className="mt-6 text-rose-500">{error}</p> : null}

      {!loading && !error ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Paid orders</th>
                <th className="px-4 py-3">Revenue / AOV</th>
                <th className="px-4 py-3">Last order</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.map((customer) => {
                const isExpanded = expandedEmail === customer.email
                return (
                  <Fragment key={customer.email}>
                    <tr className="border-b border-slate-100 dark:border-white/5">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{customer.userName ?? customer.email}</p>
                        <p className="text-xs text-slate-500">{customer.email}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {customer.isGmail ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Gmail</span>
                          ) : null}
                          {customer.isRegistered ? (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Account</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{customer.paidOrders}</p>
                      </td>
                      <td className="px-4 py-3">
                        <CurrencyStats stats={customer} compact />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(customer.lastOrderAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleCustomer(customer.email)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={customerColCount} className="bg-slate-50 p-4 dark:bg-white/5">
                          <CustomerExpandedPanel
                            email={customer.email}
                            formatMoney={fmt}
                            expandedOrderId={expandedOrderId}
                            onToggleOrder={toggleOrder}
                            onOrderUpdated={load}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {sortedCustomers.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No customers with paid orders found.</p>
          ) : (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-white/5">
              {sortedCustomers.length} customer{sortedCustomers.length === 1 ? '' : 's'} • sorted A→Z by email
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
