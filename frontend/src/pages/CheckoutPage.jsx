import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, formatPrice, trackPage } from '../lib/api'
import { CHECKOUT_COUNTRIES, emptyBilling, INDIAN_STATES } from '../lib/billing'
import { getDialCodeForCountry, isValidLocalPhone } from '../lib/phone'
import { submitPayuForm } from '../lib/payu'
import { loadRazorpayCheckout, openRazorpayCheckout } from '../lib/razorpay'
import { useApp } from '../context/AppContext'
import SEO from '../components/SEO'
import SocialLoginButtons from '../components/SocialLoginButtons'

const PAYMENT_METHOD_META = {
  razorpay: { id: 'razorpay', label: 'Razorpay', hint: 'UPI, cards & wallets (incl. international cards)' },
  payu: { id: 'payu', label: 'PayU', hint: 'UPI, cards & net banking (charged in INR)' },
}

function Field({ label, required, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-store-heading">
        {label}
        {required ? <span className="text-[#f97316]"> *</span> : null}
      </label>
      {children}
    </div>
  )
}

export default function CheckoutPage() {
  const { cart, refreshCart, currency, country, removeFromCart, user, signup, loginWithGoogle, loginWithFacebook, config } = useApp()
  const [billing, setBilling] = useState(() => emptyBilling(country))
  const [removingId, setRemovingId] = useState(null)
  const [coupon, setCoupon] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('razorpay')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [delivery, setDelivery] = useState(null)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const availablePaymentMethods = useMemo(() => {
    const countryCode = billing.countryCode || country || 'IN'
    const allowed =
      config?.countryPayments?.[countryCode] ??
      config?.countryPayments?.default ??
      ['razorpay', 'payu']

    return allowed
      .filter((id) => PAYMENT_METHOD_META[id])
      .map((id) => PAYMENT_METHOD_META[id])
  }, [billing.countryCode, country, config])

  const dialCode = getDialCodeForCountry(billing.countryCode)

  useEffect(() => {
    const payuStatus = searchParams.get('payu')
    if (payuStatus === 'failed') {
      setError('PayU payment was not completed. Please try again.')
    } else if (payuStatus === 'invalid') {
      setError('PayU payment verification failed. Contact support if you were charged.')
    } else if (payuStatus && payuStatus !== 'failed') {
      setError('Something went wrong with PayU. Please try again or use Razorpay.')
    }
    if (payuStatus) {
      const params = new URLSearchParams(searchParams)
      params.delete('payu')
      params.delete('orderId')
      setSearchParams(params, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!availablePaymentMethods.some((method) => method.id === paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0]?.id ?? 'razorpay')
    }
  }, [availablePaymentMethods, paymentMethod])

  const setField = (key, value) => {
    setBilling((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    trackPage('/checkout')
    refreshCart()
  }, [refreshCart])

  useEffect(() => {
    setBilling((prev) => ({
      ...prev,
      countryCode: country,
      email: user?.email ?? prev.email,
      firstName: user?.name ? user.name.split(' ')[0] : prev.firstName,
      lastName: user?.name ? user.name.split(' ').slice(1).join(' ') : prev.lastName,
      createAccount: user ? false : prev.createAccount,
    }))
  }, [country, user])

  // Save email early so abandoned-cart reminders can send if they leave without paying
  useEffect(() => {
    const email = (billing.email || '').trim()
    if (!email || !email.includes('@') || !cart?.items?.length) return undefined

    const timer = setTimeout(() => {
      api('/api/cart', {
        method: 'PATCH',
        body: JSON.stringify({ email, countryCode: billing.countryCode || country }),
      }).catch(() => {})
    }, 800)

    return () => clearTimeout(timer)
  }, [billing.email, billing.countryCode, country, cart?.items?.length])

  const handleRemove = async (itemId) => {
    setRemovingId(itemId)
    try {
      await removeFromCart(itemId)
    } finally {
      setRemovingId(null)
    }
  }

  const applyCoupon = async () => {
    await api('/api/cart', {
      method: 'PATCH',
      body: JSON.stringify({ couponCode: coupon, email: billing.email }),
    })
    await refreshCart()
  }

  const pay = async (e) => {
    e.preventDefault()
    if (!termsAccepted) {
      setError('You must agree to the terms and conditions to continue.')
      return
    }
    if (billing.createAccount && !user) {
      if (!billing.password || billing.password.length < 6) {
        setError('Choose a password with at least 6 characters to create an account.')
        return
      }
    }
    if (!isValidLocalPhone(billing.phone)) {
      setError('Enter a valid phone number (at least 7 digits).')
      return
    }
    const whatsappNumber = billing.whatsappSameAsPhone ? billing.phone : billing.whatsapp
    if (!isValidLocalPhone(whatsappNumber)) {
      setError('Enter a valid WhatsApp number (at least 7 digits).')
      return
    }

    setLoading(true)
    setError('')
    let pendingOrderId = null
    try {
      if (billing.createAccount && !user) {
        await signup({
          name: `${billing.firstName.trim()} ${billing.lastName.trim()}`.trim(),
          email: billing.email,
          password: billing.password,
          countryCode: billing.countryCode,
        })
      }

      await api('/api/cart', {
        method: 'PATCH',
        body: JSON.stringify({ email: billing.email, countryCode: billing.countryCode }),
      })

      const orderData = await api('/api/checkout/create-order', {
        method: 'POST',
        body: JSON.stringify({
          customerEmail: billing.email,
          customerPhone: billing.phone.trim(),
          customerWhatsapp: whatsappNumber.trim(),
          billing: {
            firstName: billing.firstName,
            lastName: billing.lastName,
            countryCode: billing.countryCode,
            streetAddress: billing.streetAddress,
            addressLine2: billing.addressLine2 || undefined,
            city: billing.city,
            state: billing.state,
            postalCode: billing.postalCode,
            orderNotes: billing.orderNotes || undefined,
          },
          paymentMethod,
          termsAccepted: true,
        }),
      })
      pendingOrderId = orderData.order.id

      if (orderData.order.paymentStatus === 'paid') {
        setDelivery(orderData.order)
        return
      }

      if (orderData.paymentMethod === 'payu' && orderData.payu) {
        submitPayuForm(orderData.payu.action, orderData.payu.params)
        return
      }

      if (orderData.paymentMethod !== 'razorpay') {
        throw new Error('Selected payment method is not available. Please try again.')
      }

      const Razorpay = await loadRazorpayCheckout()
      const paymentCurrency = orderData.currency ?? (currency === 'INR' ? 'INR' : 'USD')
      const fullName = `${billing.firstName} ${billing.lastName}`.trim()
      const response = await openRazorpayCheckout(Razorpay, {
        key: orderData.keyId,
        amount: Math.round(orderData.amount * 100),
        currency: paymentCurrency,
        name: 'eSoftware Store',
        description: 'Software license order',
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: fullName,
          email: billing.email,
          contact: `${dialCode.replace('+', '')}${billing.phone.replace(/\D/g, '')}`,
        },
        theme: { color: '#f97316' },
      })

      const verified = await api('/api/checkout/verify', {
        method: 'POST',
        body: JSON.stringify({
          orderId: orderData.order.id,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      })
      setDelivery(verified.delivery)
    } catch (err) {
      if (pendingOrderId) {
        api('/api/checkout/cancel-payment', {
          method: 'POST',
          body: JSON.stringify({
            orderId: pendingOrderId,
            reason: err.message || 'Payment cancelled',
          }),
        }).catch(() => {})
      }
      if (err.message === 'Payment cancelled') {
        setError('Payment was cancelled. You can try again when ready.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  if (delivery) {
    return (
      <div className="store-container py-16 text-center">
        <SEO title="Order confirmed" />
        <div className="store-card mx-auto max-w-lg p-8 md:p-10">
          <h1 className="text-2xl font-extrabold text-[#16a34a]">Order confirmed — license delivered!</h1>
          <p className="mt-4 text-sm text-store-muted">Confirmation code</p>
          <code className="mt-1 inline-block rounded-lg bg-store-hover px-3 py-2 text-sm font-bold text-store-heading">{delivery.confirmationCode}</code>
          <p className="mt-4 font-mono text-lg">{delivery.licenseKey}</p>
          <p className="mt-4 text-sm text-store-muted">Check your email for the activation key and download link.</p>
          <button type="button" onClick={() => navigate('/orders')} className="btn-store-primary mt-8">
            View my orders
          </button>
        </div>
      </div>
    )
  }

  const countryLabel = CHECKOUT_COUNTRIES.find((c) => c.country === billing.countryCode)?.label ?? billing.countryCode

  return (
    <div className="store-container py-10 pb-28 lg:pb-10">
      <SEO title="Checkout" description="Secure checkout with instant license delivery." />
      <h1 className="text-2xl font-extrabold text-store-heading">Checkout</h1>
      <p className="mt-1 text-sm text-store-muted">Complete your order — digital delivery by email</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <form onSubmit={pay} className="space-y-6">
          <section className="store-card space-y-4 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-store-heading">Billing details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required>
                <input
                  type="text"
                  required
                  value={billing.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                  className="store-input"
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Last name" required>
                <input
                  type="text"
                  required
                  value={billing.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  className="store-input"
                  autoComplete="family-name"
                />
              </Field>
            </div>

            <Field label="Country / Region" required>
              <div className="store-input bg-store-subtle text-store-body">{countryLabel}</div>
              <p className="mt-1 text-xs text-store-muted">Set automatically from your location</p>
            </Field>

            <Field label="Street address" required>
              <input
                type="text"
                required
                value={billing.streetAddress}
                onChange={(e) => setField('streetAddress', e.target.value)}
                placeholder="House number and street name"
                className="store-input"
                autoComplete="address-line1"
              />
            </Field>

            <Field label="Apartment, suite, unit, etc. (optional)">
              <input
                type="text"
                value={billing.addressLine2}
                onChange={(e) => setField('addressLine2', e.target.value)}
                placeholder="Apartment, suite, unit, etc. (optional)"
                className="store-input"
                autoComplete="address-line2"
              />
            </Field>

            <Field label="Town / City" required>
              <input
                type="text"
                required
                value={billing.city}
                onChange={(e) => setField('city', e.target.value)}
                className="store-input"
                autoComplete="address-level2"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="State" required>
                {billing.countryCode === 'IN' ? (
                  <select
                    required
                    value={billing.state}
                    onChange={(e) => setField('state', e.target.value)}
                    className="store-input"
                    autoComplete="address-level1"
                  >
                    <option value="">Select an option…</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={billing.state}
                    onChange={(e) => setField('state', e.target.value)}
                    placeholder="State / Province"
                    className="store-input"
                    autoComplete="address-level1"
                  />
                )}
              </Field>
              <Field label={billing.countryCode === 'IN' ? 'PIN Code' : 'Postal code'} required>
                <input
                  type="text"
                  required
                  value={billing.postalCode}
                  onChange={(e) => setField('postalCode', e.target.value)}
                  className="store-input"
                  autoComplete="postal-code"
                />
              </Field>
            </div>

            <Field label="Phone" required>
              <div className="flex overflow-hidden rounded-xl border border-store bg-store-surface focus-within:ring-2 focus-within:ring-[#f97316]/30">
                <span className="flex shrink-0 items-center border-r border-store bg-store-subtle px-3 text-sm font-semibold text-store-heading">
                  {dialCode}
                </span>
                <input
                  type="tel"
                  required
                  value={billing.phone}
                  onChange={(e) => {
                    const value = e.target.value
                    setBilling((prev) => ({
                      ...prev,
                      phone: value,
                      whatsapp: prev.whatsappSameAsPhone ? value : prev.whatsapp,
                    }))
                  }}
                  placeholder="Mobile number"
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none"
                  autoComplete="tel-national"
                />
              </div>
              <p className="mt-1 text-xs text-store-muted">Country code is set from your billing country ({billing.countryCode}).</p>
            </Field>

            <Field label="WhatsApp number" required>
              <label className="mb-2 flex items-center gap-2 text-sm text-store-body">
                <input
                  type="checkbox"
                  checked={billing.whatsappSameAsPhone}
                  onChange={(e) => setBilling((prev) => ({
                    ...prev,
                    whatsappSameAsPhone: e.target.checked,
                    whatsapp: e.target.checked ? prev.phone : prev.whatsapp,
                  }))}
                  className="h-4 w-4 rounded border-store text-[#f97316] focus:ring-[#f97316]"
                />
                Same as phone number
              </label>
              {!billing.whatsappSameAsPhone ? (
                <div className="flex overflow-hidden rounded-xl border border-store bg-store-surface focus-within:ring-2 focus-within:ring-[#f97316]/30">
                  <span className="flex shrink-0 items-center border-r border-store bg-store-subtle px-3 text-sm font-semibold text-store-heading">
                    {dialCode}
                  </span>
                  <input
                    type="tel"
                    required
                    value={billing.whatsapp}
                    onChange={(e) => setField('whatsapp', e.target.value)}
                    placeholder="WhatsApp number"
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none"
                    autoComplete="tel-national"
                  />
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-store bg-store-subtle px-3 py-2.5 text-sm text-store-muted">
                  {billing.phone ? `${dialCode} ${billing.phone}` : 'Uses your phone number above'}
                </p>
              )}
            </Field>

            <Field label="Email address" required>
              <input
                type="email"
                required
                value={billing.email}
                onChange={(e) => setField('email', e.target.value)}
                onBlur={() => {
                  const email = (billing.email || '').trim()
                  if (!email || !email.includes('@') || !cart?.items?.length) return
                  api('/api/cart', {
                    method: 'PATCH',
                    body: JSON.stringify({ email, countryCode: billing.countryCode || country }),
                  }).catch(() => {})
                }}
                className="store-input"
                autoComplete="email"
              />
              <p className="mt-1.5 text-xs text-store-muted">
                We’ll email your license keys here. If you leave items in your cart, we may send a friendly reminder.
              </p>
            </Field>

            {!user ? (
              <div className="space-y-3 rounded-xl border border-store bg-store-subtle p-4">
                <p className="text-sm font-semibold text-store-heading">Sign in faster</p>
                <SocialLoginButtons
                  config={config}
                  disabled={loading}
                  onGoogleCredential={async (idToken) => {
                    setError('')
                    setLoading(true)
                    try {
                      await loginWithGoogle(idToken)
                    } catch (err) {
                      setError(err.message || 'Google sign-in failed')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  onFacebookAccessToken={async (accessToken) => {
                    setError('')
                    setLoading(true)
                    try {
                      await loginWithFacebook(accessToken)
                    } catch (err) {
                      setError(err.message || 'Facebook sign-in failed')
                    } finally {
                      setLoading(false)
                    }
                  }}
                />
                <label className="flex items-center gap-3 text-sm font-medium text-store-heading">
                  <input
                    type="checkbox"
                    checked={billing.createAccount}
                    onChange={(e) => setField('createAccount', e.target.checked)}
                    className="h-4 w-4 rounded border-store text-[#f97316] focus:ring-[#f97316]"
                  />
                  Create an account with email?
                </label>
                {billing.createAccount ? (
                  <Field label="Account password" required>
                    <input
                      type="password"
                      required={billing.createAccount}
                      minLength={6}
                      value={billing.password}
                      onChange={(e) => setField('password', e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="store-input"
                      autoComplete="new-password"
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="store-card space-y-4 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-store-heading">Payment method</h2>
            {availablePaymentMethods.length === 0 ? (
              <p className="text-sm text-[#e11d48]">
                No payment methods are available for your country yet. Contact support if this persists.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {availablePaymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                      paymentMethod === method.id
                        ? 'border-[#f97316] bg-store-primary-muted/40'
                        : 'border-store hover:border-[#f97316]/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={paymentMethod === method.id}
                      onChange={() => setPaymentMethod(method.id)}
                      className="mt-1 text-[#f97316] focus:ring-[#f97316]"
                    />
                    <span>
                      <span className="block font-semibold text-store-heading">{method.label}</span>
                      <span className="text-sm text-store-muted">{method.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="store-card space-y-4 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-store-heading">Additional information</h2>
            <Field label="Order notes (optional)">
              <textarea
                value={billing.orderNotes}
                onChange={(e) => setField('orderNotes', e.target.value)}
                placeholder="Notes about your order, e.g. special notes for delivery."
                className="store-input min-h-28 resize-y"
                rows={4}
              />
            </Field>
          </section>

          <section className="store-card space-y-4 p-6 md:p-8">
            <label className="flex items-start gap-3 text-sm leading-relaxed text-store-body">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked)
                  if (e.target.checked) setError('')
                }}
                className="mt-1 h-4 w-4 shrink-0 rounded border-store text-[#f97316] focus:ring-[#f97316]"
                required
              />
              <span>
                I have read and agree to the{' '}
                <Link to="/terms" target="_blank" rel="noreferrer" className="font-medium text-[#f97316] hover:underline">
                  website terms and conditions
                </Link>
                {' '}* and acknowledge the{' '}
                <Link to="/payment-policy" target="_blank" rel="noreferrer" className="text-[#f97316] hover:underline">Payment</Link>,{' '}
                <Link to="/delivery-policy" target="_blank" rel="noreferrer" className="text-[#f97316] hover:underline">Delivery</Link>, and{' '}
                <Link to="/returns-refunds" target="_blank" rel="noreferrer" className="text-[#f97316] hover:underline">Returns & Refunds</Link> policies.
              </span>
            </label>

            {error ? <p className="text-sm text-[#e11d48]">{error}</p> : null}

            <button
              type="submit"
              disabled={loading || !cart?.items?.length || !termsAccepted || availablePaymentMethods.length === 0}
              className="btn-store-primary w-full py-4 disabled:opacity-50"
            >
              {loading ? 'Processing...' : `Place order & pay · ${countryLabel}`}
            </button>
          </section>
        </form>

        <aside className="store-card h-fit bg-gradient-to-b from-store-primary-muted/50 to-store-surface p-6 md:p-8">
          <h2 className="font-semibold">Your order</h2>
          <ul className="mt-4 space-y-3">
            {cart?.items?.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 text-sm">
                <span className="text-store-body">
                  {item.product.name} × {item.quantity}
                  {item.volumeDiscountPercent ? (
                    <span className="ml-1 text-xs font-semibold text-[#059669]">(-{item.volumeDiscountPercent}% volume)</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    disabled={removingId === item.id}
                    className="ml-2 text-xs text-store-muted hover:text-[#e11d48] disabled:opacity-50"
                  >
                    {removingId === item.id ? 'Removing...' : 'Remove'}
                  </button>
                </span>
                <span className="font-semibold text-[#f97316]">{formatPrice(item.lineTotal, currency)}</span>
              </li>
            ))}
            {cart?.items?.length === 0 ? <li className="text-sm text-store-muted">Cart is empty.</li> : null}
          </ul>

          <div className="mt-4 flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Coupon code"
              className="store-input flex-1 text-sm"
            />
            <button type="button" onClick={applyCoupon} className="btn-store-outline shrink-0 text-sm">
              Apply
            </button>
          </div>

          {cart?.discount > 0 ? (
            <p className="mt-4 flex justify-between text-sm text-[#16a34a]">
              <span>Discount</span>
              <span>-{formatPrice(cart.discount, currency)}</span>
            </p>
          ) : null}
          <p className="mt-4 flex justify-between border-t border-store pt-4 text-lg font-bold">
            <span>Total</span>
            <span className="text-[#f97316]">{formatPrice(cart?.total ?? 0, currency)}</span>
          </p>
          <Link to="/" className="mt-4 block text-center text-sm text-store-muted hover:text-[#f97316]">
            ← Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  )
}
