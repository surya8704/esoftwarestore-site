export const VENDOR_PERMISSION_KEYS = [
  'canManageProducts',
  'canEditPrices',
  'canViewOrders',
  'canViewLicenseKeys',
  'canManagePayouts',
  'canUploadImages',
]

export const VENDOR_PERMISSION_LABELS = {
  canManageProducts: 'Manage products',
  canEditPrices: 'Edit product prices',
  canViewOrders: 'View orders',
  canViewLicenseKeys: 'View license keys',
  canManagePayouts: 'Manage payouts',
  canUploadImages: 'Upload images',
}

export const VENDOR_PERMISSION_HINTS = {
  canManageProducts: 'Create, edit, and delete their own products',
  canEditPrices: 'Change price / original price on products',
  canViewOrders: 'See orders for their products',
  canViewLicenseKeys: 'See delivered license keys on orders',
  canManagePayouts: 'View balance and request withdrawals',
  canUploadImages: 'Upload product images',
}

export function defaultVendorPermissions() {
  return {
    canManageProducts: true,
    canEditPrices: true,
    canViewOrders: true,
    canViewLicenseKeys: true,
    canManagePayouts: true,
    canUploadImages: true,
  }
}

export function normalizeVendorPermissions(raw) {
  const defaults = defaultVendorPermissions()
  const source = raw && typeof raw === 'object' ? raw : {}
  const next = { ...defaults }
  for (const key of VENDOR_PERMISSION_KEYS) {
    if (typeof source[key] === 'boolean') next[key] = source[key]
  }
  // Viewing keys requires viewing orders
  if (!next.canViewOrders) next.canViewLicenseKeys = false
  // Editing prices requires managing products
  if (!next.canManageProducts) {
    next.canEditPrices = false
    next.canUploadImages = false
  }
  return next
}

export function vendorHasPermission(vendorOrPermissions, key) {
  const permissions = normalizeVendorPermissions(
    vendorOrPermissions?.permissions ?? vendorOrPermissions,
  )
  return Boolean(permissions[key])
}
