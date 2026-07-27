import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, LoaderCircle, Package, Pencil, Plus, RefreshCw, Upload, X } from 'lucide-react'
import { dashboardApi, uploadProductImage } from '../api'
import { isCustomProductImageUrl } from '../../lib/productImages'
import { defaultVendorPermissions } from '../vendorAccess'
import RegionalPricesEditor, {
  mapToRegionalPricesPayload,
  regionalPricesToMap,
} from '../components/RegionalPricesEditor'
import ProductVariantsEditor from '../components/ProductVariantsEditor'
import ProductSeoPanel from '../components/ProductSeoPanel'
import { buildBundleName, mapProductToForm, slugify } from '../productAdminShared'

export default function ProductFormTab({
  isAdmin,
  emptyProductForm,
  formatMoney,
  vendorPermissions = defaultVendorPermissions(),
  editId = null,
  onDone,
  onCancel,
}) {
  const [products, setProducts] = useState([])
  const [vendors, setVendors] = useState([])
  const [form, setForm] = useState(emptyProductForm)
  const editingId = editId
  const [priceByCountry, setPriceByCountry] = useState({})
  const [loadingRegional, setLoadingRegional] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(Boolean(editId))
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [bundlePickId, setBundlePickId] = useState('')
  const fileInputRef = useRef(null)
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

  const loadProducts = async () => {
    const data = await dashboardApi(productsPath)
    setProducts(data.products ?? [])
    if (isAdmin) {
      const v = await dashboardApi('/api/admin/vendors')
      setVendors(v.vendors)
    }
  }

  useEffect(() => {
    let cancelled = false
    setFormLoading(true)
    setStatus('')

    const init = async () => {
      try {
        await loadProducts()
        if (cancelled) return

        if (editId) {
          const data = await dashboardApi(productsPath)
          const product = (data.products ?? []).find((p) => p.id === editId)
          if (!product) throw new Error('Product not found')
          if (cancelled) return
          nameManuallyEditedRef.current = true
          slugManuallyEditedRef.current = true
          setForm(mapProductToForm(product))
          setBundlePickId('')
          setPriceByCountry({})
          if (isAdmin) {
            setLoadingRegional(true)
            try {
              const regional = await dashboardApi(`/api/admin/products/${product.id}/regional-prices`)
              if (!cancelled) setPriceByCountry(regionalPricesToMap(regional.regionalPrices))
            } finally {
              if (!cancelled) setLoadingRegional(false)
            }
          }
        } else {
          resetForm()
        }
      } catch (err) {
        if (!cancelled) setStatus(err.message || 'Failed to load product')
      } finally {
        if (!cancelled) setFormLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [editId, isAdmin])

  const resetForm = () => {
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

  const isAllowedImageFile = (file) => {
    const type = String(file?.type || '').toLowerCase()
    if (type.startsWith('image/')) return true
    // Some browsers (esp. Windows) send empty/octet-stream for WebP
    const ext = String(file?.name || '').split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'webp', 'wepg', 'gif'].includes(ext)
  }

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isAllowedImageFile(file)) {
      setStatus('Please choose a JPEG, PNG, WebP, or GIF image')
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

  const previewImageUrl = usesCustomImage ? form.imageUrl : ''

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

      const variantsPayload = (form.variants ?? [])
        .map((v) => ({
          id: v.id ? String(v.id) : undefined,
          name: String(v.name || '').trim(),
          sku: String(v.sku || '').trim(),
          price: Math.round(Number(v.price) * 100) / 100,
          originalPrice: Math.round(Number(v.originalPrice) * 100) / 100,
          stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
          description: String(v.description || ''),
          imageUrl: String(v.imageUrl || '').trim(),
          tierLabel: String(v.tierLabel || v.name || '').trim(),
          isDefault: Boolean(v.isDefault),
          active: true,
        }))
        .filter((v) => v.name)

      if ((form.variants ?? []).length > 0 && variantsPayload.length === 0) {
        throw new Error('Each edition needs a name')
      }
      for (const v of variantsPayload) {
        if (!Number.isFinite(v.price) || v.price <= 0) throw new Error(`Enter a valid price for edition “${v.name}”`)
        if (!Number.isFinite(v.originalPrice) || v.originalPrice <= 0) {
          throw new Error(`Enter a valid compare-at price for edition “${v.name}”`)
        }
      }

      const defaultVariant = variantsPayload.find((v) => v.isDefault) ?? variantsPayload[0]
      // Always send an array so the API can clear editions when empty
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
        price: defaultVariant?.price ?? price,
        originalPrice: defaultVariant?.originalPrice ?? originalPrice,
        rating: Number(form.rating) || 4.8,
        stock: defaultVariant?.stock ?? Math.max(0, Math.floor(Number(form.stock) || 0)),
        licenseType: String(form.licenseType || '').trim() || 'Lifetime',
        imageUrl: usesCustomImage ? form.imageUrl : '',
        visualAccent: form.visualAccent || 'from-sky-500 to-cyan-400',
        description: form.description || '',
        seoTitle: String(form.seoTitle || '').trim(),
        seoDescription: String(form.seoDescription || '').trim(),
        focusKeywords: (form.focusKeywords ?? [])
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 10),
        shippingTitle: String(form.shippingTitle || '').trim(),
        shippingBullets: (form.shippingBullets ?? [])
          .map((item) => String(item || '').trim())
          .filter(Boolean),
        vendorId: form.vendorId || undefined,
        allowedCountries: form.allowedCountries ?? [],
        blockedCountries: form.blockedCountries ?? [],
        variants: variantsPayload,
        showOnHomepage: form.showOnHomepage !== false,
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

      // Refresh product list data for bundle picker, then return to list.
      await loadProducts()
      const message =
        (wasEditing ? 'Product updated' : 'Product created') +
        (regionalCount ? ` · ${regionalCount} regional price${regionalCount === 1 ? '' : 's'} saved` : '') +
        (regionalError ? ` · regional prices failed: ${regionalError}` : '')
      onDone?.(productId, message)
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isBundleForm = (form.productType ?? 'standard') === 'bundle'

  if (formLoading) {
    return (
      <div className="py-16 text-center">
        <LoaderCircle className="mx-auto animate-spin text-sky-600" size={28} />
        <p className="mt-3 text-sm text-slate-500">Loading product form...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-sky-600"
          >
            <ArrowLeft size={16} /> Back to products
          </button>
          <h2 className="text-2xl font-bold">{editingId ? 'Edit product' : 'Add product'}</h2>
          <p className="text-sm text-slate-500">
            {editingId
              ? 'Update listing details, pricing, editions, and SEO.'
              : 'Create a standard product or multi-product bundle deal.'}
          </p>
        </div>
      </div>

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

        <label className="sm:col-span-2 flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10">
          <input
            type="checkbox"
            checked={form.showOnHomepage !== false}
            onChange={(e) => setForm({ ...form, showOnHomepage: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#f97316] focus:ring-[#f97316]"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Show on front page</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              When checked, this product appears in the homepage product grid. Uncheck to keep it in the catalog but hide it from the front page.
            </span>
          </span>
        </label>

        {[
          ['name', 'Name'], ['slug', 'URL slug'], ['category', 'Category'],
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
              placeholder={key === 'slug' ? 'windows-11-pro' : undefined}
            />
            {key === 'slug' ? (
              <span className="mt-1 block text-[11px] text-slate-400">
                Live URL: esoftwarestore.com/product/{slugify(form.slug) || '…'}
              </span>
            ) : null}
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
              <p className="text-xs text-slate-500">
                Upload an image or paste an image URL. Products without an image show a blank placeholder on the storefront.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
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
        {(form.productType ?? 'standard') !== 'bundle' ? (
          <ProductVariantsEditor
            variants={form.variants ?? []}
            productPrice={form.price}
            productOriginalPrice={form.originalPrice}
            productStock={form.stock}
            disabled={loading}
            canUploadImages={canUploadImages}
            onChange={(variants) => {
              const next = Array.isArray(variants) ? variants : []
              const def = next.length ? next.find((v) => v.isDefault) ?? next[0] : null
              setForm((prev) => ({
                ...prev,
                variants: next,
                ...(def
                  ? {
                      price: def.price !== '' && def.price != null ? def.price : prev.price,
                      originalPrice:
                        def.originalPrice !== '' && def.originalPrice != null
                          ? def.originalPrice
                          : prev.originalPrice,
                      stock: def.stock ?? prev.stock,
                    }
                  : {}),
              }))
            }}
          />
        ) : null}

        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={'Write a full product description.\n\n- Use a dash for bullet points\n- One point per line\n1. Or numbered lists'}
            className="min-h-36 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
          />
          <span className="mt-1 block text-xs text-slate-500">
            No character limit. Start lines with - or 1. to show bullet/numbered lists on the product page.
          </span>
        </label>

        <ProductSeoPanel
          name={form.name}
          slug={form.slug}
          description={form.description}
          imageUrl={usesCustomImage ? form.imageUrl : ''}
          seoTitle={form.seoTitle}
          seoDescription={form.seoDescription}
          focusKeywords={form.focusKeywords ?? []}
          variantDescriptions={(form.variants ?? []).map((v) => v.description).filter(Boolean)}
          onChange={(patch) => {
            if (Object.prototype.hasOwnProperty.call(patch, 'slug')) {
              slugManuallyEditedRef.current = true
            }
            setForm((prev) => ({ ...prev, ...patch }))
          }}
        />

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
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || uploading || (!canCreateProducts && !editingId)}
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}
              {editingId ? 'Update product' : 'Create product'}
            </button>
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
