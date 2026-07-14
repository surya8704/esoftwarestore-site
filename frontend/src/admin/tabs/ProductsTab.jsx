import { useEffect, useRef, useState } from 'react'
import { ImagePlus, LoaderCircle, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { dashboardApi, uploadProductImage } from '../api'
import { CountryRestrictionPicker } from '../components/RestrictionPickers'

export default function ProductsTab({ isAdmin, emptyProductForm, formatMoney }) {
  const [products, setProducts] = useState([])
  const [vendors, setVendors] = useState([])
  const [form, setForm] = useState(emptyProductForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef(null)

  const productsPath = isAdmin ? '/api/admin/products' : '/api/vendor/products'

  const load = async () => {
    const data = await dashboardApi(productsPath)
    setProducts(data.products)
    if (isAdmin) {
      const v = await dashboardApi('/api/admin/vendors')
      setVendors(v.vendors)
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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{isAdmin ? 'All products' : 'My products'}</h2>
          <p className="text-sm text-slate-500">{products.length} listings · country restrictions supported</p>
        </div>
        <button type="button" onClick={reset} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10">
          <Plus size={14} className="inline" /> New
        </button>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          ['name', 'Name'], ['slug', 'Slug'], ['category', 'Category'],
          ['price', 'Price'], ['originalPrice', 'Original price'], ['stock', 'Stock'],
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
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {uploading ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
                {uploading ? 'Uploading...' : 'Upload image'}
              </button>
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

        <CountryRestrictionPicker
          label="Allowed countries (optional)"
          hint="Leave empty for worldwide. If set, product is only visible in selected countries."
          selected={form.allowedCountries ?? []}
          onChange={(allowedCountries) => setForm({ ...form, allowedCountries })}
        />
        <CountryRestrictionPicker
          label="Blocked countries (optional)"
          hint="Customers in these countries will not see this product."
          selected={form.blockedCountries ?? []}
          onChange={(blockedCountries) => setForm({ ...form, blockedCountries })}
        />

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
              </div>
            </div>
            <div className="flex gap-2">
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
