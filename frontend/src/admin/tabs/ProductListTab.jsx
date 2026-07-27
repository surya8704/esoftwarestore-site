import { useEffect, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, ImagePlus, KeyRound, LoaderCircle, Package, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { dashboardApi, uploadProductLicenseKeys } from '../api'
import { defaultVendorPermissions } from '../vendorAccess'
import { analyzeProductSeo, seoScoreBadgeClass } from '../../lib/productSeo'
import { geoLabel } from '../productAdminShared'

export default function ProductListTab({
  isAdmin,
  formatMoney,
  vendorPermissions = defaultVendorPermissions(),
  onAdd,
  onEdit,
  highlightProductId = null,
  statusMessage = '',
  onStatusClear,
}) {
  const [products, setProducts] = useState([])
  const [keyOverview, setKeyOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [keysUploadingId, setKeysUploadingId] = useState(null)
  const [status, setStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedId, setHighlightedId] = useState(highlightProductId)
  const keysInputRef = useRef(null)
  const keysProductIdRef = useRef(null)
  const listRef = useRef(null)
  const highlightTimerRef = useRef(null)

  const canCreateProducts = isAdmin || (vendorPermissions.canManageProducts && vendorPermissions.canEditPrices)
  const productsPath = isAdmin ? '/api/admin/products' : '/api/vendor/products'

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const haystack = [
        p.name,
        p.slug,
        p.category,
        p.vendorName,
        p.licenseType,
        p.productType,
        ...(p.allowedCountries ?? []),
        ...(p.blockedCountries ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [products, searchQuery])

  const revealProduct = (productId) => {
    if (!productId) return
    setSearchQuery('')
    setHighlightedId(productId)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), 4000)
    requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const row = document.getElementById(`admin-product-${productId}`)
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const load = async () => {
    setListLoading(true)
    try {
      const data = await dashboardApi(productsPath)
      setProducts(data.products ?? [])
      if (isAdmin) {
        const overview = await dashboardApi('/api/admin/license-keys/overview')
        setKeyOverview(overview)
      }
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    load().catch((err) => setStatus(err.message || 'Failed to load products'))
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!highlightProductId) return
    revealProduct(highlightProductId)
  }, [highlightProductId])

  useEffect(() => {
    if (!statusMessage) return
    setStatus(statusMessage)
  }, [statusMessage])

  const remove = async (id) => {
    setLoading(true)
    try {
      await dashboardApi(`${productsPath}/${id}`, { method: 'DELETE' })
      await load()
      setStatus('Product deleted')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openKeysPicker = (productId) => {
    keysProductIdRef.current = productId
    keysInputRef.current?.click()
  }

  const handleKeysUpload = async (event) => {
    const file = event.target.files?.[0]
    const productId = keysProductIdRef.current
    if (!file || !productId) return

    setKeysUploadingId(productId)
    setStatus('')
    try {
      const result = await uploadProductLicenseKeys(productId, file)
      const delivered = result.autoDelivery?.delivered ?? 0
      setStatus(
        `Imported ${result.imported} keys for ${result.productName}` +
          (result.duplicates ? ` · ${result.duplicates} duplicates skipped` : '') +
          ` · pool ${result.available} available` +
          (delivered ? ` · auto-delivered ${delivered} waiting order(s)` : '') +
          (result.awaitingKeys ? ` · ${result.awaitingKeys} still waiting for keys` : ''),
      )
      await load()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setKeysUploadingId(null)
      keysProductIdRef.current = null
      if (keysInputRef.current) keysInputRef.current.value = ''
    }
  }

  const runAutoDeliver = async () => {
    setLoading(true)
    setStatus('')
    try {
      const result = await dashboardApi('/api/admin/orders/auto-deliver-keys', {
        method: 'POST',
        body: JSON.stringify({ limit: 100 }),
      })
      setStatus(
        `Auto-delivery: ${result.delivered} completed` +
          (result.stillWaiting ? ` · ${result.stillWaiting} still awaiting keys` : '') +
          (result.failed ? ` · ${result.failed} failed` : ''),
      )
      await load()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{isAdmin ? 'All products' : 'My products'}</h2>
          <p className="text-sm text-slate-500">
            {searchQuery.trim()
              ? `${filteredProducts.length} of ${products.length} listings`
              : `${products.length} listings`}
            {' · '}manage your catalog and license keys
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => load().catch((err) => setStatus(err.message || 'Failed to load products'))}
            disabled={listLoading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-white/10"
          >
            {listLoading ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Refresh
          </button>
          {canCreateProducts ? (
            <button
              type="button"
              onClick={() => onAdd?.()}
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={14} /> Add product
            </button>
          ) : null}
        </div>
      </div>

      {status ? (
        <p
          className={`mt-4 rounded-xl px-3 py-2 text-sm ${
            /created|updated|imported|uploaded|saved|deleted|completed/i.test(status) && !/fail|error|invalid|required/i.test(status)
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
          }`}
        >
          {status}
        </p>
      ) : null}

      {isAdmin ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-500/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-sky-900 dark:text-sky-100">
                <KeyRound size={16} /> Automatic key delivery
              </p>
              <p className="mt-1 text-sm text-sky-800/80 dark:text-sky-200/80">
                Upload keys on individual products. When a <strong>bundle</strong> sells, keys are taken from each included product’s pool and emailed together.
              </p>
              {keyOverview ? (
                <p className="mt-2 text-xs text-sky-700 dark:text-sky-300">
                  Pool: {keyOverview.available} available · {keyOverview.assigned} assigned
                  {keyOverview.awaitingKeys ? ` · ${keyOverview.awaitingKeys} paid order(s) awaiting keys` : ''}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={runAutoDeliver}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              Process waiting orders
            </button>
          </div>
          <input
            ref={keysInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
            className="hidden"
            onChange={handleKeysUpload}
          />
        </div>
      ) : null}

      <div ref={listRef} className="mt-8 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">Product list</h3>
          <div className="relative min-w-[240px] flex-1 sm:max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, slug, category, vendor..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-10 text-sm dark:border-white/10 dark:bg-white/5"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {listLoading && !products.length ? (
          <p className="mt-4 text-sm text-slate-500">Loading products...</p>
        ) : null}

        {!listLoading && !filteredProducts.length ? (
          <p className="mt-4 text-sm text-slate-500">
            {searchQuery.trim()
              ? `No products match “${searchQuery.trim()}”.`
              : canCreateProducts
                ? 'No products yet. Use Add product to create your first listing.'
                : 'No products yet.'}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {filteredProducts.map((p) => {
            const bundle = (p.productType ?? 'standard') === 'bundle'
            const highlighted = highlightedId === p.id
            const seo = analyzeProductSeo({
              name: p.name,
              slug: p.slug,
              description: p.description,
              imageUrl: p.imageUrl,
              seoTitle: p.seoTitle,
              seoDescription: p.seoDescription,
              focusKeywords: p.focusKeywords,
              variantDescriptions: (p.variants ?? []).map((v) => v.description).filter(Boolean),
            })
            return (
              <div
                key={p.id}
                id={`admin-product-${p.id}`}
                className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                  highlighted
                    ? 'border-sky-400 bg-sky-50 shadow-sm dark:border-sky-500/50 dark:bg-sky-500/10'
                    : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <ImagePlus size={18} />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {p.name}
                      {bundle ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                          <Package size={10} /> Bundle
                        </span>
                      ) : null}
                      {p.showOnHomepage !== false ? (
                        <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                          Front page
                        </span>
                      ) : (
                        <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-400">
                          Hidden on home
                        </span>
                      )}
                      <span
                        className={`ml-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${seoScoreBadgeClass(seo.score)}`}
                        title="SEO score"
                      >
                        SEO {seo.score}
                      </span>
                    </p>
                    <p className="text-sm text-slate-500">
                      {p.category} • {formatMoney(p.price)} • Stock {p.stock}
                      {(p.variants?.length ?? 0) > 1 ? ` • ${p.variants.length} editions` : ''}
                      {p.vendorName ? ` • ${p.vendorName}` : ''}
                      {bundle ? ` • ${(p.bundleItems?.length ?? 0)} products` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{geoLabel(p)}</p>
                    {seo.sections.some((s) => s.status.tone === 'error') ? (
                      <p className="mt-1 text-xs font-medium text-rose-600">
                        SEO needs work · {seo.sections.filter((s) => s.status.tone === 'error').map((s) => s.label).join(', ')}
                      </p>
                    ) : seo.score >= 80 ? (
                      <p className="mt-1 text-xs font-medium text-emerald-600">SEO looking strong</p>
                    ) : null}
                    {isAdmin && !bundle && p.licensePool ? (
                      <p className={`mt-1 text-xs font-semibold ${p.licensePool.available > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        Keys: {p.licensePool.available} available · {p.licensePool.assigned} used
                      </p>
                    ) : null}
                    {bundle ? (
                      <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">
                        Keys delivered from each included product’s pool
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && !bundle ? (
                    <button
                      type="button"
                      onClick={() => openKeysPicker(p.id)}
                      disabled={keysUploadingId === p.id}
                      className="inline-flex items-center gap-1 rounded-full border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700 disabled:opacity-60 dark:border-sky-500/30 dark:text-sky-300"
                    >
                      {keysUploadingId === p.id ? (
                        <LoaderCircle className="animate-spin" size={14} />
                      ) : (
                        <FileSpreadsheet size={14} />
                      )}
                      Upload keys
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onEdit?.(p.id)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={loading}
                    className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    <Trash2 size={14} className="inline" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
