import { api, getApiRegion } from './api'
import catalogData from '../../public/catalog.json'

const STATIC_KEY = 'catalogStatic'
const bundledProducts = catalogData.products ?? []
const cacheKey = (country, currency) => `products:${country}:${currency}`

function readJson(key) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota */
  }
}

/** Instant products for first paint — session cache or static catalog */
export function getInstantProducts() {
  const { country, currency } = getApiRegion()
  const regional = readJson(cacheKey(country, currency))
  if (regional?.length) return regional

  const staticCatalog = readJson(STATIC_KEY)
  if (staticCatalog?.length) return staticCatalog

  return bundledProducts
}

export function cacheProducts(products, country, currency) {
  if (!products?.length) return
  writeJson(cacheKey(country, currency), products)
}

export async function prefetchStaticCatalog() {
  if (readJson(STATIC_KEY)?.length) return readJson(STATIC_KEY)
  try {
    const response = await fetch('/catalog.json')
    if (!response.ok) return []
    const data = await response.json()
    const products = data.products ?? []
    writeJson(STATIC_KEY, products)
    return products
  } catch {
    return []
  }
}

/** Load from cache/static immediately, then refresh from API */
export async function loadProducts({ country, currency, locale }, onUpdate) {
  const instant = getInstantProducts()
  if (instant.length) onUpdate(instant, 'instant')

  if (!instant.length) {
    const staticProducts = await prefetchStaticCatalog()
    if (staticProducts.length) onUpdate(staticProducts, 'static')
  }

  try {
    const data = await api('/api/products')
    cacheProducts(data.products, country, currency)
    onUpdate(data.products, 'api')
    return data.products
  } catch {
    return instant
  }
}

export function findProductBySlug(slug) {
  const products = getInstantProducts()
  return products.find((p) => p.slug === slug) ?? bundledProducts.find((p) => p.slug === slug) ?? null
}
