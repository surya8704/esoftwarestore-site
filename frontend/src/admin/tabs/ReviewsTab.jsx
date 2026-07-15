import { useEffect, useMemo, useState } from 'react'
import { LoaderCircle, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react'
import { dashboardApi } from '../api'

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
]

const emptyForm = {
  productId: '',
  author: '',
  locale: 'en',
  rating: 5,
  title: '',
  text: '',
  verified: true,
  helpful: 18,
  active: true,
}

function toForm(item) {
  return {
    productId: item.productId ?? '',
    author: item.author ?? '',
    locale: item.locale ?? 'en',
    rating: item.rating ?? 5,
    title: item.title ?? '',
    text: item.text ?? '',
    verified: item.verified !== false,
    helpful: item.helpful ?? 12,
    active: item.active !== false,
  }
}

function pickRandom(list = []) {
  if (!list.length) return null
  return list[Math.floor(Math.random() * list.length)]
}

export default function ReviewsTab() {
  const [reviews, setReviews] = useState([])
  const [products, setProducts] = useState([])
  const [templates, setTemplates] = useState(null)
  const [filterProductId, setFilterProductId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const load = async () => {
    const [reviewData, productData, templateData] = await Promise.all([
      dashboardApi('/api/admin/reviews'),
      dashboardApi('/api/admin/products'),
      dashboardApi('/api/admin/reviews/templates'),
    ])
    setReviews(reviewData.reviews ?? [])
    setProducts(productData.products ?? [])
    setTemplates(templateData)
  }

  useEffect(() => {
    load().catch((err) => setStatus(err.message))
  }, [])

  const filtered = useMemo(() => {
    if (!filterProductId) return reviews
    return reviews.filter((r) => r.productId === filterProductId)
  }, [reviews, filterProductId])

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      productId: filterProductId || products[0]?.id || '',
    })
    setShowForm(true)
    setStatus('')
  }

  const openEdit = (item) => {
    setEditingId(item.id)
    setForm(toForm(item))
    setShowForm(true)
    setStatus('')
  }

  const fillFromTemplate = () => {
    if (!templates) {
      setStatus('Templates are still loading')
      return
    }
    const locale = form.locale || 'en'
    const names = templates.names?.[locale] ?? templates.names?.en ?? []
    const bodies = templates.bodies?.[locale] ?? templates.bodies?.en ?? []
    const name = pickRandom(names)
    const body = pickRandom(bodies)
    if (!name || !body) {
      setStatus('No marketing templates for this language')
      return
    }
    setForm((prev) => ({
      ...prev,
      author: name,
      rating: body.stars ?? 5,
      title: body.title,
      text: body.text,
      verified: true,
      helpful: 8 + Math.floor(Math.random() * 28),
    }))
    setStatus(`Filled ${locale.toUpperCase()} marketing-style review — edit before saving if needed`)
  }

  const save = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      if (!form.productId) throw new Error('Select a product')
      const payload = {
        productId: form.productId,
        author: form.author.trim(),
        locale: form.locale,
        rating: Number(form.rating),
        title: form.title.trim(),
        text: form.text.trim(),
        verified: form.verified,
        helpful: Number(form.helpful) || 0,
        active: form.active,
      }
      if (editingId) {
        await dashboardApi(`/api/admin/reviews/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setStatus('Review updated')
      } else {
        await dashboardApi('/api/admin/reviews', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setStatus('Review created — it will appear first on that product’s page')
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      await load()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (item) => {
    setLoading(true)
    try {
      await dashboardApi(`/api/admin/reviews/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      })
      await load()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this review?')) return
    setLoading(true)
    try {
      await dashboardApi(`/api/admin/reviews/${id}`, { method: 'DELETE' })
      await load()
      if (editingId === id) {
        setShowForm(false)
        setEditingId(null)
        setForm(emptyForm)
      }
      setStatus('Review deleted')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Client reviews</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create marketing-style reviews per product. They show first on the product page; generated filler reviews still fill the rest.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={14} /> New review
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="min-w-[16rem] flex-1">
          <span className="mb-1 block text-xs font-medium">Filter by product</span>
          <select
            value={filterProductId}
            onChange={(e) => setFilterProductId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showForm ? (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">{editingId ? 'Edit review' : 'Create review'}</h3>
            <button
              type="button"
              onClick={fillFromTemplate}
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:text-violet-200"
            >
              <Sparkles size={14} /> Fill from marketing template
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Product</span>
              <select
                required
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium">Language</span>
              <select
                value={form.locale}
                onChange={(e) => setForm({ ...form, locale: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              >
                {LOCALES.map((loc) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium">Stars</span>
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium">Author name</span>
              <input
                required
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium">Helpful count</span>
              <input
                type="number"
                min="0"
                value={form.helpful}
                onChange={(e) => setForm({ ...form, helpful: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Title</span>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Review text</span>
              <textarea
                required
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.verified}
                onChange={(e) => setForm({ ...form, verified: e.target.checked })}
              />
              Verified purchase badge
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active on storefront
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="animate-spin" size={14} /> : null}
              {editingId ? 'Update review' : 'Create review'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                setForm(emptyForm)
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.text}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{item.author}</span>
                  <span>· {item.productName ?? item.productId}</span>
                  <span>· {item.language ?? item.locale}</span>
                  <span className="inline-flex items-center gap-0.5 text-amber-500">
                    <Star size={12} className="fill-current" /> {item.rating}
                  </span>
                  {item.verified ? <span className="text-emerald-600">Verified</span> : null}
                  <span className={item.active ? 'text-emerald-600' : 'text-rose-500'}>
                    {item.active ? 'Active' : 'Hidden'}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                >
                  {item.active ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {!filtered.length ? (
          <p className="text-sm text-slate-500">No custom reviews yet. Create one or fill from a marketing template.</p>
        ) : null}
      </div>

      {status ? <p className="text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
