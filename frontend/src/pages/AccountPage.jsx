import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Copy, Package } from 'lucide-react'
import { api, formatPrice } from '../lib/api'
import { useApp } from '../context/AppContext'
import SEO from '../components/SEO'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadge(status) {
  const normalized = String(status ?? 'pending').toLowerCase()
  if (normalized === 'paid') return 'bg-[#dcfce7] text-[#166534]'
  if (normalized === 'created' || normalized === 'pending') return 'bg-[#ffedd5] text-[#c2410c]'
  return 'bg-[#fee2e2] text-[#b91c1c]'
}

function OrderCard({ order, currency }) {
  const [open, setOpen] = useState(false)
  const shortId = order.id?.slice?.(-8) ?? order.id

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  return (
    <article className="store-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-store p-4">
        <div>
          <p className="font-semibold text-store-heading">Order #{shortId}</p>
          <p className="mt-1 text-sm text-store-muted">{formatDate(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded px-2 py-1 text-xs font-semibold capitalize ${statusBadge(order.paymentStatus)}`}>
            {order.paymentStatus}
          </span>
          <p className="mt-2 text-lg font-bold text-[#f97316]">
            {formatPrice(order.total, order.currency ?? currency)}
          </p>
        </div>
      </div>

      <div className="p-4">
        <ul className="space-y-2 text-sm text-store-body">
          {(order.items ?? []).slice(0, open ? undefined : 2).map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span className="font-medium text-store-heading">
                {formatPrice(item.unitPrice * item.quantity, order.currency ?? currency)}
              </span>
            </li>
          ))}
        </ul>

        {(order.items?.length ?? 0) > 2 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#f97316]"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {open ? 'Show less' : `Show all ${order.items.length} items`}
          </button>
        ) : null}

        {order.confirmationCode ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-store-muted">Confirmation:</span>
            <code className="rounded bg-store-hover px-2 py-1 font-mono text-xs">{order.confirmationCode}</code>
            <button
              type="button"
              onClick={() => copyText(order.confirmationCode)}
              className="inline-flex items-center gap-1 text-xs text-[#f97316]"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
        ) : null}

        {(order.items ?? []).some((item) => item.licenseKey) ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-store-muted">License keys</p>
            {order.items
              .filter((item) => item.licenseKey)
              .map((item) => (
                <div key={item.id} className="rounded border border-store bg-store-subtle p-3">
                  <p className="text-xs text-store-muted">{item.productName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <code className="break-all font-mono text-sm text-store-heading">{item.licenseKey}</code>
                    <button
                      type="button"
                      onClick={() => copyText(item.licenseKey)}
                      className="inline-flex items-center gap-1 text-xs text-[#f97316]"
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : order.licenseKey ? (
          <div className="mt-4 rounded border border-store bg-store-subtle p-3">
            <p className="text-xs text-store-muted">License key</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-sm">{order.licenseKey}</code>
              <button
                type="button"
                onClick={() => copyText(order.licenseKey)}
                className="inline-flex items-center gap-1 text-xs text-[#f97316]"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default function AccountPage() {
  const { user, login, signup, logout, country, locale, currency } = useApp()
  const [activeTab, setActiveTab] = useState('orders')
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadOrders = async () => {
    setOrdersLoading(true)
    try {
      const data = await api('/api/orders')
      setOrders(data.orders ?? [])
    } catch {
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadOrders()
    else setOrders([])
  }, [user])

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setForm({ name: '', email: '', password: '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password)
      } else {
        if (!form.name.trim()) {
          setError('Please enter your full name')
          return
        }
        if (form.password.length < 6) {
          setError('Password must be at least 6 characters')
          return
        }
        await signup({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          countryCode: country,
          locale,
        })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="store-container py-10">
      <SEO title="My Account" />
      <h1 className="text-2xl font-extrabold text-store-heading">My account</h1>

      {!user ? (
        <div className="store-card mx-auto mt-8 max-w-md p-6 md:p-8">
          <div className="mb-4 flex gap-2 border-b border-store">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 border-b-2 py-2 text-sm font-semibold ${mode === 'login' ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-store-muted'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 border-b-2 py-2 text-sm font-semibold ${mode === 'signup' ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-store-muted'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' ? (
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name *"
                className="store-input"
              />
            ) : null}
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email address *"
              className="store-input"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password *"
              className="store-input"
            />
            {error ? <p className="text-sm text-[#e11d48]">{error}</p> : null}
            <button type="submit" disabled={loading} className="btn-store-primary w-full disabled:opacity-60">
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>

          {mode === 'login' ? (
            <p className="mt-4 text-center text-sm text-store-muted">
              New customer?{' '}
              <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-[#f97316]">
                Create an account
              </button>
            </p>
          ) : (
            <p className="mt-4 text-center text-sm text-store-muted">
              Already registered?{' '}
              <button type="button" onClick={() => switchMode('login')} className="font-semibold text-[#f97316]">
                Login here
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="store-card h-fit p-5">
            <div className="border-b border-store pb-4">
              <p className="font-semibold text-store-heading">{user.name}</p>
              <p className="mt-1 text-sm text-store-muted">{user.email}</p>
              {user.role !== 'customer' ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#f97316]">{user.role}</p>
              ) : null}
            </div>
            <nav className="mt-4 space-y-1 text-sm">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left ${activeTab === 'orders' ? 'bg-store-primary-muted font-semibold text-[#f97316]' : 'text-store-body hover:bg-store-hover'}`}
              >
                <Package size={16} /> Orders
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`flex w-full rounded px-3 py-2 text-left ${activeTab === 'details' ? 'bg-store-primary-muted font-semibold text-[#f97316]' : 'text-store-body hover:bg-store-hover'}`}
              >
                Account details
              </button>
            </nav>
            <button type="button" onClick={logout} className="btn-store-outline mt-6 w-full">
              Logout
            </button>
          </aside>

          <section>
            {activeTab === 'orders' ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-store-heading">Order history</h2>
                    <p className="mt-1 text-sm text-store-muted">Track your previous purchases and license keys.</p>
                  </div>
                  <button
                    type="button"
                    onClick={loadOrders}
                    disabled={ordersLoading}
                    className="btn-store-outline text-sm disabled:opacity-60"
                  >
                    {ordersLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {ordersLoading && orders.length === 0 ? (
                    <p className="text-sm text-store-muted">Loading orders...</p>
                  ) : null}

                  {!ordersLoading && orders.length === 0 ? (
                    <div className="store-card border-dashed p-10 text-center">
                      <Package size={36} className="mx-auto text-store-muted opacity-50" />
                      <p className="mt-4 font-medium text-store-body">No orders yet</p>
                      <p className="mt-1 text-sm text-store-muted">
                        Orders placed with your email will appear here after checkout.
                      </p>
                      <Link to="/" className="btn-store-primary mt-6 inline-flex">
                        Browse products
                      </Link>
                    </div>
                  ) : null}

                  {orders.map((order) => (
                    <OrderCard key={order.id} order={order} currency={currency} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="store-card p-6 md:p-8">
                <h2 className="text-lg font-semibold text-store-heading">Account details</h2>
                <dl className="mt-6 space-y-4 text-sm">
                  <div>
                    <dt className="text-store-muted">Name</dt>
                    <dd className="mt-1 font-medium text-store-heading">{user.name}</dd>
                  </div>
                  <div>
                    <dt className="text-store-muted">Email</dt>
                    <dd className="mt-1 font-medium text-store-heading">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-store-muted">Country</dt>
                    <dd className="mt-1 font-medium text-store-heading">{user.countryCode ?? country}</dd>
                  </div>
                  {user.affiliateCode ? (
                    <div>
                      <dt className="text-store-muted">Affiliate code</dt>
                      <dd className="mt-1 font-mono text-sm text-store-heading">{user.affiliateCode}</dd>
                    </div>
                  ) : null}
                  {typeof user.walletBalance === 'number' ? (
                    <div>
                      <dt className="text-store-muted">Wallet balance</dt>
                      <dd className="mt-1 font-medium text-store-heading">{formatPrice(user.walletBalance, currency)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
