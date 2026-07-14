import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, ImagePlus, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { dashboardApi, uploadProductImage, uploadProductLicenseKeys } from '../api'
import { defaultVendorPermissions } from '../vendorAccess'

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
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [keysUploadingId, setKeysUploadingId] = useState(null)
  const [keyOverview, setKeyOverview] = useState(null)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef(null)
  const keysInputRef = useRef(null)
  const keysProductIdRef = useRef(null)

  const canEditPrices = isAdmin || vendorPermissions.canEditPrices
  const canUploadImages = isAdmin || vendorPermissions.canUploadImages
  const canCreateProducts = isAdmin || (vendorPermissions.canManageProducts && vendorPermissions.canEditPrices)

  const productsPath = isAdmin ? '/api/admin/products' : '/api/vendor/products'

  const load = async () => {
    const data = await dashboardApi(productsPath)
    setProducts(data.products)
    if (isAdmin) {
      const [v, overview] = await Promise.all([
        dashboardApi('/api/admin/vendors'),
        dashboardApi('/api/admin/license-keys/overview'),
      ])
      setVendors(v.vendors)
      setKeyOverview(overview)
    }
  }

  useEffect(() => { load().catch(() => {}) }, [isAdmin])

  const reset = () => {
    setEditingId(null)
    setForm(emptyProductForm)
    setStatus('')
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      const body = {
        ...form,
        price: Number(form.price),
        originalPrice: Number(form.originalPrice),
        rating: Number(form.rating),
        stock: Number(form.stock),
        vendorId: form.vendorId || undefined,
        imageUrl: form.imageUrl || '',
        allowedCountries: form.allowedCountries ?? [],
        blockedCountries: form.blockedCountries ?? [],
      }
      const base = isAdmin ? '/api/admin/products' : '/api/vendor/products'
      if (editingId) {
        await dashboardApi(`${base}/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await dashboardApi(base, { method: 'POST', body: JSON.stringify(body) })
      }
      await load()
      reset()
      setStatus(editingId ? 'Product updated' : 'Product created')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const edit = (product) => {
    setEditingId(product.id)
    setForm({
      name: product.name,
      slug: product.slug,
      category: product.category,
      price: product.price,
      originalPrice: product.originalPrice,
      rating: product.rating,
      stock: product.stock,
      licenseType: product.licenseType,
      imageUrl: product.imageUrl ?? '',
      visualAccent: product.visualAccent ?? 'from-sky-500 to-cyan-400',
      description: product.description ?? '',
      vendorId: product.vendorId ?? '',
      allowedCountries: product.allowedCountries ?? [],
      blockedCountries: product.blockedCountries ?? [],
    })
    setStatus('')
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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{isAdmin ? 'All products' : 'My products'}</h2>
          <p className="text-sm text-slate-500">{products.length} listings · country restrictions supported</p>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={!canCreateProducts && !editingId}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-white/10"
        >
          <Plus size={14} className="inline" /> New
        </button>
      </div>

      {isAdmin ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-500/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-sky-900 dark:text-sky-100">
                <KeyRound size={16} /> Automatic key delivery
              </p>
              <p className="mt-1 text-sm text-sky-800/80 dark:text-sky-200/80">
                Upload an Excel/CSV of unique product keys per product. Paid orders pull the next unused key, email the customer, and mark the order completed. If the pool is empty, the order stays <strong>pending</strong> for manual delivery.
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
        {[
          ['name', 'Name'], ['slug', 'Slug'], ['category', 'Category'],
          ...(canEditPrices ? [['price', 'Price'], ['originalPrice', 'Original price']] : []),
          ['stock', 'Stock'],
          ['licenseType', 'License type'], ['rating', 'Rating'],
        ].map(([key, label]) => (
          <label key={key}>
            <span className="mb-1 block text-xs font-medium">{label}</span>
            <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" />
          </label>
        ))}

        <div className="sm:col-span-2">
          <span className="mb-2 block text-xs font-medium">Product image</span>
          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-white/10 sm:flex-row sm:items-start">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="Product preview" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="text-slate-400" size={28} />
              )}
            </div>
            <div className="flex-1 space-y-3">
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
              <label>
                <span className="mb-1 block text-xs font-medium">Or paste image URL</span>
                <input
                  value={form.imageUrl}
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

        {isAdmin ? (
          <p className="sm:col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-white/5">
            Country visibility is managed on the <strong>Regions</strong> page.
          </p>
        ) : null}

        <div className="flex gap-2 sm:col-span-2">
          <button disabled={loading || uploading} className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? <LoaderCircle className="animate-spin" size={16} /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {editingId ? 'Update' : 'Create'}
          </button>
        </div>
      </form>

      <div className="mt-8 space-y-3">
        {products.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
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
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-slate-500">
                  {p.category} • {formatMoney(p.price)} • Stock {p.stock}
                  {p.vendorName ? ` • ${p.vendorName}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{geoLabel(p)}</p>
                {isAdmin && p.licensePool ? (
                  <p className={`mt-1 text-xs font-semibold ${p.licensePool.available > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    Keys: {p.licensePool.available} available · {p.licensePool.assigned} used
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin ? (
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
        ))}
      </div>
      {status ? <p className="mt-4 text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
