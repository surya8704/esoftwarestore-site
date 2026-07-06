import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Package, RefreshCw, ShoppingBag, Store, Users, Wallet } from 'lucide-react'
import { dashboardApi } from '../api'

function StatCard({ icon: Icon, label, value, hint, accent = 'text-sky-600', onClick }) {
  const className = `w-full rounded-2xl border border-slate-200 p-5 text-left transition dark:border-white/10 ${
    onClick ? 'cursor-pointer hover:border-sky-400 hover:shadow-md dark:hover:border-sky-500' : ''
  }`

  const content = (
    <>
      <div className={`mb-3 inline-flex rounded-xl bg-slate-100 p-2 dark:bg-white/10 ${accent}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      {onClick ? <p className="mt-2 text-xs font-semibold text-sky-600">View details →</p> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

export default function OverviewTab({ isAdmin, formatMoney, onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const go = useCallback((tab) => {
    if (onNavigate) onNavigate(tab)
  }, [onNavigate])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const path = isAdmin ? '/api/admin/overview' : '/api/vendor/me'
      const result = await dashboardApi(path)
      setData(result)
    } catch (err) {
      setData(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-slate-500">Loading overview...</p>
  if (error) return <p className="text-rose-500">{error}</p>
  if (!data) return <p className="text-slate-500">Could not load overview.</p>

  if (isAdmin) {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Platform overview</h2>
            <p className="mt-1 text-sm text-slate-500">Click a card to open the related section</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard icon={BarChart3} label="Total revenue" value={formatMoney(data.revenue)} hint="From paid orders only" onClick={() => go('orders')} />
          <StatCard icon={ShoppingBag} label="Total orders" value={data.totalOrders} hint={`${data.paidOrders ?? 0} paid • ${data.pendingOrders ?? 0} pending`} accent="text-amber-600" onClick={() => go('orders')} />
          <StatCard icon={Wallet} label="Pending payouts" value={formatMoney(data.pendingVendorPayouts)} hint="Awaiting admin approval" accent="text-orange-600" onClick={() => go('payouts')} />
          <StatCard icon={Wallet} label="Paid to vendors" value={formatMoney(data.paidVendorPayouts ?? 0)} accent="text-emerald-600" onClick={() => go('payouts')} />
          <StatCard icon={Store} label="Vendors" value={data.totalVendors} accent="text-violet-600" onClick={() => go('vendors')} />
          <StatCard icon={Package} label="Products" value={data.totalProducts} accent="text-emerald-600" onClick={() => go('products')} />
          <StatCard icon={Users} label="Users" value={data.totalUsers} accent="text-rose-600" onClick={() => go('customers')} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{data.vendor?.name ?? 'Vendor'} overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Commission rate: {data.vendor?.commissionRate}% platform fee
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Package} label="My products" value={data.productCount} onClick={() => go('products')} />
        <StatCard icon={ShoppingBag} label="Orders" value={data.orderCount} accent="text-emerald-600" onClick={() => go('orders')} />
        <StatCard icon={BarChart3} label="Gross sales" value={formatMoney(data.grossRevenue)} accent="text-violet-600" onClick={() => go('orders')} />
        <StatCard icon={Wallet} label="Your earnings" value={formatMoney(data.vendorEarnings)} accent="text-amber-600" onClick={() => go('payouts')} />
        <StatCard icon={Wallet} label="Available balance" value={formatMoney(data.availableBalance)} hint="Ready to withdraw" accent="text-sky-600" onClick={() => go('payouts')} />
        <StatCard icon={Wallet} label="Pending payout" value={formatMoney(data.pendingPayout ?? 0)} accent="text-orange-600" onClick={() => go('payouts')} />
        <StatCard icon={Wallet} label="Paid out" value={formatMoney(data.paidOut)} accent="text-rose-600" onClick={() => go('payouts')} />
      </div>
    </div>
  )
}
