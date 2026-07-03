const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export async function dashboardApi(path, options = {}) {
  const token = localStorage.getItem('dashboardToken')
  const hasBody = options.body !== undefined && options.body !== null && options.body !== ''
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }
  if (hasBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error(data.message ?? data.error ?? 'Request failed')
  return data
}

export async function uploadProductImage(file) {
  const token = localStorage.getItem('dashboardToken')
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch(`${API_BASE}/api/upload/product-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error(data.message ?? data.error ?? 'Image upload failed')
  return data
}

export function formatMoney(amount) {
  return `₹${Number(amount ?? 0).toLocaleString()}`
}

export const emptyProductForm = {
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
  vendorId: '',
}

export const emptyVendorForm = {
  name: '',
  slug: '',
  email: '',
  commissionRate: 15,
  password: 'Vendor@123',
}
