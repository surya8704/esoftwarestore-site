import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { formatPrice } from '../lib/api'

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
  if (normalized.includes('completed')) return 'bg-[#dcfce7] text-[#166534]'
  if (normalized.includes('paid') || normalized.includes('processing')) return 'bg-[#dbeafe] text-[#1d4ed8]'
  if (normalized.includes('refund') || normalized.includes('cancel') || normalized.includes('fail')) return 'bg-[#fee2e2] text-[#b91c1c]'
  if (normalized.includes('hold')) return 'bg-[#ffedd5] text-[#c2410c]'
  if (normalized === 'created' || normalized.includes('await') || normalized.includes('pending')) return 'bg-[#ffedd5] text-[#c2410c]'
  return 'bg-[#e2e8f0] text-[#475569]'
}

function displayStatus(order) {
  return order.customerStatus ?? order.orderStatus ?? order.paymentStatus ?? 'Pending'
}

export default function OrderCard({ order, currency }) {
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
          <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${statusBadge(displayStatus(order))}`}>
            {displayStatus(order)}
          </span>
          {order.paymentStatus && displayStatus(order) !== order.paymentStatus ? (
            <p className="mt-1 text-xs text-store-muted capitalize">Payment: {order.paymentStatus}</p>
          ) : null}
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
