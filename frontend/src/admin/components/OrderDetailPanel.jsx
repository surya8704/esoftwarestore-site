import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Link2,
  LoaderCircle,
  Mail,
  Paperclip,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  User,
  Video,
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

const ATTACHMENT_TYPES = [
  { value: 'link', label: 'Link' },
  { value: 'image', label: 'Image URL' },
  { value: 'video', label: 'Video URL' },
  { value: 'file', label: 'Upload file' },
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

function newAttachment(type = 'link') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    url: '',
    label: '',
    filename: '',
    content: '',
    contentType: '',
  }
}

function itemEditFromServer(item) {
  const attachments = (item.deliveryAttachments ?? []).length
    ? item.deliveryAttachments.map((att) => ({
        ...newAttachment(att.type),
        ...att,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }))
    : item.downloadUrl
      ? [{ ...newAttachment('link'), url: item.downloadUrl, label: 'Download' }]
      : [newAttachment('link')]

  return {
    licenseKey: item.licenseKey ?? '',
    description: item.deliveryDescription ?? '',
    attachments,
  }
}

function buildThankYouDraft(order) {
  const name = order.billingName || 'Customer'
  const products = (order.items ?? []).map((i) => i.productName).join(', ')
  return `Dear ${name},

Thank you for your purchase from eSoftware Store!

Your order #${shortId(order.id)}${products ? ` for ${products}` : ''} has been processed successfully.

Please find your activation code(s), description, and attachments in this email. Keep your license key safe and do not share it with others.

If you need installation help, reply to this email or contact us on WhatsApp.

Best regards,
eSoftware Store Support Team`
}

function buildItemDetailsPayload(itemEdits) {
  const itemDetails = {}
  for (const [itemId, edit] of Object.entries(itemEdits)) {
    const licenseKey = edit.licenseKey?.trim()
    if (!licenseKey) continue
    itemDetails[itemId] = {
      licenseKey,
      deliveryDescription: edit.description?.trim() || undefined,
      deliveryAttachments: (edit.attachments ?? [])
        .filter((att) => att.url?.trim() || att.content)
        .map((att) => ({
          type: att.type,
          url: att.url?.trim() || undefined,
          label: att.label?.trim() || undefined,
          filename: att.filename || undefined,
          content: att.content || undefined,
          contentType: att.contentType || undefined,
        })),
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
  const [itemEdits, setItemEdits] = useState({})
  const [refundReason, setRefundReason] = useState('')
  const [thankYouEmail, setThankYouEmail] = useState('')
  const [markCompleted, setMarkCompleted] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await dashboardApi(`/api/admin/orders/${orderId}`)
      setOrder(data.order)
      setOrderStatus(data.order.orderStatus ?? 'processing')
      const edits = {}
      for (const item of data.order.items ?? []) {
        edits[item.id] = itemEditFromServer(item)
      }
      setItemEdits(edits)
      setThankYouEmail(buildThankYouDraft(data.order))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  const updateItemEdit = (itemId, patch) => {
    setItemEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }))
  }

  const updateAttachment = (itemId, attachmentId, patch) => {
    setItemEdits((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        attachments: prev[itemId].attachments.map((att) =>
          att.id === attachmentId ? { ...att, ...patch } : att,
        ),
      },
    }))
  }

  const addAttachment = (itemId, type = 'link') => {
    setItemEdits((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        attachments: [...(prev[itemId]?.attachments ?? []), newAttachment(type)],
      },
    }))
  }

  const removeAttachment = (itemId, attachmentId) => {
    setItemEdits((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        attachments: prev[itemId].attachments.filter((att) => att.id !== attachmentId),
      },
    }))
  }

  const handleFileAttachment = (itemId, attachmentId, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = String(reader.result ?? '').split(',')[1] ?? ''
      updateAttachment(itemId, attachmentId, {
        type: 'file',
        filename: file.name,
        content: base64,
        contentType: file.type || 'application/octet-stream',
        label: file.name,
      })
    }
    reader.readAsDataURL(file)
  }

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

  const saveDraft = async () => {
    setSaving(true)
    setStatus('')
    try {
      for (const [itemId, edit] of Object.entries(itemEdits)) {
        await dashboardApi(`/api/admin/orders/${orderId}/items/${itemId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...(edit.licenseKey?.trim() ? { licenseKey: edit.licenseKey.trim() } : {}),
            deliveryDescription: edit.description?.trim() || '',
            deliveryAttachments: (edit.attachments ?? [])
              .filter((att) => att.url?.trim() || att.filename)
              .map(({ type, url, label, filename }) => ({ type, url, label, filename })),
          }),
        })
      }
      await load()
      setStatus('Draft saved')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  const sendToCustomer = async () => {
    setSaving(true)
    setStatus('')
    try {
      const itemDetails = buildItemDetailsPayload(itemEdits)
      if (!Object.keys(itemDetails).length) {
        setStatus('Enter at least one activation code before sending.')
        return
      }

      const data = await dashboardApi(`/api/admin/orders/${orderId}/send-keys`, {
        method: 'POST',
        body: JSON.stringify({
          message: thankYouEmail.trim() || undefined,
          markCompleted,
          itemDetails,
        }),
      })
      setOrder(data.order)
      setStatus(
        data.email?.status === 'sent'
          ? `Product key emailed to ${order.customerEmail}${markCompleted ? ' — order completed' : ''}`
          : 'Email could not be sent — configure RESEND_API_KEY on the server',
      )
      onUpdated?.()
      await load()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setSaving(true)
    try {
      await dashboardApi(`/api/admin/orders/${orderId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: noteText.trim(), noteType: 'private' }),
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

  const processRefund = async () => {
    if (!window.confirm(`Refund ${formatMoney(order.total)} via ${paymentLabel(order)}?`)) return
    setSaving(true)
    try {
      const data = await dashboardApi(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason: refundReason || undefined }),
      })
      setOrder(data.order)
      setStatus(`Refund processed (${data.refund?.gateway})`)
      onUpdated?.()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading order details...</p>

  if (error || !order) {
    return (
      <div>
        <button type="button" onClick={onBack} className="mb-4 text-sm font-semibold text-sky-600">
          ← Back to orders
        </button>
        <p className="text-sm text-rose-500">{error || 'Order not found'}</p>
      </div>
    )
  }

  const stats = order.customerStats ?? {}
  const canRefund = order.paymentStatus === 'paid' && order.orderStatus !== 'refunded'
  const showDelivery = !['cancelled', 'refunded'].includes(order.orderStatus)
  const payment = order.payment ?? {}
  const currency = payment.currency ?? order.currency ?? 'INR'

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 text-sm font-semibold text-sky-600">
        ← Back to orders
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Order #{shortId(order.id)}</h2>
          <p className="mt-1 text-sm text-slate-500">{order.customerEmail} • {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadge(order.orderStatus)}`}>
            {order.orderStatus?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {status ? <p className="mb-4 rounded-xl bg-slate-50 px-4 py-2 text-sm dark:bg-white/5">{status}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="font-bold">General</h3>
            <div className="mt-4 flex flex-wrap gap-4">
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button type="button" onClick={saveStatus} disabled={saving} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
                Update status
              </button>
            </div>
          </section>

          {order.paymentStatus === 'paid' ? (
            <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
              <h3 className="font-bold">Payment breakdown</h3>
              <p className="mt-1 text-xs text-slate-500">
                Via {payment.feeProvider ?? order.paymentMethod ?? '—'}
                {order.razorpayPaymentId ? ` • ${order.razorpayPaymentId}` : ''}
                {order.payuPaymentId ? ` • PayU ${order.payuPaymentId}` : ''}
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <dt className="text-xs font-semibold uppercase text-emerald-700">Customer paid</dt>
                  <dd className="mt-1 text-lg font-bold text-emerald-800">{formatMoney(payment.amountPaid ?? order.total, currency)}</dd>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
                  <dt className="text-xs font-semibold uppercase text-rose-700">Platform deduction</dt>
                  <dd className="mt-1 text-lg font-bold text-rose-800">
                    {formatMoney((payment.gatewayFee ?? 0) + (payment.gatewayTax ?? 0), currency)}
                  </dd>
                  <p className="mt-1 text-[11px] text-rose-600">
                    Fee {formatMoney(payment.gatewayFee ?? 0, currency)}
                    {payment.gatewayTax ? ` + tax ${formatMoney(payment.gatewayTax, currency)}` : ''}
                  </p>
                </div>
                <div className="rounded-xl bg-sky-50 p-3 sm:col-span-2 dark:bg-sky-950/30">
                  <dt className="text-xs font-semibold uppercase text-sky-700">Net payout to you</dt>
                  <dd className="mt-1 text-xl font-bold text-sky-800">{formatMoney(payment.netPayout ?? order.total, currency)}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {showDelivery ? (
            <section className="rounded-2xl border border-orange-200 bg-orange-50/40 p-5 dark:border-orange-900/40 dark:bg-orange-950/20">
              <h3 className="flex items-center gap-2 text-lg font-bold text-orange-900 dark:text-orange-100">
                <Mail size={18} /> Manual product key delivery
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Enter each activation code, description, and attachments, then email to{' '}
                <strong>{order.customerEmail}</strong>.
              </p>

              <div className="mt-5 space-y-5">
                {(order.items ?? []).map((item) => {
                  const edit = itemEdits[item.id] ?? itemEditFromServer(item)
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/40">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.productName}</p>
                          <p className="text-xs text-slate-500">
                            Qty {item.quantity} • {formatMoney(item.unitPrice * item.quantity)}
                            {item.sku ? ` • ${item.sku}` : ''}
                          </p>
                        </div>
                        {item.keySentAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={12} /> Sent
                          </span>
                        ) : null}
                      </div>

                      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Activation code
                        <input
                          value={edit.licenseKey}
                          onChange={(e) => updateItemEdit(item.id, { licenseKey: e.target.value })}
                          placeholder="e.g. GMWPG-PW4HZ-8YFXS-WCCU7"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-white/5"
                        />
                      </label>

                      <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Description
                        <textarea
                          value={edit.description}
                          onChange={(e) => updateItemEdit(item.id, { description: e.target.value })}
                          placeholder="Installation notes or product details for the customer..."
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                        />
                      </label>

                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Paperclip size={12} /> Attachments
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {ATTACHMENT_TYPES.map((t) => (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => addAttachment(item.id, t.value)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold dark:border-white/10"
                              >
                                <Plus size={10} /> {t.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-2 space-y-2">
                          {(edit.attachments ?? []).map((att) => (
                            <div key={att.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold capitalize text-slate-600">
                                  {att.type === 'video' ? <Video size={12} /> : att.type === 'link' ? <Link2 size={12} /> : <Paperclip size={12} />}
                                  {att.type}
                                </span>
                                <button type="button" onClick={() => removeAttachment(item.id, att.id)} className="text-slate-400 hover:text-rose-500">
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {att.type === 'file' ? (
                                <div className="space-y-2">
                                  <input
                                    type="file"
                                    accept="image/*,video/*,.pdf,.zip,.exe,.msi,.dmg,.rar,.7z"
                                    onChange={(e) => handleFileAttachment(item.id, att.id, e.target.files?.[0])}
                                    className="w-full text-xs"
                                  />
                                  {att.filename ? <p className="text-xs text-emerald-600">Ready: {att.filename}</p> : null}
                                </div>
                              ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <input
                                    value={att.url}
                                    onChange={(e) => updateAttachment(item.id, att.id, { url: e.target.value })}
                                    placeholder={att.type === 'video' ? 'Video URL (YouTube, etc.)' : att.type === 'image' ? 'Image URL' : 'https://...'}
                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-white/10 dark:bg-white/5"
                                  />
                                  <input
                                    value={att.label}
                                    onChange={(e) => updateAttachment(item.id, att.id, { label: e.target.value })}
                                    placeholder="Label (optional)"
                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-white/10 dark:bg-white/5"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 border-t border-orange-200 pt-5 dark:border-orange-900/40">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Draft thank you email
                  <textarea
                    value={thankYouEmail}
                    onChange={(e) => setThankYouEmail(e.target.value)}
                    rows={8}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed dark:border-white/10 dark:bg-white/5"
                  />
                </label>

                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={markCompleted}
                    onChange={(e) => setMarkCompleted(e.target.checked)}
                  />
                  Mark order as completed after sending
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
                  >
                    <Save size={14} /> Save draft
                  </button>
                  <button
                    type="button"
                    onClick={sendToCustomer}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
                    Email product key to customer
                  </button>
                </div>
              </div>

              <div className="mt-4 text-right text-sm font-bold">
                Order total: {formatMoney(order.total)}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="flex items-center gap-2 font-bold"><User size={16} /> Customer</h3>
            <p className="mt-2 text-sm font-semibold">{order.customerEmail}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Orders</dt><dd>{stats.totalOrders ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Revenue</dt><dd>{formatMoney(stats.totalRevenue ?? 0)}</dd></div>
            </dl>
          </section>

          {canRefund ? (
            <section className="rounded-2xl border border-rose-200 p-5">
              <h3 className="font-bold text-rose-700">Refund</h3>
              <button type="button" onClick={processRefund} disabled={saving} className="mt-3 w-full rounded-full border border-rose-300 py-2 text-sm font-semibold text-rose-700">
                Refund {formatMoney(order.total)}
              </button>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <h3 className="font-bold">Order notes</h3>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
              {(order.notes ?? []).map((note) => (
                <div key={note.id} className="rounded-lg bg-slate-50 p-2 dark:bg-white/5">
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} className="mt-3 w-full rounded-xl border px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" />
            <button type="button" onClick={addNote} disabled={saving || !noteText.trim()} className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Add note
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
