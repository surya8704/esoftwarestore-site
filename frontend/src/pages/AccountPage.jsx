import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { readRememberedEmail } from '../lib/authStorage'
import SEO from '../components/SEO'
import { formatPrice } from '../lib/api'

export default function AccountPage() {
  const { user, login, signup, logout, country, locale, currency } = useApp()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(() => ({
    name: '',
    email: readRememberedEmail(),
    password: '',
  }))
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.email) {
      setForm((prev) => ({ ...prev, email: user.email }))
    }
  }, [user])

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setForm({ name: '', email: readRememberedEmail(), password: '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password, { remember: rememberMe })
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
        }, { remember: rememberMe })
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
            {mode === 'login' ? (
              <label className="flex items-center gap-2 text-sm text-store-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-store"
                />
                Remember my email on this device
              </label>
            ) : null}
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
        <div className="store-card mx-auto mt-8 max-w-lg p-6 md:p-8">
          <div className="border-b border-store pb-4">
            <p className="font-semibold text-store-heading">{user.name}</p>
            <p className="mt-1 text-sm text-store-muted">{user.email}</p>
            {user.role !== 'customer' ? (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#f97316]">{user.role}</p>
            ) : null}
          </div>
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
          <button type="button" onClick={logout} className="btn-store-outline mt-8 w-full">
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
