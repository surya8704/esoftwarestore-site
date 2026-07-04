import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Mail,
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

function buildItemDetails(order, keyEdits, downloadEdits) {
  const itemDetails = {}
  for (const item of order.items ?? []) {
    const licenseKey = keyEdits[item.id]?.trim()
    if (!licenseKey) continue
    itemDetails[item.id] = {
      licenseKey,
      downloadUrl: downloadEdits[item.id]?.trim() || undefined,
    }
  }
  return itemDetails
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
  const [downloadEdits, setDownloadEdits] = useState({})
  const [refundReason, setRefundReason] = useState('')
  const [keyMessage, setKeyMessage] = useState('')
  const [markCompleted, setMarkCompleted] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await dashboardApi(`/api/admin/orders/${orderId}`)
      setOrder(data.order)
      setOrderStatus(data.order.orderStatus ?? 'processing')
      const keys = {}
      const downloads = {}
      for (const item of data.order.items ?? []) {
        keys[item.id] = item.licenseKey ?? ''
        downloads[item.id] = item.downloadUrl ?? ''
      }
      setKeyEdits(keys)
      setDownloadEdits(downloads)
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

  const saveItem = async (itemId) => {
    setSaving(true)
    setStatus('')
    try {
      const body = { downloadUrl: downloadEdits[itemId]?.trim() || '' }
      if (keyEdits[itemId]?.trim()) body.licenseKey = keyEdits[itemId].trim()

      const data = await dashboardApi(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setOrder(data.order)
      setStatus('Product details saved')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  const sendProductKey = async ({ itemIds, completeOrder = false }) => {
    setSaving(true)
    setStatus('')
    try {
      const itemDetails = buildItemDetails(order, keyEdits, downloadEdits)
      const filteredDetails = itemIds?.length
        ? Object.fromEntries(Object.entries(itemDetails).filter(([id]) => itemIds.includes(id)))
        : itemDetails

      if (!Object.keys(filteredDetails).length) {
        setStatus('Enter the activation key for this product first.')
        return
      }

      const data = await dashboardApi(`/api/admin/orders/${orderId}/send-keys`, {
        method: 'POST',
        body: JSON.stringify({
          message: keyMessage || undefined,
          markCompleted: completeOrder,
          itemIds,
          itemDetails: filteredDetails,
        }),
      })
      setOrder(data.order)
      if (completeOrder) setKeyMessage('')
      setStatus(
        data.email?.status === 'sent'
          ? `Product key emailed to ${order.customerEmail}${completeOrder ? ' — order marked completed' : ''}`
          : `Could not send email — add RESEND_API_KEY on the server`,
      )
      onUpdated?.()
      await load()
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
  const showKeyDelivery = !['cancelled', 'refunded'].includes(order.orderStatus)

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
                <p className="font-medium text-slate-500">Customer email</p>
                <a href={`mailto:${order.customerEmail}`} className="mt-1 block font-semibold text-sky-600">{order.customerEmail}</a>
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
              <p className="mt-2">{order.customerEmail}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold">Manual product key delivery</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Enter each activation code and download link, then email to the customer.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.productName}</p>
                      <p className="text-xs text-slate-500">
                        Qty {item.quantity} • {formatMoney(item.unitPrice * item.quantity)}
                        {item.sku ? ` • ${item.sku}` : ''}
                      </p>
                    </div>
                    {item.keySentAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={12} /> Sent {formatDate(item.keySentAt)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs">
                      <span className="font-semibold uppercase tracking-wide text-slate-500">Activation code</span>
                      <input
                        value={keyEdits[item.id] ?? ''}
                        onChange={(e) => setKeyEdits({ ...keyEdits, [item.id]: e.target.value })}
                        placeholder="e.g. GMWPG-PW4HZ-8YFXS-WCCU7"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-white/5"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-semibold uppercase tracking-wide text-slate-500">Download link</span>
                      <input
                        value={downloadEdits[item.id] ?? ''}
                        onChange={(e) => setDownloadEdits({ ...downloadEdits, [item.id]: e.target.value })}
                        placeholder="https://..."
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveItem(item.id)}
                      disabled={saving}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => sendProductKey({ itemIds: [item.id], completeOrder: false })}
                      disabled={saving || !keyEdits[item.id]?.trim()}
                      className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <Send size={12} /> Email this key
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {showKeyDelivery ? (
              <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
                <h4 className="flex items-center gap-2 font-bold text-orange-800 dark:text-orange-200">
                  <Mail size={16} /> Send product key to customer
                </h4>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  Emails activation code(s) and download links to <strong>{order.customerEmail}</strong>.
                  Each key you enter above is transferred manually to the customer via this email.
                </p>
                <textarea
                  value={keyMessage}
                  onChange={(e) => setKeyMessage(e.target.value)}
                  placeholder="Optional message to include in email..."
                  rows={2}
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                />
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={markCompleted}
                    onChange={(e) => setMarkCompleted(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Mark order as completed after sending
                </label>
                <button
                  type="button"
                  onClick={() => sendProductKey({ completeOrder: markCompleted })}
                  disabled={saving}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
                  Email all product keys
                </button>
              </div>
            ) : null}

            <div className="mt-6 border-t border-slate-200 pt-4 text-sm dark:border-white/10">
              <div className="flex justify-between py-2 text-base font-bold">
                <span>Order total</span>
                <span>{formatMoney(order.total)}</span>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="flex items-center gap-2 font-bold">
              <User size={16} /> Customer history
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Total orders</dt><dd className="font-semibold">{stats.totalOrders ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total revenue</dt><dd className="font-semibold">{formatMoney(stats.totalRevenue ?? 0)}</dd></div>
            </dl>
          </section>

          {canRefund ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 dark:border-rose-900/40 dark:bg-rose-950/20">
              <h3 className="flex items-center gap-2 font-bold text-rose-700">
                <RotateCcw size={16} /> Refund
              </h3>
              <button
                type="button"
                onClick={processRefund}
                disabled={saving}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700"
              >
                <CreditCard size={14} /> Refund {formatMoney(order.total)}
              </button>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="font-bold">Order notes</h3>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
              {(order.notes ?? []).map((note) => (
                <div
                  key={note.id}
                  className={`rounded-xl p-3 text-sm ${
                    note.noteType === 'customer'
                      ? 'border border-sky-200 bg-sky-50 dark:border-sky-900/40'
                      : 'bg-slate-50 dark:bg-white/5'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{note.content}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(note.createdAt)}</p>
                </div>
              ))}
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
            <button
              type="button"
              onClick={addNote}
              disabled={saving || !noteText.trim()}
              className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              Add note
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
