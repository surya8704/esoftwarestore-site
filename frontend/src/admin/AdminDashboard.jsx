import { useEffect, useState } from 'react'
import {
  Building2,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Package,
  Receipt,
  ShoppingBag,
  Store,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react'
import { dashboardApi, emptyProductForm, emptyVendorForm, formatMoney } from './api'
import OverviewTab from './tabs/OverviewTab'
import VendorsTab from './tabs/VendorsTab'
import ProductsTab from './tabs/ProductsTab'
import OrdersTab from './tabs/OrdersTab'
import PayoutsTab from './tabs/PayoutsTab'
import UsersTab from './tabs/UsersTab'
import CustomersTab from './tabs/CustomersTab'
import ThemeToggle from '../components/ThemeToggle'

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'vendors', label: 'Vendors', icon: Building2 },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: UserCircle },
  { id: 'payouts', label: 'Payouts', icon: Wallet },
  { id: 'users', label: 'Users', icon: Users },
]

const VENDOR_TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'My Products', icon: Package },
  { id: 'orders', label: 'My Orders', icon: Receipt },
  { id: 'payouts', label: 'Payouts', icon: Wallet },
]

export default function AdminDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem('dashboardToken') ?? '')
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [authForm, setAuthForm] = useState({ email: 'info@esoftwarestore.com', password: '' })

  const isAdmin = user?.role === 'admin'
  const isVendor = user?.role === 'vendor'
  const tabs = isAdmin ? ADMIN_TABS : VENDOR_TABS

  useEffect(() => {
    if (!token) return
    let cancelled = false
    dashboardApi('/api/auth/me')
      .then((d) => {
        if (cancelled) return
        if (d.user.role !== 'admin' && d.user.role !== 'vendor') {
          throw new Error('This account cannot access the dashboard')
        }
        setUser(d.user)
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem('dashboardToken')
        setToken('')
        setUser(null)
        setStatus('Session expired. Please sign in again.')
      })
    return () => { cancelled = true }
  }, [token])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      const data = await dashboardApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(authForm),
      })
      if (data.user.role !== 'admin' && data.user.role !== 'vendor') {
        throw new Error('Admin or vendor access required')
      }
      localStorage.setItem('dashboardToken', data.token)
      setToken(data.token)
      setUser(data.user)
      setTab('overview')
      setStatus(`Signed in as ${data.user.role}`)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('dashboardToken')
    setToken('')
    setUser(null)
    setStatus('Logged out')
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-3 text-white dark:bg-white dark:text-slate-950">
              <Store size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">Multi-Vendor</p>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <input
              type="email"
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              placeholder="Email"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
            />
            <input
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              placeholder="Password"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
            />
            <button className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : <LockKeyhole size={16} />}
              Sign in
            </button>
          </form>

          <div className="mt-6 space-y-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500 dark:bg-white/5">
            <p><strong>Admin:</strong> info@esoftwarestore.com</p>
            <p><strong>Vendor:</strong> vendor@demo.store / Vendor@123</p>
          </div>
          {status ? <p className="mt-4 text-sm text-slate-500">{status}</p> : null}
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">
            {isAdmin ? 'Platform Admin' : 'Vendor Portal'}
          </p>
          <h1 className="text-3xl font-bold">{isAdmin ? 'Multi-Vendor Dashboard' : user.name}</h1>
          <p className="text-sm text-slate-500">{user.email} • {user.role}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="border border-slate-200 dark:border-white/10" />
          <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                tab === id
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </aside>

        <div className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-8">
          {tab === 'overview' ? <OverviewTab isAdmin={isAdmin} formatMoney={formatMoney} onNavigate={setTab} /> : null}
          {tab === 'vendors' && isAdmin ? <VendorsTab emptyVendorForm={emptyVendorForm} formatMoney={formatMoney} /> : null}
          {tab === 'products' ? <ProductsTab isAdmin={isAdmin} emptyProductForm={emptyProductForm} formatMoney={formatMoney} /> : null}
          {tab === 'orders' ? <OrdersTab isAdmin={isAdmin} formatMoney={formatMoney} /> : null}
          {tab === 'customers' && isAdmin ? <CustomersTab formatMoney={formatMoney} /> : null}
          {tab === 'payouts' ? <PayoutsTab isAdmin={isAdmin} formatMoney={formatMoney} /> : null}
          {tab === 'users' && isAdmin ? <UsersTab currentUserId={user.id} /> : null}
        </div>
      </div>
    </section>
  )
}
