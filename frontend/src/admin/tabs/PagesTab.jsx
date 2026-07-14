import { useEffect, useState } from 'react'
import { FileText, LoaderCircle, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { dashboardApi } from '../api'

const PAGE_LABELS = {
  terms: 'Terms & Conditions',
  'payment-policy': 'Payment Policy',
  'delivery-policy': 'Delivery Policy',
}

const emptySection = () => ({
  title: '',
  paragraphsText: '',
  listText: '',
  linksText: '',
})

function toEditor(page) {
  return {
    key: page.key,
    title: page.title ?? '',
    description: page.description ?? '',
    updatedLabel: page.updatedLabel ?? '',
    sections: (page.sections ?? []).map((section) => ({
      title: section.title ?? '',
      paragraphsText: (section.paragraphs ?? []).join('\n\n'),
      listText: (section.list ?? []).join('\n'),
      linksText: (section.links ?? []).map((link) => `${link.label}|${link.to}`).join('\n'),
    })),
  }
}

function fromEditor(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    updatedLabel: form.updatedLabel.trim(),
    sections: form.sections.map((section) => ({
      title: section.title.trim(),
      paragraphs: section.paragraphsText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      list: section.listText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      links: section.linksText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, ...rest] = line.split('|')
          return { label: (label ?? '').trim(), to: rest.join('|').trim() }
        })
        .filter((link) => link.label && link.to),
    })),
  }
}

export default function PagesTab() {
  const [pages, setPages] = useState([])
  const [selectedKey, setSelectedKey] = useState('terms')
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const load = async () => {
    const data = await dashboardApi('/api/admin/pages')
    const list = data.pages ?? []
    setPages(list)
    const current = list.find((p) => p.key === selectedKey) ?? list[0]
    if (current) {
      setSelectedKey(current.key)
      setForm(toEditor(current))
    }
  }

  useEffect(() => {
    load().catch((err) => setStatus(err.message))
  }, [])

  const selectPage = (key) => {
    const page = pages.find((p) => p.key === key)
    if (!page) return
    setSelectedKey(key)
    setForm(toEditor(page))
    setStatus('')
  }

  const updateSection = (index, patch) => {
    setForm((prev) => {
      const sections = prev.sections.map((section, i) => (i === index ? { ...section, ...patch } : section))
      return { ...prev, sections }
    })
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form) return
    setLoading(true)
    setStatus('')
    try {
      const result = await dashboardApi(`/api/admin/pages/${selectedKey}`, {
        method: 'PUT',
        body: JSON.stringify(fromEditor(form)),
      })
      setPages((prev) => prev.map((p) => (p.key === result.page.key ? result.page : p)))
      setForm(toEditor(result.page))
      setStatus('Saved. Live storefront will show the updated page.')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = async () => {
    if (!window.confirm('Reset this page to the original default text?')) return
    setLoading(true)
    setStatus('')
    try {
      const result = await dashboardApi(`/api/admin/pages/${selectedKey}/reset`, { method: 'POST' })
      setPages((prev) => prev.map((p) => (p.key === result.page.key ? result.page : p)))
      setForm(toEditor(result.page))
      setStatus('Page reset to defaults.')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!form) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="animate-spin" size={16} /> Loading pages…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Legal pages</h2>
          <p className="mt-1 text-sm text-slate-500">Edit Terms, Payment Policy, and Delivery Policy shown on the storefront.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PAGE_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => selectPage(key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                selectedKey === key
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'
              }`}
            >
              <FileText size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Last updated label</span>
            <input
              value={form.updatedLabel}
              onChange={(e) => setForm({ ...form, updatedLabel: e.target.value })}
              placeholder="July 3, 2026"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">SEO description</span>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
          />
        </label>

        <div className="space-y-4">
          {form.sections.map((section, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Section {index + 1}</p>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, sections: form.sections.filter((_, i) => i !== index) })}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
              <input
                value={section.title}
                onChange={(e) => updateSection(index, { title: e.target.value })}
                placeholder="Section title"
                className="mb-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-white/10 dark:bg-white/5"
                required
              />
              <label className="mb-3 block text-sm">
                <span className="mb-1 block text-slate-500">Paragraphs (separate with a blank line)</span>
                <textarea
                  value={section.paragraphsText}
                  onChange={(e) => updateSection(index, { paragraphsText: e.target.value })}
                  rows={5}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <label className="mb-3 block text-sm">
                <span className="mb-1 block text-slate-500">Bullet list (one item per line)</span>
                <textarea
                  value={section.listText}
                  onChange={(e) => updateSection(index, { listText: e.target.value })}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Links (one per line: Label|/path)</span>
                <textarea
                  value={section.linksText}
                  onChange={(e) => updateSection(index, { linksText: e.target.value })}
                  rows={2}
                  placeholder="Payment Policy|/payment-policy"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                />
              </label>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, sections: [...form.sections, emptySection()] })}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
          >
            <Plus size={14} /> Add section
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
          >
            <RotateCcw size={14} /> Reset to default
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            {loading ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />}
            Save page
          </button>
        </div>
      </form>

      {status ? <p className="text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
