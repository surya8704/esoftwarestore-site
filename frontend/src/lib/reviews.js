/**
 * Client-side mirror of backend review generation for instant product UI.
 * Keep in sync with backend/src/lib/productReviews.js core hashing.
 */

function hashString(value) {
  let hash = 2166136261
  const str = String(value ?? '')
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function reviewCountForProduct(product) {
  const key = String(product?.id ?? product?.slug ?? product?.name ?? 'product')
  return 24 + (hashString(key) % 161)
}

export function averageRatingForProduct(product) {
  const value = Number(product?.rating)
  if (!Number.isFinite(value) || value <= 0) return 4.7
  return Math.min(5, Math.max(3.8, value))
}
