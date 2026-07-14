import { useEffect, useState } from 'react'
import { Check, LoaderCircle, Plus, Shield, X } from 'lucide-react'
import { dashboardApi } from '../api'
import {
  VENDOR_PERMISSION_KEYS,
  VENDOR_PERMISSION_META,
  defaultVendorPermissions,
  normalizeVendorPermissions,
} from '../vendorAccess'

function PermissionEditor({ permissions, onChange }) {
  const values = normalizeVendorPermissions(permissions)

  const toggle = (key, checked) => {
    const next = { ...values, [key]: checked }
    if (key === 'canManageProducts' && !checked) {
      next.canEditPrices = false
      next.canUploadImages = false
    }
    if (key === 'canViewOrders' && !checked) {
      next.canViewLicenseKeys = false
    }
    if (key === 'canEditPrices' && checked) next.canManageProducts = true
    if (key === 'canUploadImages' && checked) next.canManageProducts = true
    if (key === 'canViewLicenseKeys' && checked) next.canViewOrders = true
    onChange(normalizeVendorPermissions(next))
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {VENDOR_PERMISSION_KEYS.map((key) => {
        const meta = VENDOR_PERMISSION_META[key]
        const disabled =
          (key === 'canEditPrices' || key === 'canUploadImages') && !values.canManageProducts
            ? false
            : false
        return (
          <label
            key={key}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-white/10"
          >
            <input
              type="checkbox"
              checked={Boolean(values[key])}
              disabled={disabled}
              onChange={(e) => toggle(key, e.target.checked)}
              className="mt-0.5 rounded"
            />
            <span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{meta.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{meta.hint}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

function AccessChips({ permissions }) {
  const values = normalizeVendorPermissions(permissions)
  const enabled = VENDOR_PERMISSION_KEYS.filter((key) => values[key])
  if (!enabled.length) {
    return <span className="text-xs text-rose-600">No portal access granted</span>
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {enabled.map((key) => (
        <span
          key={key}
          className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
        >
          {VENDOR_PERMISSION_META[key].label}
        </span>
      ))}
    </div>
  )
}

export default function VendorsTab({ emptyVendorForm, formatMoney }) {
  const [vendors, setVendors] = useState([])
  const [form, setForm] = useState(() => ({
    ...emptyVendorForm,
    permissions: defaultVendorPermissions(),
  }))
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = () => dashboardApi('/api/admin/vendors').then((d) => setVendors(d.vendors))

  useEffect(() => {
    load().catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi('/api/admin/vendors', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          commissionRate: Number(form.commissionRate),
          permissions: normalizeVendorPermissions(form.permissions),
        }),
      })
      setForm({ ...emptyVendorForm, permissions: defaultVendorPermissions() })
      setShowForm(false)
      await load()
      setStatus('Vendor created')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (vendor) => {
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi(`/api/admin/vendors/${vendor.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !vendor.active }),
      })
      await load()
      setStatus(vendor.active ? 'Vendor deactivated' : 'Vendor activated')
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openAccessEditor = (vendor) => {
    setEditingId(vendor.id)
    setEditForm({
      name: vendor.name,
      slug: vendor.slug,
      email: vendor.email,
      commissionRate: vendor.commissionRate,
      active: vendor.active,
      permissions: normalizeVendorPermissions(vendor.permissions),
    })
    setStatus('')
  }

  const saveAccess = async (e) => {
    e.preventDefault()
    if (!editingId || !editForm) return
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi(`/api/admin/vendors/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name,
          slug: editForm.slug,
          email: editForm.email,
          commissionRate: Number(editForm.commissionRate),
          active: editForm.active,
          permissions: normalizeVendorPermissions(editForm.permissions),
        }),
      })
      setEditingId(null)
      setEditForm(null)
      await load()
      setStatus('Vendor access updated')
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
          <h2 className="text-2xl font-bold">Vendors</h2>
          <p className="text-sm text-slate-500">Manage marketplace sellers, commissions, and portal access</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
        >
          <Plus size={16} /> Add vendor
        </button>
      </div>

      {showForm ? (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-dashed border-slate-300 p-5 dark:border-white/10">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['name', 'Store name'],
              ['slug', 'Slug'],
              ['email', 'Email'],
              ['password', 'Login password'],
              ['commissionRate', 'Platform fee %'],
            ].map(([key, label]) => (
              <label key={key}>
                <span className="mb-1 block text-xs font-medium">{label}</span>
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                  required={key !== 'password'}
                />
              </label>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Portal access</p>
            <PermissionEditor
              permissions={form.permissions}
              onChange={(permissions) => setForm({ ...form, permissions })}
            />
          </div>
          <div className="flex gap-2">
            <button disabled={loading} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : 'Create vendor'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 space-y-4">
        {vendors.map((v) => (
          <div key={v.id} className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{v.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {v.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {v.email} • {v.slug} • {v.commissionRate}% fee
                </p>
                <AccessChips permissions={v.permissions} />
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span>{v.stats?.productCount ?? 0} products</span>
                  <span>{v.stats?.orderCount ?? 0} orders</span>
                  <span>{formatMoney(v.stats?.grossRevenue)} sales</span>
                  <span>{formatMoney(v.stats?.vendorEarnings)} earned</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openAccessEditor(v)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                >
                  <Shield size={14} /> Access
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(v)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                >
                  {v.active ? (
                    <>
                      <X size={14} className="inline" /> Deactivate
                    </>
                  ) : (
                    <>
                      <Check size={14} className="inline" /> Activate
                    </>
                  )}
                </button>
              </div>
            </div>

            {editingId === v.id && editForm ? (
              <form onSubmit={saveAccess} className="mt-5 space-y-4 border-t border-slate-100 pt-5 dark:border-white/5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['name', 'Store name'],
                    ['slug', 'Slug'],
                    ['email', 'Email'],
                    ['commissionRate', 'Platform fee %'],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <span className="mb-1 block text-xs font-medium">{label}</span>
                      <input
                        value={editForm[key]}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                        required
                      />
                    </label>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Portal access</p>
                  <PermissionEditor
                    permissions={editForm.permissions}
                    onChange={(permissions) => setEditForm({ ...editForm, permissions })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {loading ? <LoaderCircle className="animate-spin" size={16} /> : 'Save access'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setEditForm(null)
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        ))}
        {vendors.length === 0 ? <p className="text-sm text-slate-500">No vendors yet.</p> : null}
      </div>
      {status ? <p className="mt-4 text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
