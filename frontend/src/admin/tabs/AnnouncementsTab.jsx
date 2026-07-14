import { useEffect, useState } from 'react'
import { LoaderCircle, Megaphone, Pencil, Plus, Pin, Trash2 } from 'lucide-react'
import { dashboardApi } from '../api'

const emptyForm = {
  title: '',
  message: '',
  linkUrl: '',
  linkLabel: '',
  active: true,
  pinned: false,
  startsAt: '',
  endsAt: '',
}

function toForm(item) {
  return {
    title: item.title ?? '',
    message: item.message ?? '',
    linkUrl: item.linkUrl ?? '',
    linkLabel: item.linkLabel ?? '',
    active: item.active !== false,
    pinned: Boolean(item.pinned),
    startsAt: item.startsAt ? new Date(item.startsAt).toISOString().slice(0, 16) : '',
    endsAt: item.endsAt ? new Date(item.endsAt).toISOString().slice(0, 16) : '',
  }
}

export default function AnnouncementsTab() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const load = async () => {
    const data = await dashboardApi('/api/admin/announcements')
    setItems(data.announcements ?? [])
  }

  useEffect(() => {
    load().catch((err) => setStatus(err.message))
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
    setStatus('')
  }

  const openEdit = (item) => {
    setEditingId(item.id)
    setForm(toForm(item))
    setShowForm(true)
    setStatus('')
  }

  const save = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        linkUrl: form.linkUrl.trim() || null,
        linkLabel: form.linkLabel.trim() || null,
        active: form.active,
        pinned: form.pinned,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      }
      if (editingId) {
        await dashboardApi(`/api/admin/announcements/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setStatus('Announcement updated')
      } else {
        await dashboardApi('/api/admin/announcements', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setStatus('Announcement created')
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
      await dashboardApi(`/api/admin/announcements/${item.id}`, {
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

  const togglePinned = async (item) => {
    setLoading(true)
    try {
      await dashboardApi(`/api/admin/announcements/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned: !item.pinned }),
      })
      await load()
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete “${item.title}”?`)) return
    setLoading(true)
    try {
      await dashboardApi(`/api/admin/announcements/${item.id}`, { method: 'DELETE' })
      if (editingId === item.id) {
        setShowForm(false)
        setEditingId(null)
      }
      await load()
      setStatus('Announcement deleted')
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
          <h2 className="text-2xl font-bold">Announcements</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create news items that scroll in the storefront marquee for all shoppers.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
        >
          <Plus size={14} /> New announcement
        </button>
      </div>

      {showForm ? (
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-dashed border-slate-300 p-5 dark:border-white/10">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Title</span>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                placeholder="Flash sale / Delivery update"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Message</span>
              <textarea
                required
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                placeholder="Shown in the scrolling marquee"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium">Link URL (optional)</span>
              <input
                value={form.linkUrl}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                placeholder="/guides or https://..."
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium">Link label</span>
              <input
                value={form.linkLabel}
                onChange={(e) => setForm({ ...form, linkLabel: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                placeholder="Shop now"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium">Starts at (optional)</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium">Ends at (optional)</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded"
              />
              Active (show on storefront)
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="rounded"
              />
              Pin to front of marquee
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : editingId ? 'Update' : 'Publish'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Megaphone size={14} className="text-sky-600" />
                  <h3 className="font-semibold">{item.title}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.active ? 'Live' : 'Hidden'}
                  </span>
                  {item.pinned ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                      Pinned
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.message}</p>
                {item.linkUrl ? (
                  <p className="mt-1 text-xs text-slate-400">
                    Link: {item.linkLabel || 'Open'} → {item.linkUrl}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => togglePinned(item)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                >
                  <Pin size={12} /> {item.pinned ? 'Unpin' : 'Pin'}
                </button>
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
                  onClick={() => remove(item)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {!items.length ? (
          <p className="text-sm text-slate-500">No announcements yet. Create one to show it in the storefront marquee.</p>
        ) : null}
      </div>

      {status ? <p className="text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
