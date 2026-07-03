import { useEffect, useState } from 'react'
import { Check, LoaderCircle, Plus, X } from 'lucide-react'
import { dashboardApi } from '../api'

export default function VendorsTab({ emptyVendorForm, formatMoney }) {
  const [vendors, setVendors] = useState([])
  const [form, setForm] = useState(emptyVendorForm)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = () => dashboardApi('/api/admin/vendors').then((d) => setVendors(d.vendors))

  useEffect(() => { load().catch(() => {}) }, [])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      await dashboardApi('/api/admin/vendors', { method: 'POST', body: JSON.stringify(form) })
      setForm(emptyVendorForm)
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
    await dashboardApi(`/api/admin/vendors/${vendor.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: vendor.name,
        slug: vendor.slug,
        email: vendor.email,
        commissionRate: vendor.commissionRate,
        active: !vendor.active,
      }),
    })
    await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Vendors</h2>
          <p className="text-sm text-slate-500">Manage marketplace sellers and commissions</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
          <Plus size={16} /> Add vendor
        </button>
      </div>

      {showForm ? (
        <form onSubmit={submit} className="mt-6 grid gap-3 rounded-2xl border border-dashed border-slate-300 p-5 dark:border-white/10 sm:grid-cols-2">
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
              />
            </label>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={loading} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : 'Create vendor'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm dark:border-white/10">Cancel</button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 space-y-4">
        {vendors.map((v) => (
          <div key={v.id} className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{v.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {v.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{v.email} • {v.slug} • {v.commissionRate}% fee</p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span>{v.stats?.productCount ?? 0} products</span>
                  <span>{v.stats?.orderCount ?? 0} orders</span>
                  <span>{formatMoney(v.stats?.grossRevenue)} sales</span>
                  <span>{formatMoney(v.stats?.vendorEarnings)} earned</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => toggleActive(v)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10">
                  {v.active ? <><X size={14} className="inline" /> Deactivate</> : <><Check size={14} className="inline" /> Activate</>}
                </button>
              </div>
            </div>
          </div>
        ))}
        {vendors.length === 0 ? <p className="text-sm text-slate-500">No vendors yet.</p> : null}
      </div>
      {status ? <p className="mt-4 text-sm text-slate-500">{status}</p> : null}
    </div>
  )
}
