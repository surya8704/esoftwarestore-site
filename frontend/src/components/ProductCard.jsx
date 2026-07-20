import { Link } from 'react-router-dom'
import { Eye, Package, ShoppingCart, Star } from 'lucide-react'
import { formatPrice, discountPercent, formatSoldRecently } from '../lib/api'
import { reviewCountForProduct } from '../lib/reviews'
import ProductImage from './ProductImage'

function StarRating({ rating = 0, count }) {
  const stars = Math.round(rating)
  if (!rating) return null
  return (
    <div className="star-rating mt-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={i < stars ? 'fill-current' : 'text-store-border'}
          strokeWidth={i < stars ? 0 : 1.5}
        />
      ))}
      <span className="ml-1 text-store-muted">
        ({rating.toFixed(1)}
        {count ? ` · ${count.toLocaleString()}` : ''})
      </span>
    </div>
  )
}

export default function ProductCard({ product, currency, onQuickView, onAddToCart, compact = false }) {
  const price = product.displayPrice ?? product.price
  const discount = discountPercent(price, product.originalPrice)
  const hasOriginal = product.originalPrice && product.originalPrice > price
  const soldRecently = formatSoldRecently(product)
  const reviewCount = product.reviewCount ?? reviewCountForProduct(product)
  const isBundle = product.isBundle || product.productType === 'bundle'
  const bundleCount = product.bundleContents?.length ?? product.bundleItems?.length ?? 0

  return (
    <article className="product-card group relative flex h-full flex-col">
      <Link to={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-store-hover">
        {discount > 0 ? <span className="sale-badge">-{discount}%</span> : null}
        {isBundle ? (
          <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-[#7c3aed] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
            <Package size={10} /> Bundle{bundleCount ? ` · ${bundleCount}` : ''}
          </span>
        ) : null}
        <ProductImage
          product={product}
          alt={product.name}
          visualAccent={product.visualAccent ?? 'from-slate-400 to-slate-600'}
          fallbackLabel={product.category}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="text-xs font-medium text-white">View details →</span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4 md:p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-store-muted">{product.category}</p>
        <Link to={`/product/${product.slug}`}>
          <h3 className={`mt-1 font-bold leading-snug text-store-heading transition-colors hover:text-[#f97316] ${isBundle ? 'line-clamp-3' : 'line-clamp-2'} ${compact ? 'text-sm' : 'text-sm sm:text-[15px]'}`}>
            {product.name}
          </h3>
        </Link>

        <StarRating rating={product.rating} count={reviewCount} />

        <p className="mt-1.5 text-[11px] font-semibold text-[#ea580c] sm:text-xs">
          {soldRecently} sold recently
        </p>

        {!compact ? (
          <p className="mt-2 hidden line-clamp-2 text-xs leading-relaxed text-store-muted sm:block">{product.description}</p>
        ) : null}

        <div className="mt-auto pt-3 sm:pt-4">
          {!product.hidePrice ? (
            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
              <p className="text-base font-extrabold text-[#f97316] sm:text-lg">
                {formatPrice(price, product.currency ?? currency)}
              </p>
              {hasOriginal ? (
                <p className="text-sm text-store-muted line-through">
                  {formatPrice(product.originalPrice, product.currency ?? currency)}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="product-card-actions mt-2.5 sm:mt-3">
            <button
              type="button"
              onClick={() => onQuickView?.(product)}
              className="btn-store-outline min-h-[44px] flex-1 px-3 text-xs sm:flex-none sm:px-4 sm:text-[0.8125rem]"
            >
              <Eye size={14} /> <span className="sm:hidden">View</span><span className="hidden sm:inline">Quick view</span>
            </button>
            {!product.hideCart ? (
              <button
                type="button"
                onClick={() => onAddToCart?.(product)}
                className="btn-store-primary min-h-[44px] flex-1 px-3 text-xs sm:flex-none sm:px-4 sm:text-[0.8125rem]"
              >
                <ShoppingCart size={14} /> Add
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
