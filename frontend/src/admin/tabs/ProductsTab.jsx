import { useEffect, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, ImagePlus, KeyRound, LoaderCircle, Package, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react'
import { dashboardApi, productCoverPreviewUrl, uploadProductImage, uploadProductLicenseKeys } from '../api'
import { isCustomProductImageUrl } from '../../lib/productImages'
import { defaultVendorPermissions } from '../vendorAccess'
import RegionalPricesEditor, {
  mapToRegionalPricesPayload,
  regionalPricesToMap,
} from '../components/RegionalPricesEditor'

function buildBundleName(bundleItems, products) {
  return (bundleItems ?? [])
    .map((item) => {
      const child = products.find((p) => p.id === item.productId)
      const label = String(child?.name || '').trim()
      if (!label) return null
      const qty = Math.max(1, Number(item.quantity) || 1)
      return qty > 1 ? `${label} ×${qty}` : label
    })
    .filter(Boolean)
    .join(' + ')
}

export default function ProductsTab({
  isAdmin,
  emptyProductForm,
  formatMoney,
  vendorPermissions = defaultVendorPermissions(),
}) {
  const [products, setProducts] = useState([])
  const [vendors, setVendors] = useState([])
  const [form, setForm] = useState(emptyProductForm)
  const [editingId, setEditingId] = useState(null)
  const [priceByCountry, setPriceByCountry] = useState({})
  const [loadingRegional, setLoadingRegional] = useState(false)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [keysUploadingId, setKeysUploadingId] = useState(null)
  const [keyOverview, setKeyOverview] = useState(null)
  const [status, setStatus] = useState('')
  const [bundlePickId, setBundlePickId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedId, setHighlightedId] = useState(null)
  const fileInputRef = useRef(null)
  const keysInputRef = useRef(null)
  const keysProductIdRef = useRef(null)
  const listRef = useRef(null)
  const highlightTimerRef = useRef(null)
  const nameManuallyEditedRef = useRef(false)
  const slugManuallyEditedRef = useRef(false)

  const canEditPrices = isAdmin || vendorPermissions.canEditPrices
  const canUploadImages = isAdmin || vendorPermissions.canUploadImages
  const canCreateProducts = isAdmin || (vendorPermissions.canManageProducts && vendorPermissions.canEditPrices)

  const productsPath = isAdmin ? '/api/admin/products' : '/api/vendor/products'

  const standardProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (p.productType ?? 'standard') !== 'bundle' &&
          (!editingId || p.id !== editingId),
      ),
    [products, editingId],
  )

  const bundleSumList = useMemo(() => {
    if ((form.productType ?? 'standard') !== 'bundle') return 0
    return (form.bundleItems ?? []).reduce((sum, item) => {
      const child = products.find((p) => p.id === item.productId)
      return sum + (child ? Number(child.price) * (Number(item.quantity) || 1) : 0)
    }, 0)
  }, [form.productType, form.bundleItems, products])

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
        const [v, overview] = await Promise.all([
          dashboardApi('/api/admin/vendors'),
          dashboardApi('/api/admin/license-keys/overview'),
        ])
        setVendors(v.vendors)
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

  const reset = () => {
    setEditingId(null)
    setForm(emptyProductForm)
    setPriceByCountry({})
    setBundlePickId('')
    setStatus('')
    nameManuallyEditedRef.current = false
    slugManuallyEditedRef.current = false
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const saveRegionalPrices = async (productId) => {
    if (!isAdmin || !productId || !canEditPrices) return 0
    const result = await dashboardApi(`/api/admin/products/${productId}/regional-prices`, {
      method: 'PUT',
      body: JSON.stringify({ regionalPrices: mapToRegionalPricesPayload(priceByCountry) }),
    })
    return result.regionalPrices?.length ?? 0
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setStatus('Please choose an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus('Image must be 5MB or smaller')
      return
    }

    setUploading(true)
    setStatus('')
    try {
      const data = await uploadProductImage(file)
      setForm((prev) => ({ ...prev, imageUrl: data.imageUrl }))
      setStatus('Image uploaded')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const addBundleProduct = () => {
    if (!bundlePickId) return
    const exists = (form.bundleItems ?? []).some((item) => item.productId === bundlePickId)
    if (exists) {
      setStatus('That product is already in the bundle — raise its quantity instead')
      return
    }
    setForm((prev) => ({
      ...prev,
      bundleItems: [...(prev.bundleItems ?? []), { productId: bundlePickId, quantity: 1 }],
      licenseType: prev.productType === 'bundle' && !prev.licenseType ? 'Bundle deal' : prev.licenseType,
    }))
    setBundlePickId('')
  }

  const updateBundleQty = (productId, quantity) => {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1))
    setForm((prev) => ({
      ...prev,
      bundleItems: (prev.bundleItems ?? []).map((item) =>
        item.productId === productId ? { ...item, quantity: qty } : item,
      ),
    }))
  }

  const removeBundleProduct = (productId) => {
    setForm((prev) => ({
      ...prev,
      bundleItems: (prev.bundleItems ?? []).filter((item) => item.productId !== productId),
    }))
  }

  const slugify = (value) =>
    String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)

  useEffect(() => {
    if ((form.productType ?? 'standard') !== 'bundle') return
    if (nameManuallyEditedRef.current) return
    const autoName = buildBundleName(form.bundleItems, products)
    if (!autoName) return
    setForm((prev) => {
      if (prev.name === autoName) return prev
      return {
        ...prev,
        name: autoName,
        slug: slugManuallyEditedRef.current ? prev.slug : slugify(autoName),
      }
    })
  }, [form.productType, form.bundleItems, products])

  const usesCustomImage = isCustomProductImageUrl(form.imageUrl)

  const previewImageUrl = useMemo(() => {
    if (usesCustomImage) return form.imageUrl
    const name = String(form.name || '').trim()
    if (name.length < 2) return ''
    const slug = slugify(form.slug) || slugify(name)
    return productCoverPreviewUrl({
      name,
      category: String(form.category || '').trim() || 'Windows',
      slug,
      productType: form.productType ?? 'standard',
    })
  }, [usesCustomImage, form.imageUrl, form.name, form.slug, form.category, form.productType])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      if ((form.productType ?? 'standard') === 'bundle' && (form.bundleItems?.length ?? 0) < 2) {
        throw new Error('Add at least 2 products to create a bundle deal')
      }
      const name =
        String(form.name || '').trim() ||
        ((form.productType ?? 'standard') === 'bundle' ? buildBundleName(form.bundleItems, products) : '')
      if (name.length < 2) throw new Error('Enter a product name (at least 2 characters)')
      const slug = slugify(form.slug) || slugify(name)
      if (!slug || slug.length < 2) throw new Error('Enter a valid slug (e.g. windows-11-pro)')

      const price = Math.round(Number(form.price) * 100) / 100
      const originalPrice = Math.round(Number(form.originalPrice) * 100) / 100
      if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a valid USD price greater than 0')
      if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
        throw new Error('Enter a valid USD original price greater than 0')
      }

      const body = {
        name,
        slug,
        category: String(form.category || '').trim() || 'Windows',
        productType: form.productType ?? 'standard',
        bundleItems:
          (form.productType ?? 'standard') === 'bundle'
            ? (form.bundleItems ?? []).map((item) => ({
                productId: item.productId,
                quantity: Number(item.quantity) || 1,
              }))
            : [],
        price,
        originalPrice,
        rating: Number(form.rating) || 4.8,
        stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
        licenseType: String(form.licenseType || '').trim() || 'Lifetime',
        imageUrl: usesCustomImage ? form.imageUrl : '',
        visualAccent: form.visualAccent || 'from-sky-500 to-cyan-400',
        description: form.description || '',
        shippingTitle: String(form.shippingTitle || '').trim(),
        shippingBullets: (form.shippingBullets ?? [])
          .map((item) => String(item || '').trim())
          .filter(Boolean),
        vendorId: form.vendorId || undefined,
        allowedCountries: form.allowedCountries ?? [],
        blockedCountries: form.blockedCountries ?? [],
      }

      const base = isAdmin ? '/api/admin/products' : '/api/vendor/products'
      let productId = editingId
      let wasEditing = Boolean(editingId)
      let savedProduct = null
      if (editingId) {
        const updated = await dashboardApi(`${base}/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
        savedProduct = updated.product
        productId = updated.product?.id ?? editingId
      } else {
        const created = await dashboardApi(base, { method: 'POST', body: JSON.stringify(body) })
        savedProduct = created.product
        productId = created.product?.id
      }

      let regionalCount = 0
      let regionalError = ''
      if (isAdmin && productId) {
        try {
          regionalCount = await saveRegionalPrices(productId)
        } catch (regionalErr) {
          regionalError = regionalErr.message
        }
      }

      // Show the new/updated product in the list immediately, then refresh from server.
      if (savedProduct?.id) {
        setProducts((prev) => {
          const next = prev.filter((p) => p.id !== savedProduct.id)
          return [{ ...savedProduct, vendorName: savedProduct.vendorName ?? prev.find((p) => p.id === savedProduct.id)?.vendorName }, ...next]
        })
      }

      await load()
      reset()
      revealProduct(productId)
      setStatus(
        (wasEditing ? 'Product updated' : 'Product created') +
          (regionalCount ? ` · ${regionalCount} regional price${regionalCount === 1 ? '' : 's'} saved` : '') +
          (regionalError ? ` · regional prices failed: ${regionalError}` : ''),
      )
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const edit = async (product) => {
    setEditingId(product.id)
    nameManuallyEditedRef.current = true
    slugManuallyEditedRef.current = true
    setForm({
      name: product.name,
      slug: product.slug,
      category: product.category,
      productType: product.productType ?? 'standard',
      bundleItems: (product.bundleItems ?? []).map((item) => ({
        productId: item.productId,
        quantity: item.quantity ?? 1,
      })),
      price: product.price,
      originalPrice: product.originalPrice,
      rating: product.rating,
      stock: product.stock,
      licenseType: product.licenseType,
      imageUrl: product.imageUrl ?? '',
      visualAccent: product.visualAccent ?? 'from-sky-500 to-cyan-400',
      description: product.description ?? '',
      shippingTitle: product.shippingTitle ?? '',
      shippingBullets:
        Array.isArray(product.shippingBullets) && product.shippingBullets.length
          ? product.shippingBullets
          : product.shippingText
            ? String(product.shippingText).split(/\n+/).map((line) => line.trim()).filter(Boolean)
            : [''],
      vendorId: product.vendorId ?? '',
      allowedCountries: product.allowedCountries ?? [],
      blockedCountries: product.blockedCountries ?? [],
    })
    setBundlePickId('')
    setStatus('')
    setPriceByCountry({})

    if (isAdmin) {
      setLoadingRegional(true)
      try {
        const data = await dashboardApi(`/api/admin/products/${product.id}/regional-prices`)
        setPriceByCountry(regionalPricesToMap(data.regionalPrices))
      } catch (err) {
        setStatus(err.message)
      } finally {
        setLoadingRegional(false)
      }
    }
  }

  const geoLabel = (product) => {
    const allowed = product.allowedCountries ?? []
    const blocked = product.blockedCountries ?? []
    if (!allowed.length && !blocked.length) return 'Worldwide'
    const parts = []
    if (allowed.length) parts.push(`Allow: ${allowed.join(', ')}`)
    if (blocked.length) parts.push(`Block: ${blocked.join(', ')}`)
    return parts.join(' · ')
  }

  const remove = async (id) => {
    setLoading(true)
    try {
      const base = isAdmin ? '/api/admin/products' : '/api/vendor/products'
      await dashboardApi(`${base}/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) reset()
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

  const isBundleForm = (form.productType ?? 'standard') === 'bundle'

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{isAdmin ? 'All products' : 'My products'}</h2>
          <p className="text-sm text-slate-500">
            {searchQuery.trim()
              ? `${filteredProducts.length} of ${products.length} listings`
              : `${products.length} listings`}
            {' · '}create standard products or multi-product bundle deals
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
          <button
            type="button"
            onClick={reset}
            disabled={!canCreateProducts && !editingId}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-white/10"
          >
            <Plus size={14} className="inline" /> New
          </button>
        </div>
      </div>

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

      {!isAdmin && !canEditPrices ? (
        <p className="mt-3 text-sm text-amber-700">Price editing is disabled for your vendor account. Contact the platform admin to change pricing access.</p>
      ) : null}

      <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-medium">Listing type</span>
          <select
            value={form.productType ?? 'standard'}
            onChange={(e) => {
              const productType = e.target.value
              if (productType === 'bundle' && !editingId) {
                nameManuallyEditedRef.current = false
                slugManuallyEditedRef.current = false
              }
              setForm((prev) => ({
                ...prev,
                productType,
                licenseType: productType === 'bundle' && (!prev.licenseType || prev.licenseType === 'Lifetime')
                  ? 'Bundle deal'
                  : prev.licenseType,
                bundleItems: productType === 'bundle' ? prev.bundleItems ?? [] : [],
              }))
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
          >
            <option value="standard">Standard product</option>
            <option value="bundle">Bundle deal (2+ products)</option>
          </select>
        </label>

        {[
          ['name', 'Name'], ['slug', 'Slug'], ['category', 'Category'],
          ...(canEditPrices
            ? [
                ['price', 'Sale price (USD)'],
                ['originalPrice', 'Original price USD (strike-through)'],
              ]
            : []),
          ['stock', 'Stock (display)'],
          ['licenseType', 'License type'], ['rating', 'Rating'],
        ].map(([key, label]) => (
          <label key={key}>
            <span className="mb-1 block text-xs font-medium">{label}</span>
            <input
              value={form[key]}
              onChange={(e) => {
                const value = e.target.value
                setForm((prev) => {
                  const next = { ...prev, [key]: value }
                  if (key === 'name') {
                    nameManuallyEditedRef.current = true
                    if (!editingId && (!prev.slug || prev.slug === slugify(prev.name))) {
                      next.slug = slugify(value)
                    }
                  }
                  if (key === 'slug') {
                    slugManuallyEditedRef.current = true
                    next.slug = slugify(value)
                  }
                  return next
                })
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              placeholder={key === 'slug' ? 'auto-from-name' : undefined}
            />
          </label>
        ))}

        {isBundleForm ? (
          <div className="sm:col-span-2 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/30 dark:bg-violet-500/10">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-violet-900 dark:text-violet-100">
              <Package size={16} /> Bundle products
            </p>
            <p className="mt-1 text-xs text-violet-800/80 dark:text-violet-200/70">
              Pick at least two standard products. The bundle name and cover image are auto-generated from included products.
            </p>
            <button
              type="button"
              onClick={() => {
                nameManuallyEditedRef.current = false
                slugManuallyEditedRef.current = false
                const autoName = buildBundleName(form.bundleItems, products)
                if (!autoName) {
                  setStatus('Add products to the bundle first')
                  return
                }
                setForm((prev) => ({
                  ...prev,
                  name: autoName,
                  slug: slugify(autoName),
                }))
                setStatus('Bundle name regenerated from products')
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-full border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-900 dark:border-violet-500/40 dark:text-violet-100"
            >
              <RefreshCw size={12} /> Regenerate name from products
            </button>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={bundlePickId}
                onChange={(e) => setBundlePickId(e.target.value)}
                className="flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm dark:border-violet-500/30 dark:bg-white/5"
              >
                <option value="">Select a product to include…</option>
                {standardProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatMoney(p.price)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addBundleProduct}
                disabled={!bundlePickId}
                className="inline-flex items-center justify-center gap-1 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {(form.bundleItems ?? []).map((item) => {
                const child = products.find((p) => p.id === item.productId)
                return (
                  <li
                    key={item.productId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200/80 bg-white px-3 py-2 text-sm dark:border-violet-500/20 dark:bg-white/5"
                  >
                    <span className="font-medium">{child?.name ?? item.productId}</span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        Qty
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateBundleQty(item.productId, e.target.value)}
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 dark:border-white/10 dark:bg-transparent"
                        />
                      </label>
                      {child ? (
                        <span className="text-xs text-slate-500">{formatMoney(child.price * (item.quantity || 1))}</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeBundleProduct(item.productId)}
                        className="rounded-full p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        aria-label="Remove from bundle"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            {(form.bundleItems?.length ?? 0) > 0 ? (
              <p className="mt-3 text-xs text-violet-900 dark:text-violet-100">
                Components list price: <strong>{formatMoney(bundleSumList)}</strong>
                {canEditPrices && Number(form.price) > 0 && bundleSumList > Number(form.price) ? (
                  <> · Bundle saves <strong>{formatMoney(bundleSumList - Number(form.price))}</strong></>
                ) : null}
                {(form.bundleItems?.length ?? 0) < 2 ? (
                  <span className="text-amber-700 dark:text-amber-300"> · add at least one more product</span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <span className="mb-2 block text-xs font-medium">Product image</span>
          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-white/10 sm:flex-row sm:items-start">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
              {previewImageUrl ? (
                <img src={previewImageUrl} alt="Product preview" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="text-slate-400" size={28} />
              )}
            </div>
            <div className="flex-1 space-y-3">
              {!usesCustomImage ? (
                <p className="text-xs text-sky-700 dark:text-sky-300">
                  Cover auto-generated from product name. Upload or paste a URL to override.
                </p>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !canUploadImages}
                className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {uploading ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
                {uploading ? 'Uploading...' : 'Upload image'}
              </button>
              {!canUploadImages && !isAdmin ? (
                <p className="text-xs text-amber-700">Image upload permission is disabled for your account.</p>
              ) : null}
              <p className="text-xs text-slate-500">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
              {usesCustomImage ? (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, imageUrl: '' }))}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                >
                  Use auto cover from name
                </button>
              ) : null}
              <label>
                <span className="mb-1 block text-xs font-medium">Or paste image URL</span>
                <input
                  value={usesCustomImage ? form.imageUrl : ''}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                />
              </label>
            </div>
          </div>
        </div>

        {isAdmin ? (
          <label>
            <span className="mb-1 block text-xs font-medium">Vendor</span>
            <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
              <option value="">Platform (no vendor)</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Description</span>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" />
        </label>

        <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Shipping &amp; delivery</p>
          <p className="mt-1 text-xs text-slate-500">
            Title and bullet points shown on the product page Shipping &amp; Delivery tab. Leave bullets empty to use defaults.
          </p>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium">Shipping title</span>
            <input
              value={form.shippingTitle ?? ''}
              onChange={(e) => setForm({ ...form, shippingTitle: e.target.value })}
              placeholder="Digital Download — No Physical Shipment"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            />
          </label>
          <div className="mt-4 space-y-2">
            <span className="block text-xs font-medium">Bullet points</span>
            {(form.shippingBullets ?? ['']).map((bullet, index) => (
              <div key={`shipping-bullet-${index}`} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-center text-slate-400">•</span>
                <input
                  value={bullet}
                  onChange={(e) => {
                    const next = [...(form.shippingBullets ?? [''])]
                    next[index] = e.target.value
                    setForm({ ...form, shippingBullets: next })
                  }}
                  placeholder={
                    index === 0
                      ? 'Instant email delivery after payment'
                      : 'Add another shipping or delivery point'
                  }
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = form.shippingBullets ?? ['']
                    if (current.length <= 1) {
                      setForm({ ...form, shippingBullets: [''] })
                      return
                    }
                    setForm({
                      ...form,
                      shippingBullets: current.filter((_, i) => i !== index),
                    })
                  }}
                  className="rounded-full p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  aria-label="Remove bullet"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  shippingBullets: [...(form.shippingBullets ?? ['']), ''],
                })
              }
              className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
            >
              <Plus size={12} /> Add bullet
            </button>
          </div>
        </div>

        {isAdmin && canEditPrices ? (
          <div className="sm:col-span-2">
            {loadingRegional ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="animate-spin" size={14} /> Loading this product’s regional prices…
              </p>
            ) : (
              <RegionalPricesEditor
                priceByCountry={priceByCountry}
                onChange={setPriceByCountry}
                disabled={loading || uploading}
              />
            )}
          </div>
        ) : null}

        {isAdmin ? (
          <p className="sm:col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-white/5">
            Country visibility (allow/block) is managed on the <strong>Regions</strong> page. Regional sale prices above apply only to <strong>this product</strong>.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:col-span-2">
          {status ? (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                /created|updated|imported|uploaded|saved/i.test(status) && !/fail|error|invalid|required/i.test(status)
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
              }`}
            >
              {status}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || uploading || (!canCreateProducts && !editingId)}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="animate-spin" size={16} /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {editingId ? 'Update' : 'Create'}
          </button>
        </div>
      </form>

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
            {searchQuery.trim() ? `No products match “${searchQuery.trim()}”.` : 'No products yet. Create one above.'}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {filteredProducts.map((p) => {
            const bundle = (p.productType ?? 'standard') === 'bundle'
            const highlighted = highlightedId === p.id
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
                    </p>
                    <p className="text-sm text-slate-500">
                      {p.category} • {formatMoney(p.price)} • Stock {p.stock}
                      {p.vendorName ? ` • ${p.vendorName}` : ''}
                      {bundle ? ` • ${(p.bundleItems?.length ?? 0)} products` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{geoLabel(p)}</p>
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
                  <button type="button" onClick={() => edit(p)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10">Edit</button>
                  <button type="button" onClick={() => remove(p.id)} className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white">
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
