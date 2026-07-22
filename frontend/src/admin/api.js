import { productCoverApiUrl } from '../lib/productImages.js'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

function readApiErrorMessage(data, fallback = 'Request failed') {
  if (!data || typeof data !== 'object') return fallback
  if (typeof data.message === 'string' && data.message.trim()) return data.message
  if (typeof data.error === 'string' && data.error.trim()) return data.error
  if (data.error && typeof data.error === 'object') {
    if (typeof data.error.message === 'string' && data.error.message.trim()) return data.error.message
    if (typeof data.error.description === 'string' && data.error.description.trim()) return data.error.description
  }
  if (Array.isArray(data.message)) {
    return data.message.map((item) => (typeof item === 'string' ? item : item?.message)).filter(Boolean).join('; ') || fallback
  }
  try {
    return JSON.stringify(data)
  } catch {
    return fallback
  }
}

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
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    if (!response.ok) throw new Error(text?.slice(0, 200) || 'Request failed')
    throw new Error('Invalid response from server')
  }
  if (!response.ok) {
    throw new Error(readApiErrorMessage(data))
  }
  return data
}

export function productCoverPreviewUrl(product) {
  return productCoverApiUrl(product, API_BASE)
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

export async function uploadGuideImage(file) {
  const token = localStorage.getItem('dashboardToken')
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch(`${API_BASE}/api/upload/guide-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error(data.message ?? data.error ?? 'Image upload failed')
  return data
}

export async function uploadTrustBadgeImage(file) {
  const token = localStorage.getItem('dashboardToken')
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch(`${API_BASE}/api/upload/trust-badge-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error(data.message ?? data.error ?? 'Badge upload failed')
  return data
}

export async function uploadProductLicenseKeys(productId, file) {
  const token = localStorage.getItem('dashboardToken')
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/api/admin/products/${productId}/license-keys/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error(data.message ?? data.error ?? 'License key import failed')
  return data
}

export function formatMoney(amount, currency = 'USD') {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', CAD: 'C$', AUD: 'A$' }
  const symbol = symbols[currency] ?? `${currency} `
  return `${symbol}${Number(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export const emptyProductForm = {
  name: '',
  slug: '',
  category: 'Windows',
  productType: 'standard',
  bundleItems: [],
  price: 29,
  originalPrice: 79,
  rating: 4.8,
  stock: 10,
  licenseType: 'Lifetime',
  imageUrl: '',
  visualAccent: 'from-sky-500 to-cyan-400',
  description: '',
  shippingTitle: '',
  shippingBullets: [''],
  vendorId: '',
  allowedCountries: [],
  blockedCountries: [],
}

export const emptyVendorForm = {
  name: '',
  slug: '',
  email: '',
  commissionRate: 15,
  password: 'Vendor@123',
  permissions: {
    canManageProducts: true,
    canEditPrices: true,
    canViewOrders: true,
    canViewLicenseKeys: true,
    canManagePayouts: true,
    canUploadImages: true,
  },
}

export const emptyUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'customer',
}

export const emptyCouponForm = {
  code: '',
  prefix: 'SAVE',
  discountType: 'percent',
  discountValue: 10,
  minAmount: 0,
  maxUses: '',
  expiresAt: '',
  active: true,
  generateCount: 1,
  countryCodes: [],
  productIds: [],
}
