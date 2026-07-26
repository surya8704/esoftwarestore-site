import { useDeferredValue, useEffect, useId, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Package, Search } from 'lucide-react'
import { formatPrice } from '../lib/api'
import { searchProducts } from '../lib/productSearch'
import ProductImage from './ProductImage'

const MIN_CHARS = 2
const MAX_RESULTS = 8

/**
 * Live product suggestions while typing in the header search.
 */
export default function SearchSuggest({
  query = '',
  products = [],
  currency = 'USD',
  open = false,
  onClose,
  onPick,
  onViewAll,
  className = '',
  mobile = false,
}) {
  const deferredQuery = useDeferredValue(String(query || '').trim())
  const listId = useId()
  const panelRef = useRef(null)

  const suggestions = useMemo(() => {
    if (deferredQuery.length < MIN_CHARS) return []
    return searchProducts(products, deferredQuery, { sortByRelevance: true })
      .slice(0, MAX_RESULTS)
      .map((row) => row.product)
  }, [products, deferredQuery])

  const show = open && deferredQuery.length >= MIN_CHARS

  useEffect(() => {
    if (!show || !onClose) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show, onClose])

  if (!show) return null

  return (
    <div
      ref={panelRef}
      id={listId}
      role="listbox"
      aria-label="Product suggestions"
      className={`z-[60] overflow-hidden border border-store bg-store-surface shadow-xl ${
        mobile
          ? 'mt-3 rounded-2xl'
          : 'absolute left-0 right-0 top-[calc(100%+0.4rem)] rounded-2xl'
      } ${className}`.trim()}
      onMouseDown={(event) => {
        // Keep focus in the search field so the dropdown stays open until a pick
        event.preventDefault()
      }}
    >
      {suggestions.length ? (
        <ul className="max-h-[min(24rem,70vh)] overflow-y-auto py-1">
          {suggestions.map((product) => {
            const price = product.displayPrice ?? product.price
            return (
              <li key={product.id || product.slug} role="option">
                <Link
                  to={`/product/${product.slug}`}
                  onClick={() => onPick?.(product)}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-store-hover"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-store-subtle">
                    <ProductImage
                      product={product}
                      alt=""
                      fallbackLabel={product.category || 'Product'}
                      className="h-full w-full object-cover"
                      fallbackClassName="h-full w-full text-[10px]"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-store-heading">{product.name}</p>
                    <p className="mt-0.5 truncate text-xs text-store-muted">
                      {product.category || 'Software'}
                      {product.licenseType ? ` · ${product.licenseType}` : ''}
                    </p>
                  </div>
                  {!product.hidePrice && price != null ? (
                    <span className="shrink-0 text-sm font-bold text-[#f97316]">
                      {formatPrice(price, product.currency ?? currency)}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex items-start gap-3 px-4 py-4 text-sm text-store-muted">
          <Package size={18} className="mt-0.5 shrink-0 opacity-60" />
          <div>
            <p className="font-medium text-store-heading">No products match “{deferredQuery}”</p>
            <p className="mt-1 text-xs">Try another keyword, or browse all results.</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onViewAll?.(deferredQuery)}
        className="flex w-full items-center justify-center gap-2 border-t border-store bg-store-subtle/80 px-4 py-2.5 text-sm font-semibold text-[#ea580c] transition-colors hover:bg-store-hover"
      >
        <Search size={15} />
        {suggestions.length ? `View all results for “${deferredQuery}”` : `Search “${deferredQuery}”`}
      </button>
    </div>
  )
}
