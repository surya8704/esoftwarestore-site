import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { trackPage } from '../lib/api'
import { getInstantGuides, loadGuidesList } from '../lib/guides'
import usePageSize from '../hooks/usePageSize'
import SEO from '../components/SEO'
import GuideCard from '../components/GuideCard'
import ProductPagination from '../components/ProductPagination'

const PAGE_SIZE_DESKTOP = 12
const PAGE_SIZE_MOBILE = 8

export default function GuidesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [guides, setGuides] = useState(() => getInstantGuides())
  const [meta, setMeta] = useState({ total: getInstantGuides().length, page: 1, totalPages: 1 })

  const category = searchParams.get('category') ?? ''
  const query = searchParams.get('q') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = usePageSize() >= 1024 ? PAGE_SIZE_DESKTOP : PAGE_SIZE_MOBILE

  const categories = useMemo(() => {
    const cats = new Set()
    getInstantGuides().forEach((g) => {
      g.categories?.forEach((c) => cats.add(c))
    })
    return [...cats].sort()
  }, [])

  useEffect(() => {
    trackPage('/guides')
    let cancelled = false
    loadGuidesList({ category, q: query, page }, (next, source) => {
      if (!cancelled && source === 'instant') setGuides(next)
    }).then((data) => {
      if (!cancelled && data?.guides) {
        setGuides(data.guides)
        setMeta({
          total: data.total ?? data.guides.length,
          page: data.page ?? 1,
          totalPages: data.totalPages ?? 1,
        })
      }
    })
    return () => { cancelled = true }
  }, [category, query, page])

  const filtered = useMemo(() => {
    let list = [...getInstantGuides()]
    if (category) {
      const cat = category.toLowerCase()
      list = list.filter(
        (g) =>
          g.categorySlugs?.some((s) => s.toLowerCase() === cat) ||
          g.categories?.some((c) => c.toLowerCase().replace(/\s+/g, '-') === cat),
      )
    }
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(
        (g) => g.title?.toLowerCase().includes(q) || g.excerpt?.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  }, [category, query])

  const useClientPagination = guides.length === filtered.length && filtered.length > 0 && meta.total <= filtered.length
  const total = useClientPagination ? filtered.length : meta.total
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const displayGuides = useClientPagination
    ? filtered.slice(pageStart, pageStart + pageSize)
    : guides
  const showingFrom = total ? pageStart + 1 : 0
  const showingTo = Math.min(pageStart + pageSize, total)

  const setCategory = (cat) => {
    const params = new URLSearchParams(searchParams)
    if (!cat) params.delete('category')
    else params.set('category', cat.toLowerCase().replace(/\s+/g, '-'))
    params.delete('page')
    setSearchParams(params)
  }

  const goToPage = (nextPage) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages)
    const params = new URLSearchParams(searchParams)
    if (safePage <= 1) params.delete('page')
    else params.set('page', String(safePage))
    setSearchParams(params)
    document.getElementById('guides-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <SEO
        title="Guides & Activation Help"
        description="Step-by-step software activation guides, troubleshooting tips, and licensing help from eSoftware Store."
      />

      <div className="store-container py-8 pb-28 lg:pb-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#f97316]">
              <BookOpen size={16} /> Guides & Support
            </p>
            <h1 className="mt-2 text-2xl font-extrabold text-store-heading md:text-3xl">Activation guides & tutorials</h1>
            <p className="mt-2 max-w-2xl text-sm text-store-muted">
              Step-by-step help for Windows, Office, and design software activation, licensing, and troubleshooting.
            </p>
          </div>
          <Link to="/support" className="btn-store-outline shrink-0">
            Contact support
          </Link>
        </div>

        {categories.length > 0 ? (
          <div className="category-scroll mb-6">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`category-chip ${!category ? 'active' : ''}`}
            >
              All guides
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`category-chip ${category === cat.toLowerCase().replace(/\s+/g, '-') ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : null}

        {total > 0 ? (
          <p className="mb-5 text-sm text-store-muted">
            Showing {showingFrom}–{showingTo} of {total} guides
          </p>
        ) : null}

        <div id="guides-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayGuides.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
          ))}
        </div>

        {displayGuides.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-lg font-semibold text-store-heading">No guides found</p>
            <p className="mt-2 text-sm text-store-muted">Try another category or check back soon.</p>
            <button type="button" onClick={() => setCategory('')} className="btn-store-primary mt-6">
              View all guides
            </button>
          </div>
        ) : null}

        <ProductPagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          from={showingFrom}
          to={showingTo}
          onPageChange={goToPage}
        />
      </div>
    </>
  )
}
