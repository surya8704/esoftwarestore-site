import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { formatPrice } from '../lib/api'
import ProductImage from './ProductImage'

export default function CartDrawer({ open, onClose, cart, currency, onRemove, onUpdateQuantity }) {
  const [removingId, setRemovingId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  if (!open) return null

  const items = cart?.items ?? []
  const total = cart?.total ?? 0

  const handleRemove = async (itemId) => {
    if (!onRemove) return
    setRemovingId(itemId)
    try {
      await onRemove(itemId)
    } finally {
      setRemovingId(null)
    }
  }

  const handleQty = async (itemId, nextQty) => {
    if (!onUpdateQuantity) return
    const qty = Math.max(1, Math.min(9999, Math.floor(Number(nextQty) || 1)))
    setUpdatingId(itemId)
    try {
      await onUpdateQuantity(itemId, qty)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <button type="button" className="absolute inset-0 bg-[var(--store-overlay)] backdrop-blur-sm" onClick={onClose} aria-label="Close cart" />
      <aside className="cart-drawer-panel absolute right-0 top-0 flex w-full max-w-md flex-col bg-store-surface shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between border-b border-store bg-store-primary-muted px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-store-heading">Shopping cart</h2>
            <p className="text-xs text-store-muted">{items.length} item{items.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-store-hover transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-store-hover p-5">
                <ShoppingBag size={36} className="text-store-muted" />
              </div>
              <p className="font-semibold text-store-heading">Your cart is empty</p>
              <p className="mt-1 text-sm text-store-muted">Add some software licenses to get started.</p>
              <Link to="/" onClick={onClose} className="btn-store-primary mt-6">
                Browse products
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 rounded-xl border border-store bg-store-subtle p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-store-hover">
                    <ProductImage
                      product={item.product}
                      alt={item.product?.name ?? ''}
                      visualAccent="from-slate-400 to-slate-600"
                      fallbackLabel={item.product?.category ?? ''}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-store-heading">{item.product?.name}</p>
                    <p className="mt-1 text-sm font-bold text-[#f97316]">
                      {formatPrice(item.unitPrice, currency)}
                      <span className="font-medium text-store-muted"> / unit</span>
                      {item.volumeDiscountPercent ? (
                        <span className="ml-2 text-xs font-semibold text-[#059669]">-{item.volumeDiscountPercent}%</span>
                      ) : null}
                    </p>
                    {item.volumeDiscountPercent && item.listUnitPrice > item.unitPrice ? (
                      <p className="text-xs text-store-muted line-through">{formatPrice(item.listUnitPrice, currency)} each</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-store-muted">Line total {formatPrice(item.lineTotal, currency)}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center overflow-hidden rounded-full border border-store">
                        <button
                          type="button"
                          disabled={updatingId === item.id || item.quantity <= 1}
                          onClick={() => handleQty(item.id, item.quantity - 1)}
                          className="px-2 py-1 text-store-heading disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="min-w-[2rem] px-1 text-center text-xs font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => handleQty(item.id, item.quantity + 1)}
                          className="px-2 py-1 text-store-heading disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        disabled={removingId === item.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-store-muted hover:bg-[#fee2e2] hover:text-[#e11d48] disabled:opacity-50 transition-colors dark:hover:bg-[#450a0a]"
                      >
                        <Trash2 size={12} />
                        {removingId === item.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <div className="cart-drawer-footer border-t border-store bg-store-subtle px-6 py-5">
            <p className="mb-3 text-xs text-store-muted">
              Volume discounts apply automatically at 5+, 25+, and 100+ units.
            </p>
            <div className="mb-4 flex justify-between text-base">
              <span className="font-medium text-store-muted">Subtotal</span>
              <span className="font-extrabold text-[#f97316]">{formatPrice(total, currency)}</span>
            </div>
            <Link to="/checkout" onClick={onClose} className="btn-store-primary w-full">
              Proceed to checkout
            </Link>
            <Link to="/" onClick={onClose} className="mt-3 block text-center text-sm font-medium text-store-muted hover:text-[#f97316] transition-colors">
              Continue shopping
            </Link>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
