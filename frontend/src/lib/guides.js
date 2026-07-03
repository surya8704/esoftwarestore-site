import { api } from './api'
import guidesData from '../../public/guides.json'

const bundledGuides = guidesData.guides ?? guidesData ?? []
const STATIC_KEY = 'guidesStatic'

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

export function getInstantGuides() {
  const cached = readJson(STATIC_KEY)
  if (cached?.length) return cached
  return bundledGuides
}

export async function prefetchStaticGuides() {
  if (readJson(STATIC_KEY)?.length) return readJson(STATIC_KEY)
  try {
    const response = await fetch('/guides.json')
    if (!response.ok) return bundledGuides
    const data = await response.json()
    const guides = data.guides ?? data
    writeJson(STATIC_KEY, guides)
    return guides
  } catch {
    return bundledGuides
  }
}

export async function loadGuidesList({ category, q, page } = {}, onUpdate) {
  const instant = getInstantGuides()
  if (instant.length && onUpdate) onUpdate(instant, 'instant')

  try {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (q) params.set('q', q)
    if (page) params.set('page', String(page))
    const query = params.toString()
    const data = await api(`/api/guides${query ? `?${query}` : ''}`)
    if (data.guides?.length) {
      writeJson(STATIC_KEY, data.guides)
      onUpdate?.(data.guides, 'api')
    }
    return data
  } catch {
    let filtered = [...instant]
    if (category) {
      const cat = category.toLowerCase()
      filtered = filtered.filter(
        (g) =>
          g.categorySlugs?.some((s) => s.toLowerCase() === cat) ||
          g.categories?.some((c) => c.toLowerCase().replace(/\s+/g, '-') === cat),
      )
    }
    if (q) {
      const term = q.toLowerCase()
      filtered = filtered.filter(
        (g) => g.title?.toLowerCase().includes(term) || g.excerpt?.toLowerCase().includes(term),
      )
    }
    return { guides: filtered, total: filtered.length, page: 1, totalPages: 1 }
  }
}

export function findGuideBySlug(slug) {
  return getInstantGuides().find((g) => g.slug === slug) ?? bundledGuides.find((g) => g.slug === slug) ?? null
}
