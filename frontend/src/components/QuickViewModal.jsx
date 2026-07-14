import { Link } from 'react-router-dom'
import { Package, ShoppingCart, Star, X } from 'lucide-react'
import { formatPrice, discountPercent } from '../lib/api'
import { reviewCountForProduct } from '../lib/reviews'
import ProductImage from './ProductImage'

export default function QuickViewModal({ product, currency, onClose, onAddToCart }) {
  if (!product) return null

  const price = product.displayPrice ?? product.price
  const discount = discountPercent(price, product.originalPrice)
  const hasOriginal = product.originalPrice && product.originalPrice > price
  const stars = Math.round(product.rating ?? 0)
  const reviewCount = product.reviewCount ?? reviewCountForProduct(product)
  const isBundle = product.isBundle || product.productType === 'bundle'
  const bundleContents = product.bundleContents ?? []

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-[var(--store-overlay)] backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-store-surface shadow-2xl animate-fade-in-up sm:max-h-[90vh] sm:overflow-hidden sm:rounded-2xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-store-surface/90 p-2 shadow-md backdrop-blur hover:bg-store-hover transition-colors" aria-label="Close">
          <X size={18} />
        </button>
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-square bg-store-hover">
            {discount > 0 ? <span className="sale-badge">-{discount}%</span> : null}
            {isBundle ? (
              <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-[#7c3aed] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                <Package size={10} /> Bundle
              </span>
            ) : null}
            <ProductImage
              product={product}
              alt={product.name}
              visualAccent={product.visualAccent ?? 'from-slate-400 to-slate-600'}
              fallbackLabel={product.category}
            />
          </div>
          <div className="flex flex-col p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-store-muted">
              {isBundle ? 'Bundle deal' : product.category}
            </p>
            <h2 className="mt-2 text-xl font-extrabold leading-tight text-store-heading md:text-2xl">{product.name}</h2>

            {product.rating ? (
              <div className="star-rating mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={i < stars ? 'fill-current' : 'text-store-border'} strokeWidth={i < stars ? 0 : 1.5} />
                ))}
                <span className="ml-1 text-store-muted">({product.rating.toFixed(1)} · {reviewCount.toLocaleString()})</span>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <p className="text-2xl font-extrabold text-[#f97316]">{formatPrice(price, product.currency ?? currency)}</p>
              {hasOriginal ? (
                <p className="text-base text-store-muted line-through">{formatPrice(product.originalPrice, product.currency ?? currency)}</p>
              ) : null}
            </div>

            {isBundle && bundleContents.length ? (
              <ul className="mt-3 space-y-1 text-sm text-store-body">
                {bundleContents.map((item) => (
                  <li key={item.productId}>
                    · {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-4 flex-1 text-sm leading-relaxed text-store-muted">{product.description}</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
