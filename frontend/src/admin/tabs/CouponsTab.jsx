import { useEffect, useState } from 'react'
import { Copy, LoaderCircle, Pause, Play, Plus, RefreshCw, Ticket, Trash2 } from 'lucide-react'
import { dashboardApi, emptyCouponForm, formatMoney } from '../api'
import { CountryRestrictionPicker, ProductRestrictionPicker, encodeList } from '../components/RestrictionPickers'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

function statusLabel(coupon) {
  if (coupon.isExpired) return { text: 'Expired', className: 'bg-slate-100 text-slate-600' }
  if (!coupon.active) return { text: 'Paused', className: 'bg-amber-100 text-amber-700' }
  return { text: 'Live', className: 'bg-emerald-100 text-emerald-700' }
}

function discountLabel(coupon, formatMoneyFn) {
  if (coupon.discountType === 'percent') return `${coupon.discountValue}% off`
  return `${formatMoneyFn(coupon.discountValue)} off`
}

function restrictionSummary(coupon) {
  const countries = coupon.countries?.length ? coupon.countries.join(', ') : 'All countries'
  const products = coupon.restrictedProductIds?.length
    ? `${coupon.restrictedProductIds.length} product(s)`
    : 'All products'
  return `${countries} · ${products}`
}

export default function CouponsTab() {
  const [coupons, setCoupons] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(emptyCouponForm)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    const [couponData, productData] = await Promise.all([
      dashboardApi('/api/admin/coupons'),
      dashboardApi('/api/admin/products'),
    ])
    setCoupons(couponData.coupons ?? [])
    setProducts(productData.products ?? [])
  }

  useEffect(() => {
    load().catch((err) => setStatus(err.message))
  }, [])

  const restrictionPayload = () => ({
    countryCodes: encodeList(form.countryCodes),
    productIds: encodeList(form.productIds),
  })

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setStatus(`Copied ${code}`)
    } catch {
      setStatus('Could not copy code')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      const payload = {
        code: form.code.trim() || undefined,
        prefix: form.prefix.trim() || undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minAmount: Number(form.minAmount) || 0,
        maxUses: form.maxUses === '' || form.maxUses == null ? null : Number(form.maxUses),
        active: form.active,
        expiresAt: form.expiresAt || null,
        ...restrictionPayload(),
      }
      const result = await dashboardApi('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setForm(emptyCouponForm)
      setShowForm(false)
      await load()
      setStatus(`Coupon ${result.coupon.code} ${result.coupon.active ? 'launched' : 'created (paused)'}`)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const generateBatch = async () => {
    setLoading(true)
    setStatus('')
    try {
      const result = await dashboardApi('/api/admin/coupons/generate', {
        method: 'POST',
        body: JSON.stringify({
          prefix: form.prefix.trim() || 'SAVE',
          count: Math.min(20, Math.max(1, Number(form.generateCount) || 1)),
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          minAmount: Number(form.minAmount) || 0,
          maxUses: form.maxUses === '' || form.maxUses == null ? null : Number(form.maxUses),
          active: form.active,
          expiresAt: form.expiresAt || null,
          ...restrictionPayload(),
        }),
      })
      await load()
      setStatus(`Generated and ${form.active ? 'launched' : 'created'} ${result.count} coupon(s)`)
      setShowForm(false)
      setForm(emptyCouponForm)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const setActive = async (coupon, active) => {
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      })
      await load()
      setStatus(active ? `Launched ${coupon.code}` : `Paused ${coupon.code}`)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const removeCoupon = async (coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi(`/api/admin/coupons/${coupon.id}`, { method: 'DELETE' })
      await load()
      setStatus(`Deleted ${coupon.code}`)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Coupons</h2>
          <p className="text-sm text-slate-500">Generate codes, restrict by country/product, and launch</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => load().catch((err) => setStatus(err.message))}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            <Plus size={16} /> {showForm ? 'Close' : 'New coupon'}
          </button>
        </div>
      </div>

      {showForm ? (
        <form onSubmit={submit} className="mt-6 grid gap-3 rounded-2xl border border-dashed border-slate-300 p-5 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            <span className="mb-1 block text-xs font-medium">Custom code (optional)</span>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="Leave blank to auto-generate"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">Prefix for auto codes</span>
            <input
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
              placeholder="SAVE"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">Discount type</span>
            <select
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            >
              <option value="percent">Percent (%)</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">
              Discount value {form.discountType === 'percent' ? '(%)' : '(₹ / currency)'}
            </span>
            <input
              required
              type="number"
              min="1"
              max={form.discountType === 'percent' ? 100 : undefined}
              step="1"
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">Min order amount</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.minAmount}
              onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">Max uses (blank = unlimited)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">Expires on</span>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium">Generate count (batch)</span>
            <input
              type="number"
              min="1"
              max="20"
              value={form.generateCount}
              onChange={(e) => setForm({ ...form, generateCount: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            Launch immediately (make live)
          </label>

          <CountryRestrictionPicker
            label="Country restriction (optional)"
            hint="Leave empty for all countries. Selected countries only can use this coupon."
            selected={form.countryCodes}
            onChange={(countryCodes) => setForm({ ...form, countryCodes })}
          />
          <ProductRestrictionPicker
            products={products}
            selected={form.productIds}
            onChange={(productIds) => setForm({ ...form, productIds })}
          />

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Ticket size={14} />}
              Create / launch one
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={generateBatch}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
            >
              Generate batch
            </button>
          </div>
        </form>
      ) : null}

      {status ? <p className="mt-4 text-sm text-slate-500">{status}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Restrictions</th>
              <th className="px-4 py-3">Min / Uses</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No coupons yet. Create one to launch a promo.
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => {
                const badge = statusLabel(coupon)
                return (
                  <tr key={coupon.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{coupon.code}</span>
                        <button type="button" onClick={() => copyCode(coupon.code)} className="text-slate-400 hover:text-sky-600" title="Copy">
                          <Copy size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">{discountLabel(coupon, formatMoney)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{restrictionSummary(coupon)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      Min {formatMoney(coupon.minAmount)}
                      <br />
                      {coupon.maxUses == null
                        ? `${coupon.usedCount ?? 0} used · unlimited`
                        : `${coupon.usedCount ?? 0} / ${coupon.maxUses} used`}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(coupon.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.text}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {coupon.active ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => setActive(coupon, false)}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700"
                          >
                            <Pause size={12} /> Pause
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={loading || coupon.isExpired}
                            onClick={() => setActive(coupon, true)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                          >
                            <Play size={12} /> Launch
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => removeCoupon(coupon)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
