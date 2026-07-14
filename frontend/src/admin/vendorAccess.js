export const VENDOR_PERMISSION_KEYS = [
  'canManageProducts',
  'canEditPrices',
  'canViewOrders',
  'canViewLicenseKeys',
  'canManagePayouts',
  'canUploadImages',
]

export const VENDOR_PERMISSION_META = {
  canManageProducts: {
    label: 'Manage products',
    hint: 'Create, edit, and delete their products',
  },
  canEditPrices: {
    label: 'Edit prices',
    hint: 'Change product prices',
  },
  canViewOrders: {
    label: 'View orders',
    hint: 'See orders for their products',
  },
  canViewLicenseKeys: {
    label: 'View license keys',
    hint: 'See delivered license keys',
  },
  canManagePayouts: {
    label: 'Manage payouts',
    hint: 'View balance and request withdrawals',
  },
  canUploadImages: {
    label: 'Upload images',
    hint: 'Upload product cover images',
  },
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
  if (!next.canViewOrders) next.canViewLicenseKeys = false
  if (!next.canManageProducts) {
    next.canEditPrices = false
    next.canUploadImages = false
  }
  return next
}
