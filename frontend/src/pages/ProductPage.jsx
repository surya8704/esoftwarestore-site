import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Heart, Package, ShoppingCart, ZoomIn } from 'lucide-react'
import { api, formatPrice, trackPage, discountPercent, soldRecentlyCount, formatSoldRecently } from '../lib/api'
import { MAILTO_URL, SUPPORT_EMAIL, SUPPORT_PHONE, WHATSAPP_URL } from '../lib/contact'
import { findProductBySlug, getInstantProducts, loadProducts } from '../lib/products'
import { useApp } from '../context/AppContext'
import SEO from '../components/SEO'
import ProductCard from '../components/ProductCard'
import ProductImage from '../components/ProductImage'
import ProductReviews, { ProductRatingBadge } from '../components/ProductReviews'

const TABS = [
  { id: 'description', label: 'Description' },
  { id: 'shipping', label: 'Shipping & Delivery' },
  { id: 'detail', label: 'Product Detail' },
  { id: 'guide', label: 'Guide & Support' },
  { id: 'reviews', label: 'Reviews' },
]

function defaultVariantId(product) {
  if (!product?.variants?.length) return null
  const def = product.variants.find((v) => v.isDefault) ?? product.variants[0]
  return def?.id ?? null
}

export default function ProductPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { addToCart, currency, country, locale } = useApp()
  const [data, setData] = useState(() => {
    const product = findProductBySlug(slug)
    return product ? { product, videos: [] } : null
  })
  const [allProducts, setAllProducts] = useState(() => getInstantProducts())
  const [variantId, setVariantId] = useState(() => defaultVariantId(findProductBySlug(slug)))
  const [tab, setTab] = useState('description')
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    trackPage(`/product/${slug}`)
    const cached = findProductBySlug(slug)
    if (cached) {
      setData({ product: cached, videos: [] })
      setVariantId(defaultVariantId(cached))
    }

    let cancelled = false
    loadProducts({ country, currency, locale }, (products) => {
      if (!cancelled) setAllProducts(products)
    })

    api(`/api/products/${slug}`)
      .then((d) => {
        if (!cancelled) {
          setData(d)
          const def = d.product.variants?.find((v) => v.isDefault) ?? d.product.variants?.[0]
          setVariantId(def?.id ?? null)
        }
      })
      .catch(() => {
        if (!cancelled && cached) setData({ product: cached, videos: [] })
      })

    return () => { cancelled = true }
  }, [slug, country, currency, locale])

  if (!data?.product) {
    return (
      <div className="store-container py-20 text-center">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-[#f97316]/20" />
        <p className="mt-4 text-store-muted">Loading product...</p>
      </div>
    )
  }

  const { product } = data
  const selected = product.variants?.find((v) => v.id === variantId)
  const price = selected?.price ?? product.displayPrice ?? product.price
  const discount = discountPercent(price, product.originalPrice)
  const currentIndex = allProducts.findIndex((p) => p.slug === slug)
  const prevProduct = currentIndex > 0 ? allProducts[currentIndex - 1] : null
  const nextProduct = currentIndex < allProducts.length - 1 ? allProducts[currentIndex + 1] : null
  const related = allProducts.filter((p) => p.category === product.category && p.slug !== slug).slice(0, 4)

  const buyNow = async () => {
    await addToCart(product.id, variantId)
    navigate('/checkout')
  }

  const watchers = 20 + (soldRecentlyCount(product) % 80)
  const soldRecently = formatSoldRecently(product)
  const isBundle = product.isBundle || product.productType === 'bundle'
  const bundleContents = product.bundleContents ?? []
  const bundleListTotal = bundleContents.reduce(
    (sum, item) => sum + Number(item.price || 0) * (Number(item.quantity) || 1),
    0,
  )

  return (
    <>
      <SEO title={product.name} description={product.description} path={`/product/${slug}`} product={product} />

      <div className="store-container py-4 pb-36 sm:py-6 lg:pb-6">
        <div className="mb-4 flex flex-col gap-2 border-b border-store pb-3 text-sm text-store-muted sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:pb-4">
          <Link to="/" className="font-medium hover:text-[#f97316] transition-colors">← Back to products</Link>
          <div className="flex gap-3 sm:gap-4">
            {prevProduct ? (
              <Link to={`/product/${prevProduct.slug}`} className="flex items-center gap-1 hover:text-[#f97316]">
                <ChevronLeft size={16} /> Previous
              </Link>
            ) : null}
            {nextProduct ? (
              <Link to={`/product/${nextProduct.slug}`} className="flex items-center gap-1 hover:text-[#f97316]">
                Next <ChevronRight size={16} />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          <div>
            <button
              type="button"
              onClick={() => setZoomed(!zoomed)}
              className={`store-card relative w-full overflow-hidden ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            >
              {discount > 0 ? <span className="sale-badge">-{discount}%</span> : null}
              <ProductImage
                product={product}
                alt={product.name}
                visualAccent={product.visualAccent ?? 'from-slate-400 to-slate-600'}
                fallbackLabel={product.category}
                className={`w-full object-cover transition-transform ${zoomed ? 'scale-125' : 'aspect-square'}`}
                fallbackClassName={zoomed ? 'min-h-[320px]' : 'aspect-square'}
                loading="eager"
              />
              <span className="absolute bottom-3 right-3 rounded bg-store-surface/90 px-2 py-1 text-xs text-store-body shadow">
                <ZoomIn size={12} className="inline" /> Click to enlarge
              </span>
            </button>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-store-muted">
              {isBundle ? 'Bundle deal' : product.category}
            </p>
            <h1 className="mt-2 text-xl font-extrabold leading-tight text-store-heading sm:text-2xl md:text-3xl">{product.name}</h1>

            {isBundle && bundleContents.length ? (
              <div className="mt-4 rounded-2xl border border-store bg-store-hover/60 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-store-heading">
                  <Package size={16} className="text-[#7c3aed]" /> What’s included
                </p>
                <ul className="mt-3 space-y-2">
                  {bundleContents.map((item) => (
                    <li key={item.productId} className="flex items-center gap-3 text-sm">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-store-surface">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-store-muted">
                            <Package size={14} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/product/${item.slug}`} className="font-semibold text-store-heading hover:text-[#f97316]">
                          {item.name}
                        </Link>
                        {item.quantity > 1 ? (
                          <span className="ml-2 text-xs text-store-muted">×{item.quantity}</span>
                        ) : null}
                      </div>
                      {!product.hidePrice ? (
                        <span className="shrink-0 text-xs text-store-muted line-through">
                          {formatPrice(item.price * (item.quantity || 1), product.currency ?? currency)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!product.hidePrice && bundleListTotal > price ? (
                  <p className="mt-3 text-xs font-semibold text-[#059669]">
                    Save {formatPrice(bundleListTotal - price, product.currency ?? currency)} vs buying separately
                  </p>
                ) : null}
              </div>
            ) : null}

            <ProductRatingBadge product={product} className="mt-3" />

            {!product.hidePrice ? (
              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <p className="text-3xl font-extrabold text-[#f97316]">{formatPrice(price, product.currency ?? currency)}</p>
                {product.originalPrice && product.originalPrice > price ? (
                  <p className="text-lg text-store-muted line-through">{formatPrice(product.originalPrice, product.currency ?? currency)}</p>
                ) : null}
                {discount > 0 ? (
                  <span className="rounded-full bg-[#fee2e2] px-2.5 py-0.5 text-xs font-bold text-[#e11d48]">-{discount}% OFF</span>
                ) : null}
              </div>
            ) : null}

            <p className="mt-4 text-sm leading-relaxed text-store-body">{product.description}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-store-primary-muted px-3 py-1 text-xs font-semibold text-[#ea580c]">{soldRecently} sold recently</span>
              <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-semibold text-[#059669] dark:bg-[#064e3b] dark:text-[#4ade80]">{product.stock} in stock</span>
              <span className="rounded-full bg-[#fef2f2] px-3 py-1 text-xs font-semibold text-[#e11d48] dark:bg-[#450a0a] dark:text-[#fca5a5]">{watchers} watching now</span>
            </div>

            {product.variants?.length > 1 ? (
              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold">Select option</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariantId(v.id)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${variantId === v.id ? 'border-[#f97316] bg-store-primary-muted text-[#f97316]' : 'border-store hover:border-[#f97316]/50'}`}
                    >
                      {v.tierLabel ?? v.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8 hidden flex-wrap gap-3 lg:flex">
              {!product.hideCart ? (
                <button type="button" onClick={() => addToCart(product.id, variantId)} className="btn-store-primary min-w-[140px]">
                  <ShoppingCart size={18} /> Add to cart
                </button>
              ) : null}
              <button type="button" onClick={buyNow} className="btn-store-secondary min-w-[140px]">
                Buy now
              </button>
              <button type="button" className="btn-store-outline" aria-label="Add to wishlist">
                <Heart size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 store-card p-4 sm:mt-12 sm:p-6">
          <div className="category-scroll border-b border-store pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id)
                  if (t.id === 'reviews') {
                    requestAnimationFrame(() => {
                      document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    })
                  }
                }}
                className={`shrink-0 px-1 pb-3 text-sm whitespace-nowrap ${tab === t.id ? 'tab-active' : 'text-store-muted hover:text-[#f97316]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="prose prose-sm max-w-none py-6 text-store-body">
            {tab === 'description' ? (
              <div>
                <h2 className="text-lg font-bold text-store-heading">Introduction</h2>
                <p className="mt-3 leading-relaxed">{product.description}</p>
                <p className="mt-4 leading-relaxed">
                  Genuine license with instant digital delivery. Activation key and download instructions sent by email after purchase.
                </p>
              </div>
            ) : null}
            {tab === 'shipping' ? (
              <div>
                <h3 className="font-bold text-store-heading">Digital Download — No Physical Shipment</h3>
                <p className="mt-2">This is a digital-only product. After purchase, the download link and activation key will be sent via email. No CD, DVD, or USB will be shipped.</p>
              </div>
            ) : null}
            {tab === 'detail' ? (
              <ul className="list-disc space-y-2 pl-5">
                <li>License type: {product.licenseType}</li>
                <li>Category: {product.category}</li>
                <li>Instant email delivery after payment</li>
                <li>Official vendor download link included</li>
              </ul>
            ) : null}
            {tab === 'guide' ? (
              <div>
                <p>Installation guide and download link will be sent to you by email.</p>
                <p className="mt-2">
                  For support contact{' '}
                  <a href={MAILTO_URL} className="text-[#f97316]">{SUPPORT_EMAIL}</a>
                  {' '}or{' '}
                  <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-[#f97316]">WhatsApp {SUPPORT_PHONE}</a>.
                </p>
              </div>
            ) : null}
            {tab === 'reviews' ? (
              <p className="text-sm text-store-muted">
                See the full ratings and multilingual customer reviews below this section.
              </p>
            ) : null}
          </div>
        </div>

        <ProductReviews product={product} locale={locale} />

        {related.length > 0 ? (
          <section className="mt-16 border-t border-store pt-10">
            <h2 className="text-xl font-extrabold text-store-heading">Related products</h2>
            <div className="mt-6 product-grid grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  currency={currency}
                  compact
                  onAddToCart={(item) => addToCart(item.id, item.variants?.[0]?.id)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="product-sticky-bar lg:hidden">
        <div className="store-container flex items-center gap-3 p-0">
          <div className="min-w-0 flex-1">
            {!product.hidePrice ? (
              <p className="truncate text-lg font-extrabold text-[#f97316]">
                {formatPrice(price, product.currency ?? currency)}
              </p>
            ) : null}
            <p className="truncate text-xs text-store-muted">{product.name}</p>
          </div>
          {!product.hideCart ? (
            <button
              type="button"
              onClick={() => addToCart(product.id, variantId)}
              className="btn-store-outline min-h-[44px] shrink-0 px-4"
              aria-label="Add to cart"
            >
              <ShoppingCart size={18} />
            </button>
          ) : null}
          <button type="button" onClick={buyNow} className="btn-store-primary min-h-[44px] shrink-0 px-5">
            Buy now
          </button>
        </div>
      </div>
    </>
  )
}
