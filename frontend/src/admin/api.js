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
  if (!response.ok) {
    const msg =
      data.message ??
      data.error?.message ??
      (typeof data.error === 'string' ? data.error : null) ??
      'Request failed'
    throw new Error(msg)
  }
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

export function formatMoney(amount, currency = 'INR') {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }
  const symbol = symbols[currency] ?? `${currency} `
  return `${symbol}${Number(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export const emptyProductForm = {
  name: '',
  slug: '',
  category: 'Windows',
  productType: 'standard',
  bundleItems: [],
  price: 1999,
  originalPrice: 4999,
  rating: 4.8,
  stock: 10,
  licenseType: 'Lifetime',
  imageUrl: '',
  visualAccent: 'from-sky-500 to-cyan-400',
  description: '',
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
