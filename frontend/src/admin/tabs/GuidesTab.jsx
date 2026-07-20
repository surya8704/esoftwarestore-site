import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ImagePlus, LoaderCircle, Pencil, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react'
import { dashboardApi, uploadGuideImage } from '../api'

const emptyGuideForm = {
  title: '',
  slug: '',
  excerpt: '',
  contentHtml: '',
  imageUrl: '',
  categories: '',
  sourceUrl: '',
  publishedAt: '',
  active: true,
}

function toForm(guide) {
  return {
    title: guide.title ?? '',
    slug: guide.slug ?? '',
    excerpt: guide.excerpt ?? '',
    contentHtml: guide.contentHtml ?? '',
    imageUrl: guide.imageUrl ?? '',
    categories: (guide.categories ?? []).join(', '),
    sourceUrl: guide.sourceUrl ?? '',
    publishedAt: guide.publishedAt ? new Date(guide.publishedAt).toISOString().slice(0, 10) : '',
    active: guide.active !== false,
  }
}

export default function GuidesTab() {
  const [guides, setGuides] = useState([])
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyGuideForm)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const fileInputRef = useRef(null)

  const load = async () => {
    const data = await dashboardApi('/api/admin/guides')
    setGuides(data.guides ?? [])
  }

  useEffect(() => {
    load().catch((err) => setStatus(err.message))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return guides
    return guides.filter(
      (g) =>
        g.title?.toLowerCase().includes(q) ||
        g.slug?.toLowerCase().includes(q) ||
        g.categories?.some((c) => c.toLowerCase().includes(q)),
    )
  }, [guides, query])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyGuideForm)
    setShowForm(true)
    setStatus('')
  }

  const openEdit = (guide) => {
    setEditingId(guide.id)
    setForm(toForm(guide))
    setShowForm(true)
    setStatus('')
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyGuideForm)
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
      const data = await uploadGuideImage(file)
      setForm((prev) => ({ ...prev, imageUrl: data.imageUrl }))
      setStatus('Image uploaded')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const save = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim(),
        contentHtml: form.contentHtml,
        imageUrl: form.imageUrl.trim(),
        categories: form.categories,
        sourceUrl: form.sourceUrl.trim(),
        publishedAt: form.publishedAt || null,
        active: form.active,
      }
      if (editingId) {
        await dashboardApi(`/api/admin/guides/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setStatus('Guide updated')
      } else {
        await dashboardApi('/api/admin/guides', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setStatus('Guide created')
      }
      closeForm()
      await load()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const remove = async (guide) => {
    if (!window.confirm(`Delete “${guide.title}”?`)) return
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi(`/api/admin/guides/${guide.id}`, { method: 'DELETE' })
      if (editingId === guide.id) closeForm()
      await load()
      setStatus('Guide deleted')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (guide) => {
    setLoading(true)
    try {
      await dashboardApi(`/api/admin/guides/${guide.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !guide.active }),
      })
      await load()
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
          <h2 className="text-xl font-bold">Guides</h2>
          <p className="mt-1 text-sm text-slate-500">Create, edit, publish, or hide guide articles.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
        >
          <Plus size={14} /> New guide
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guides…"
          className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 dark:border-white/10 dark:bg-white/5"
        />
      </div>

      {showForm ? (
        <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-white/10">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{editingId ? 'Edit guide' : 'New guide'}</h3>
            <button type="button" onClick={closeForm} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-white/10">
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title *"
              className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
            />
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="Slug (optional)"
              className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
            />
            <input
              value={form.categories}
              onChange={(e) => setForm({ ...form, categories: e.target.value })}
              placeholder="Categories (comma separated)"
              className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
            />
            <input
              type="date"
              value={form.publishedAt}
              onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
              className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-white/10">
            <span className="mb-2 block text-xs font-medium">Cover image</span>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-28 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="Guide cover preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="text-slate-400" size={24} />
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
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              placeholder="Source URL"
              className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5 sm:col-span-2"
            />
          </div>
          <textarea
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            placeholder="Excerpt"
            rows={2}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
          />
          <textarea
            value={form.contentHtml}
            onChange={(e) => setForm({ ...form, contentHtml: e.target.value })}
            placeholder="HTML content"
            rows={12}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm dark:border-white/10 dark:bg-white/5"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded"
            />
            Published (visible on storefront)
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white"
          >
            {loading ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />}
            {editingId ? 'Update guide' : 'Create guide'}
          </button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3">Guide</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((guide) => (
              <tr key={guide.id} className="border-t border-slate-100 dark:border-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-sky-50 p-2 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                      <BookOpen size={14} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{guide.title}</p>
                      <p className="text-xs text-slate-400">/{guide.slug}</p>
                      {guide.categories?.length ? (
                        <p className="mt-1 text-xs text-slate-500">{guide.categories.join(', ')}</p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleActive(guide)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      guide.active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {guide.active ? 'Live' : 'Hidden'}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {guide.modifiedAt || guide.publishedAt
                    ? new Date(guide.modifiedAt || guide.publishedAt).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(guide)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(guide)}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No guides found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {status ? <p className="text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
