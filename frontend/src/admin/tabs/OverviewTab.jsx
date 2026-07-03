import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Package, RefreshCw, ShoppingBag, Store, Users, Wallet } from 'lucide-react'
import { dashboardApi } from '../api'

function StatCard({ icon: Icon, label, value, hint, accent = 'text-sky-600' }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
      <div className={`mb-3 inline-flex rounded-xl bg-slate-100 p-2 dark:bg-white/10 ${accent}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

export default function OverviewTab({ isAdmin, formatMoney }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
            <p className="mt-1 text-sm text-slate-500">Orders, revenue, and vendor payouts across the store</p>
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
          <StatCard icon={BarChart3} label="Total revenue" value={formatMoney(data.revenue)} hint="From paid orders only" />
          <StatCard icon={ShoppingBag} label="Total orders" value={data.totalOrders} hint={`${data.paidOrders ?? 0} paid • ${data.pendingOrders ?? 0} pending`} accent="text-amber-600" />
          <StatCard icon={Wallet} label="Pending payouts" value={formatMoney(data.pendingVendorPayouts)} hint="Awaiting admin approval" accent="text-orange-600" />
          <StatCard icon={Wallet} label="Paid to vendors" value={formatMoney(data.paidVendorPayouts ?? 0)} accent="text-emerald-600" />
          <StatCard icon={Store} label="Vendors" value={data.totalVendors} accent="text-violet-600" />
          <StatCard icon={Package} label="Products" value={data.totalProducts} accent="text-emerald-600" />
          <StatCard icon={Users} label="Users" value={data.totalUsers} accent="text-rose-600" />
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
        <StatCard icon={Package} label="My products" value={data.productCount} />
        <StatCard icon={ShoppingBag} label="Orders" value={data.orderCount} accent="text-emerald-600" />
        <StatCard icon={BarChart3} label="Gross sales" value={formatMoney(data.grossRevenue)} accent="text-violet-600" />
        <StatCard icon={Wallet} label="Your earnings" value={formatMoney(data.vendorEarnings)} accent="text-amber-600" />
        <StatCard icon={Wallet} label="Available balance" value={formatMoney(data.availableBalance)} hint="Ready to withdraw" accent="text-sky-600" />
        <StatCard icon={Wallet} label="Pending payout" value={formatMoney(data.pendingPayout ?? 0)} accent="text-orange-600" />
        <StatCard icon={Wallet} label="Paid out" value={formatMoney(data.paidOut)} accent="text-rose-600" />
      </div>
    </div>
  )
}
