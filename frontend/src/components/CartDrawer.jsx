import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Trash2, X } from 'lucide-react'
import { formatPrice } from '../lib/api'

export default function CartDrawer({ open, onClose, cart, currency, onRemove }) {
  const [removingId, setRemovingId] = useState(null)

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
                    {item.product?.imageUrl ? (
                      <img src={item.product.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-store-heading">{item.product?.name}</p>
                    <p className="mt-1 text-sm font-bold text-[#f97316]">
                      {formatPrice(item.lineTotal, currency)} × {item.quantity}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      disabled={removingId === item.id}
                      className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-store-muted hover:bg-[#fee2e2] hover:text-[#e11d48] disabled:opacity-50 transition-colors dark:hover:bg-[#450a0a]"
                    >
                      <Trash2 size={12} />
                      {removingId === item.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <div className="cart-drawer-footer border-t border-store bg-store-subtle px-6 py-5">
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
