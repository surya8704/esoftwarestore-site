import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Grid2x2, Grid3x3, LayoutGrid, Shield, Sparkles, Zap } from 'lucide-react'
import { trackPage } from '../lib/api'
import { getInstantProducts, loadProducts } from '../lib/products'
import { sortByDefaultCatalogOrder } from '../lib/catalogSort'
import usePageSize from '../hooks/usePageSize'
import { useApp } from '../context/AppContext'
import SEO from '../components/SEO'
import ProductCard from '../components/ProductCard'
import ProductPagination from '../components/ProductPagination'
import QuickViewModal from '../components/QuickViewModal'
import TrustBadge from '../components/TrustBadge'

const ALL_CATEGORIES = 'All'

const SORT_KEYS = [
  { value: 'default', key: 'sortDefault' },
  { value: 'popular', key: 'sortPopular' },
  { value: 'rating', key: 'sortRating' },
  { value: 'latest', key: 'sortLatest' },
  { value: 'price-asc', key: 'sortPriceAsc' },
  { value: 'price-desc', key: 'sortPriceDesc' },
]

export default function HomePage() {
  const { t } = useTranslation()
  const { addToCart, currency, country, locale } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState(() => getInstantProducts())
  const [sort, setSort] = useState('default')
  const [columns, setColumns] = useState(3)
  const [quickView, setQuickView] = useState(null)
  const pageSize = usePageSize()

  const query = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ALL_CATEGORIES
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const showHero = !query && category === ALL_CATEGORIES

  useEffect(() => {
    trackPage('/')
    let cancelled = false
    loadProducts({ country, currency, locale }, (next) => {
      if (!cancelled) setProducts(next)
    })
    return () => { cancelled = true }
  }, [country, currency, locale])

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))].filter(Boolean).sort()
    return [ALL_CATEGORIES, ...cats]
  }, [products])

  const filtered = useMemo(() => {
    let list = [...products]
    if (category !== ALL_CATEGORIES) {
      list = list.filter((p) => p.category?.toLowerCase() === category.toLowerCase())
    }
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q),
      )
    }
    switch (sort) {
      case 'popular':
        list.sort((a, b) => (b.stock < 10 ? 1 : 0) - (a.stock < 10 ? 1 : 0))
        break
      case 'rating':
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        break
      case 'latest':
        list.reverse()
        break
      case 'price-asc':
        list.sort((a, b) => (a.displayPrice ?? a.price) - (b.displayPrice ?? b.price))
        break
      case 'price-desc':
        list.sort((a, b) => (b.displayPrice ?? b.price) - (a.displayPrice ?? a.price))
        break
      default:
        list = sortByDefaultCatalogOrder(list)
        break
    }
    return list
  }, [products, category, query, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const paginated = filtered.slice(pageStart, pageStart + pageSize)
  const showingFrom = filtered.length ? pageStart + 1 : 0
  const showingTo = Math.min(pageStart + pageSize, filtered.length)

  useEffect(() => {
    const requested = parseInt(searchParams.get('page') ?? '1', 10) || 1
    if (requested > totalPages) {
      const params = new URLSearchParams(searchParams)
      if (totalPages <= 1) params.delete('page')
      else params.set('page', String(totalPages))
      setSearchParams(params, { replace: true })
    }
  }, [filtered.length, pageSize, totalPages])

  const gridClass = columns === 2
    ? 'grid-cols-2 sm:grid-cols-2'
    : columns === 4
      ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3'

  const handleAdd = async (product) => {
    await addToCart(product.id, product.variants?.[0]?.id)
  }

  const setCategory = (cat) => {
    const params = new URLSearchParams(searchParams)
    if (cat === ALL_CATEGORIES) params.delete('category')
    else params.set('category', cat)
    params.delete('page')
    setSearchParams(params)
  }

  const goToPage = (nextPage) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages)
    const params = new URLSearchParams(searchParams)
    if (safePage <= 1) params.delete('page')
    else params.set('page', String(safePage))
    setSearchParams(params)
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSortChange = (value) => {
    setSort(value)
    const params = new URLSearchParams(searchParams)
    params.delete('page')
    setSearchParams(params, { replace: true })
  }

  return (
    <>
      <SEO
        title="Discount Software Licenses — Instant Delivery"
        description="Buy genuine Windows, Office, antivirus and utility software licenses at discount prices with instant digital delivery."
      />

      {showHero ? (
        <section className="store-container pt-5 pb-2 sm:pt-8 animate-fade-in-up">
          <div className="store-hero px-5 py-8 sm:px-6 sm:py-10 md:px-12 md:py-14">
            <div className="relative z-10 max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 sm:text-xs">
                <Sparkles size={14} className="text-[#fbbf24]" />
                Trusted by thousands worldwide
              </p>
              <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl md:text-4xl lg:text-5xl">
                {t('heroTitle')}
                <span className="mt-1 block text-[#fbbf24]">{t('heroSubtitle')}</span>
              </h1>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-white/80 md:text-lg">
                {t('heroDesc')}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link to="/checkout" className="btn-store-primary w-full sm:w-auto text-center">
                  {t('shopNow')}
                </Link>
                <a href="#products" className="btn-store-outline w-full sm:w-auto border-white/30 bg-white/10 text-center text-white hover:border-white hover:bg-white/20 hover:text-white">
                  {t('browseCatalog')}
                </a>
              </div>
              <div className="mt-4 [&_.trust-badge--simple]:border-white/25 [&_.trust-badge--simple]:bg-white/10 [&_.trust-badge-score]:text-white [&_.trust-badge-reviews]:text-white/80 [&_.trust-badge-tagline]:text-white/70 [&_.trust-star-off]:text-white/35">
                <TrustBadge placement="home" />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="trust-pill">
                  <Zap size={14} className="text-[#fbbf24]" /> Instant email delivery
                </span>
                <span className="trust-pill">
                  <Shield size={14} className="text-[#4ade80]" /> 100% genuine keys
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div id="products" className="store-container py-6 sm:py-8">
        {!showHero ? (
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-store-heading md:text-3xl">
              {query ? `Results for "${query}"` : category}
            </h1>
            {category !== ALL_CATEGORIES && !query ? (
              <p className="mt-2 text-sm text-store-muted">Browse our {category} software collection</p>
            ) : null}
          </div>
        ) : (
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-store-heading md:text-2xl">{t('featuredProducts')}</h2>
              <p className="mt-1 text-sm text-store-muted">{t('licensesAvailable', { count: products.length })}</p>
            </div>
          </div>
        )}

        <div className="category-scroll mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`category-chip ${category === cat ? 'active' : ''}`}
            >
              {cat === ALL_CATEGORIES ? t('all') : cat}
            </button>
          ))}
        </div>

        <div className="store-card flex flex-col gap-3 p-3 sm:gap-3 sm:p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden items-center gap-2 text-sm text-store-muted sm:flex">
            <span className="font-semibold text-store-heading">{t('gridView')}</span>
            <button type="button" onClick={() => setColumns(2)} className={`rounded-lg border p-2 transition-colors ${columns === 2 ? 'border-[#f97316] bg-store-primary-muted text-[#f97316]' : 'border-store hover:border-[#f97316]/50'}`} aria-label="2 columns">
              <Grid2x2 size={16} />
            </button>
            <button type="button" onClick={() => setColumns(3)} className={`rounded-lg border p-2 transition-colors ${columns === 3 ? 'border-[#f97316] bg-store-primary-muted text-[#f97316]' : 'border-store hover:border-[#f97316]/50'}`} aria-label="3 columns">
              <Grid3x3 size={16} />
            </button>
            <button type="button" onClick={() => setColumns(4)} className={`rounded-lg border p-2 transition-colors ${columns === 4 ? 'border-[#f97316] bg-store-primary-muted text-[#f97316]' : 'border-store hover:border-[#f97316]/50'}`} aria-label="4 columns">
              <LayoutGrid size={16} />
            </button>
          </div>

          <label className="flex w-full items-center gap-2 sm:w-auto sm:max-w-[12rem] sm:shrink-0">
            <span className="sr-only">{t('sortDefault')}</span>
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="store-input !w-full !py-2 !px-2.5 text-xs sm:text-sm sm:!w-auto sm:min-w-0 sm:max-w-[12rem]"
              aria-label={t('sortDefault')}
            >
              {SORT_KEYS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
              ))}
            </select>
          </label>
        </div>

        {filtered.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-store-muted">
              {t('showingRange', { from: showingFrom, to: showingTo, total: filtered.length })}
            </p>
            <p className="text-xs text-store-muted sm:hidden">
              {t('perPage', { count: pageSize })}
            </p>
          </div>
        ) : null}

        <div className={`mt-4 product-grid grid gap-3 sm:mt-5 sm:gap-6 ${gridClass}`}>
          {paginated.map((product, index) => (
            <ProductCard
              key={product.id ?? product.slug ?? `product-${index}`}
              product={product}
              currency={currency}
              onQuickView={setQuickView}
              onAddToCart={handleAdd}
            />
          ))}
        </div>

        <ProductPagination
          page={currentPage}
          totalPages={totalPages}
          total={filtered.length}
          from={showingFrom}
          to={showingTo}
          onPageChange={goToPage}
        />

        {filtered.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-lg font-semibold text-store-heading">No products found</p>
            <p className="mt-2 text-sm text-store-muted">Try a different search or category.</p>
            <button type="button" onClick={() => setCategory(ALL_CATEGORIES)} className="btn-store-primary mt-6">
              View all products
            </button>
          </div>
        ) : null}
      </div>

      <QuickViewModal
        product={quickView}
        currency={currency}
        onClose={() => setQuickView(null)}
        onAddToCart={async (p) => { await handleAdd(p); setQuickView(null) }}
      />
    </>
  )
}
