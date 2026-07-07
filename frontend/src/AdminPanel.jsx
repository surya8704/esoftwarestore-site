import { useEffect, useState } from 'react'
import {
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  UserCog,
} from 'lucide-react'

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

const emptyForm = {
  name: '',
  slug: '',
  category: 'Windows',
  price: 1999,
  originalPrice: 4999,
  rating: 4.8,
  stock: 10,
  licenseType: 'Lifetime',
  imageUrl: '',
  visualAccent: 'from-sky-500 to-cyan-400',
  description: '',
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed')
  }

  return data
}

export default function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') ?? '')
  const [user, setUser] = useState(null)
  const [products, setProducts] = useState([])
  const [authForm, setAuthForm] = useState({ email: 'info@esoftwarestore.com', password: '' })
  const [productForm, setProductForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const isAdmin = user?.role === 'admin'

  const loadProducts = async (currentToken) => {
    const data = await apiRequest('/api/admin/products', {
      headers: { Authorization: `Bearer ${currentToken}` },
    })
    setProducts(data.products)
  }

  useEffect(() => {
    if (!token) return

    let cancelled = false

    const loadSession = async () => {
      try {
        const [meData, productData] = await Promise.all([
          apiRequest('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          apiRequest('/api/admin/products', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (cancelled) return
        setUser(meData.user)
        setProducts(productData.products)
      } catch {
        if (cancelled) return
        localStorage.removeItem('adminToken')
        setToken('')
        setUser(null)
        setStatus('Admin session expired. Please sign in again.')
      }
    }

    loadSession()
    return () => {
      cancelled = true
    }
  }, [token])

  const resetForm = () => {
    setEditingId(null)
    setProductForm(emptyForm)
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setStatus('')

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(authForm),
      })

      if (data.user.role !== 'admin') {
        throw new Error('This account does not have admin access')
      }

      localStorage.setItem('adminToken', data.token)
      setToken(data.token)
      setUser(data.user)
      await loadProducts(data.token)
      setStatus('Admin signed in successfully')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!token) return

    setLoading(true)
    setStatus(editingId ? 'Updating product...' : 'Creating product...')
    try {
      const path = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products'
      const method = editingId ? 'PUT' : 'POST'

      await apiRequest(path, {
        method,
        body: JSON.stringify(productForm),
        headers: { Authorization: `Bearer ${token}` },
      })

      await loadProducts(token)
      resetForm()
      setStatus(editingId ? 'Product updated successfully' : 'Product created successfully')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (product) => {
    setEditingId(product.id)
    setProductForm({
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
    })
  }

  const handleDelete = async (productId) => {
    if (!token) return

    setLoading(true)
    setStatus('Deleting product...')
    try {
      await apiRequest(`/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      await loadProducts(token)
      if (editingId === productId) resetForm()
      setStatus('Product deleted successfully')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    setToken('')
    setUser(null)
    setProducts([])
    resetForm()
    setStatus('Logged out')
  }

  return (
    <section id="admin" className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-3 text-white dark:bg-white dark:text-slate-950">
              <UserCog size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-600 dark:text-sky-300">Admin Access</p>
              <h2 className="mt-2 text-3xl font-semibold">Role-protected product management</h2>
            </div>
          </div>

          {!isAdmin ? (
            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Admin email</span>
                <input
                  value={authForm.email}
                  onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <button className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
                {loading ? <LoaderCircle className="animate-spin" size={16} /> : <LockKeyhole size={16} />}
                Sign in as admin
              </button>
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-400">
                Seeded admin email: `info@esoftwarestore.com`
              </p>
            </form>
          ) : (
            <div className="mt-8 space-y-4">
              <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5">
                <p className="font-semibold">{user.name}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user.email} • {user.role}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => loadProducts(token)}
                  className="flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-white/10"
                >
                  <RefreshCcw size={16} />
                  Refresh products
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          {status ? <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{status}</p> : null}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-600 dark:text-sky-300">Admin UI</p>
              <h3 className="mt-2 text-3xl font-semibold">Add, edit, and publish products</h3>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"
            >
              New Product
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              ['name', 'Name'],
              ['slug', 'Slug'],
              ['category', 'Category'],
              ['licenseType', 'License Type'],
              ['price', 'Price'],
              ['originalPrice', 'Original Price'],
              ['rating', 'Rating'],
              ['stock', 'Stock'],
              ['imageUrl', 'Product Image URL'],
              ['visualAccent', 'Gradient Accent'],
            ].map(([key, label]) => (
              <label key={key} className={key === 'imageUrl' || key === 'visualAccent' ? 'md:col-span-2' : ''}>
                <span className="mb-2 block text-sm font-medium">{label}</span>
                <input
                  value={productForm[key]}
                  onChange={(event) => setProductForm((current) => ({ ...current, [key]: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                  disabled={!isAdmin}
                />
              </label>
            ))}
            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-medium">Description</span>
              <textarea
                value={productForm.description}
                onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/5"
                disabled={!isAdmin}
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                disabled={!isAdmin || loading}
                className="flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
              >
                {loading ? <LoaderCircle className="animate-spin" size={16} /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}
                {editingId ? 'Update Product' : 'Create Product'}
              </button>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={resetForm}
                className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
              >
                Clear
              </button>
            </div>
          </form>

          <div className="mt-10 grid gap-4">
            {products.map((product) => (
              <div key={product.id} className="rounded-3xl border border-slate-200 p-5 dark:border-white/10">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${product.visualAccent ?? 'from-sky-500 to-cyan-400'} text-white`}>
                      {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <KeyRound size={18} />}
                    </div>
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {product.category} • {product.licenseType} • Rs. {product.price}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(product)}
                      disabled={!isAdmin}
                      className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
                    >
                      <Pencil size={16} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id)}
                      disabled={!isAdmin || loading}
                      className="flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {isAdmin && products.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                No products found yet. Create your first one above.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
