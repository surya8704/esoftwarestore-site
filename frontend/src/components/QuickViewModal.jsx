import { Link } from 'react-router-dom'
import { ShoppingCart, Star, X } from 'lucide-react'
import { formatPrice, discountPercent } from '../lib/api'

export default function QuickViewModal({ product, currency, onClose, onAddToCart }) {
  if (!product) return null

  const price = product.displayPrice ?? product.price
  const discount = discountPercent(price, product.originalPrice)
  const hasOriginal = product.originalPrice && product.originalPrice > price
  const stars = Math.round(product.rating ?? 0)

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-[var(--store-overlay)] backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-store-surface shadow-2xl animate-fade-in-up">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-store-surface/90 p-2 shadow-md backdrop-blur hover:bg-store-hover transition-colors" aria-label="Close">
          <X size={18} />
        </button>
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-square bg-store-hover">
            {discount > 0 ? <span className="sale-badge">-{discount}%</span> : null}
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className={`flex h-full items-center justify-center bg-gradient-to-br ${product.visualAccent ?? 'from-slate-400 to-slate-600'} text-white`}>
                {product.category}
              </div>
            )}
          </div>
          <div className="flex flex-col p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-store-muted">{product.category}</p>
            <h2 className="mt-2 text-xl font-extrabold leading-tight text-store-heading md:text-2xl">{product.name}</h2>

            {product.rating ? (
              <div className="star-rating mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < stars ? 'fill-current' : 'text-store-border'} strokeWidth={i < stars ? 0 : 1.5} />
                ))}
                <span className="ml-1 text-store-muted">({product.rating.toFixed(1)})</span>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <p className="text-2xl font-extrabold text-[#f97316]">{formatPrice(price, product.currency ?? currency)}</p>
              {hasOriginal ? (
                <p className="text-base text-store-muted line-through">{formatPrice(product.originalPrice, product.currency ?? currency)}</p>
              ) : null}
            </div>

            <p className="mt-4 flex-1 text-sm leading-relaxed text-store-muted">{product.description}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => onAddToCart(product)} className="btn-store-primary">
                <ShoppingCart size={16} /> Add to cart
              </button>
              <Link to={`/product/${product.slug}`} onClick={onClose} className="btn-store-secondary">
                View details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
