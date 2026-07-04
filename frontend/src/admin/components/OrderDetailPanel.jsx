import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  CreditCard,
  LoaderCircle,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  User,
} from 'lucide-react'
import { dashboardApi } from '../api'

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending payment' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
]

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function shortId(id) {
  if (!id) return '—'
  const value = String(id)
  return value.length > 8 ? value.slice(-8).toUpperCase() : value.toUpperCase()
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

function paymentLabel(order) {
  const method = (order.paymentMethod ?? '').toLowerCase()
  if (method === 'razorpay') return 'Razorpay'
  if (method === 'payu') return 'PayU'
  if (method === 'stripe') return 'Stripe'
  if (method === 'wallet') return 'Wallet'
  return method || '—'
}

export default function OrderDetailPanel({ orderId, formatMoney, onBack, onUpdated }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [orderStatus, setOrderStatus] = useState('processing')
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState('private')
  const [keyEdits, setKeyEdits] = useState({})
  const [refundReason, setRefundReason] = useState('')
  const [keyMessage, setKeyMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await dashboardApi(`/api/admin/orders/${orderId}`)
      setOrder(data.order)
      setOrderStatus(data.order.orderStatus ?? 'processing')
      const edits = {}
      for (const item of data.order.items ?? []) {
        edits[item.id] = item.licenseKey ?? ''
      }
      setKeyEdits(edits)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  const saveStatus = async () => {
    setSaving(true)
    setStatus('')
    try {
      const data = await dashboardApi(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ orderStatus }),
      })
      setOrder(data.order)
      setStatus('Order updated')
      onUpdated?.()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setSaving(true)
    setStatus('')
    try {
      await dashboardApi(`/api/admin/orders/${orderId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: noteText.trim(), noteType }),
      })
      setNoteText('')
      await load()
      setStatus('Note added')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveItemKey = async (itemId) => {
    setSaving(true)
    setStatus('')
    try {
      const data = await dashboardApi(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ licenseKey: keyEdits[itemId] }),
      })
      setOrder(data.order)
      setStatus('License key saved')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  const sendKeys = async () => {
    setSaving(true)
    setStatus('')
    try {
      const data = await dashboardApi(`/api/admin/orders/${orderId}/send-keys`, {
        method: 'POST',
        body: JSON.stringify({ message: keyMessage || undefined, markCompleted: true }),
      })
      setOrder(data.order)
      setKeyMessage('')
      setStatus('Product key(s) emailed to customer')
      onUpdated?.()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  const processRefund = async () => {
    if (!window.confirm(`Refund ${formatMoney(order.total)} to customer via ${paymentLabel(order)}?`)) return
    setSaving(true)
    setStatus('')
    try {
      const data = await dashboardApi(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason: refundReason || undefined }),
      })
      setOrder(data.order)
      setRefundReason('')
      setStatus(`Refund processed (${data.refund?.gateway})`)
      onUpdated?.()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading order details...</p>
  }

  if (error || !order) {
    return (
      <div>
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-600">
          <ArrowLeft size={16} /> Back to orders
        </button>
        <p className="text-sm text-rose-500">{error || 'Order not found'}</p>
      </div>
    )
  }

  const stats = order.customerStats ?? {}
  const billing = order.billing ?? {}
  const canRefund = order.paymentStatus === 'paid' && order.orderStatus !== 'refunded'
  const canSendKeys = order.paymentStatus === 'paid' || order.orderStatus === 'processing'

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-600">
        <ArrowLeft size={16} /> Back to orders
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Order #{shortId(order.id)}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Payment via {paymentLabel(order)}
            {order.razorpayPaymentId ? ` • ${order.razorpayPaymentId}` : ''}
            {order.payuPaymentId ? ` • PayU ${order.payuPaymentId}` : ''}
            {order.stripeChargeId ? ` • Stripe ${order.stripeChargeId}` : ''}
          </p>
          <p className="text-sm text-slate-500">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadge(order.orderStatus)}`}>
            {order.orderStatus?.replace('_', ' ') ?? 'pending'}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadge(order.paymentStatus)}`}>
            Payment: {order.paymentStatus}
          </span>
        </div>
      </div>

      {status ? <p className="mb-4 rounded-xl bg-slate-50 px-4 py-2 text-sm dark:bg-white/5">{status}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="font-bold">General</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-500">Order status</span>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
              <div className="text-sm">
                <p className="font-medium text-slate-500">Customer</p>
                <a href={`mailto:${order.customerEmail}`} className="mt-1 block font-semibold text-sky-600">{order.customerEmail}</a>
                {order.customerPhone ? <p className="text-slate-500">{order.customerPhone}</p> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={saveStatus}
              disabled={saving}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
              Update order
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="font-bold">Billing</h3>
            <div className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">{order.billingName || '—'}</p>
              {billing.streetAddress ? <p>{billing.streetAddress}</p> : null}
              {billing.addressLine2 ? <p>{billing.addressLine2}</p> : null}
              <p>{[billing.city, billing.state, billing.postalCode].filter(Boolean).join(', ')}</p>
              <p className="mt-2">
                <a href={`mailto:${order.customerEmail}`} className="text-sky-600">{order.customerEmail}</a>
              </p>
              {order.orderNotes ? (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <strong>Customer note:</strong> {order.orderNotes}
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="font-bold">Order items</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-white/10">
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Qty</th>
                    <th className="py-2 pr-3">Price</th>
                    <th className="py-2 pr-3">License key</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-white/5">
                      <td className="py-3 pr-3">
                        <p className="font-medium">{item.productName}</p>
                        {item.sku ? <p className="text-xs text-slate-500">SKU: {item.sku}</p> : null}
                      </td>
                      <td className="py-3 pr-3">{item.quantity}</td>
                      <td className="py-3 pr-3">{formatMoney(item.unitPrice * item.quantity)}</td>
                      <td className="py-3 pr-3">
                        <input
                          value={keyEdits[item.id] ?? ''}
                          onChange={(e) => setKeyEdits({ ...keyEdits, [item.id]: e.target.value })}
                          placeholder="Enter activation key"
                          className="w-full min-w-[180px] rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs dark:border-white/10 dark:bg-white/5"
                        />
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => saveItemKey(item.id)}
                          disabled={saving}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold dark:border-white/10"
                        >
                          Save key
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4 text-sm dark:border-white/10">
              <div className="flex justify-between py-1"><span>Items subtotal</span><span>{formatMoney(order.subtotal ?? order.total)}</span></div>
              {order.discount > 0 ? (
                <div className="flex justify-between py-1 text-emerald-600"><span>Discount</span><span>-{formatMoney(order.discount)}</span></div>
              ) : null}
              <div className="flex justify-between py-2 text-base font-bold"><span>Order total</span><span>{formatMoney(order.total)}</span></div>
              {order.refundAmount > 0 ? (
                <div className="flex justify-between py-1 text-rose-600"><span>Refunded</span><span>{formatMoney(order.refundAmount)}</span></div>
              ) : null}
            </div>
          </section>

          {canSendKeys ? (
            <section className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5 dark:border-orange-900/40 dark:bg-orange-950/20">
              <h3 className="flex items-center gap-2 font-bold text-orange-700 dark:text-orange-300">
                <Mail size={18} /> Send product key to customer
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Emails activation code(s) and download links to <strong>{order.customerEmail}</strong>. Marks order as completed.
              </p>
              <textarea
                value={keyMessage}
                onChange={(e) => setKeyMessage(e.target.value)}
                placeholder="Optional message to include in email..."
                rows={2}
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
              <button
                type="button"
                onClick={sendKeys}
                disabled={saving}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
                Email product key
              </button>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="flex items-center gap-2 font-bold">
              <User size={16} /> Customer history
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Total orders</dt><dd className="font-semibold">{stats.totalOrders ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Paid orders</dt><dd className="font-semibold">{stats.paidOrders ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total revenue</dt><dd className="font-semibold">{formatMoney(stats.totalRevenue ?? 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Average order value</dt><dd className="font-semibold">{formatMoney(stats.averageOrderValue ?? 0)}</dd></div>
            </dl>
            {(stats.recentOrders ?? []).length > 1 ? (
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent orders</p>
                <ul className="mt-2 space-y-2 text-xs">
                  {stats.recentOrders.filter((o) => o.id !== order.id).slice(0, 5).map((o) => (
                    <li key={o.id} className="flex justify-between gap-2">
                      <span>#{shortId(o.id)}</span>
                      <span>{formatMoney(o.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {canRefund ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 dark:border-rose-900/40 dark:bg-rose-950/20">
              <h3 className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                <RotateCcw size={16} /> Refund
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Process full refund via {paymentLabel(order)} for {formatMoney(order.total)}.
              </p>
              <input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Refund reason (optional)"
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
              <button
                type="button"
                onClick={processRefund}
                disabled={saving}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:bg-transparent"
              >
                <CreditCard size={14} /> Refund {formatMoney(order.total)}
              </button>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="font-bold">Order notes</h3>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
              {(order.notes ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No notes yet.</p>
              ) : (
                order.notes.map((note) => (
                  <div
                    key={note.id}
                    className={`rounded-xl p-3 text-sm ${
                      note.noteType === 'customer'
                        ? 'border border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30'
                        : 'bg-slate-50 dark:bg-white/5'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{note.content}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {note.authorName ?? 'Admin'} • {formatDate(note.createdAt)}
                      {note.noteType === 'customer' ? ' • Customer note' : ' • Private'}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
              <div className="flex gap-2">
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                >
                  <option value="private">Private note</option>
                  <option value="customer">Customer note</option>
                </select>
                <button
                  type="button"
                  onClick={addNote}
                  disabled={saving || !noteText.trim()}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                >
                  Add
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
