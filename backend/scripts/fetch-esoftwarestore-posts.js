import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_BACKEND = path.join(__dirname, '../src/data/esoftwarestore-guides.json')
const OUT_FRONTEND = path.join(__dirname, '../../frontend/public/guides.json')
const BASE = 'https://www.esoftwarestore.com/wp-json/wp/v2/posts'

function stripHtml(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeContent(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
}

function decodeTitle(html = '') {
  return stripHtml(html)
}

function mapCategoryNames(embeddedTerms = []) {
  return embeddedTerms
    .filter((term) => term.taxonomy === 'category')
    .map((term) => term.name)
    .filter(Boolean)
}

function mapCategorySlugs(embeddedTerms = []) {
  return embeddedTerms
    .filter((term) => term.taxonomy === 'category')
    .map((term) => term.slug)
    .filter(Boolean)
}

function transform(post) {
  const featured = post._embedded?.['wp:featuredmedia']?.[0]
  const terms = post._embedded?.['wp:term']?.flat?.() ?? post._embedded?.['wp:term'] ?? []
  const flatTerms = Array.isArray(terms[0]) ? terms.flat() : terms

  return {
    externalId: post.id,
    slug: post.slug,
    title: decodeTitle(post.title?.rendered ?? ''),
    excerpt: stripHtml(post.excerpt?.rendered ?? '').slice(0, 320),
    contentHtml: sanitizeContent(post.content?.rendered ?? ''),
    publishedAt: post.date,
    modifiedAt: post.modified,
    imageUrl: featured?.source_url ?? null,
    categories: mapCategoryNames(flatTerms),
    categorySlugs: mapCategorySlugs(flatTerms),
    sourceUrl: post.link,
  }
}

async function fetchWithRetry(url, options = {}, attempts = 5) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 800))
      }
    }
  }
  throw lastError
}

async function fetchPage(page, perPage = 100) {
  const url = `${BASE}?per_page=${perPage}&page=${page}&_embed=1`
  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; eSoftwareStore-Guides-Importer/1.0)',
      Accept: 'application/json',
    },
  })
  if (response.status === 400) return []
  if (!response.ok) throw new Error(`Page ${page} failed: ${response.status}`)
  return response.json()
}

async function fetchAll() {
  const all = []
  for (let page = 1; page <= 20; page += 1) {
    const batch = await fetchPage(page)
    if (!batch.length) break
    all.push(...batch)
    process.stdout.write(`Fetched page ${page}: ${batch.length} guides (${all.length} total)\n`)
    if (batch.length < 100) break
  }

  const guides = all.map(transform)
  const payload = { guides, fetchedAt: new Date().toISOString() }

  fs.mkdirSync(path.dirname(OUT_BACKEND), { recursive: true })
  fs.mkdirSync(path.dirname(OUT_FRONTEND), { recursive: true })
  fs.writeFileSync(OUT_BACKEND, JSON.stringify(guides, null, 2))
  fs.writeFileSync(OUT_FRONTEND, JSON.stringify(payload, null, 2))
  process.stdout.write(`Saved ${guides.length} guides → ${OUT_BACKEND}\n`)
  process.stdout.write(`Saved ${guides.length} guides → ${OUT_FRONTEND}\n`)
  return guides.length
}

try {
  await fetchAll()
} catch (error) {
  const detail = error.cause?.message ?? error.message
  process.stderr.write(`${detail}\n`)
  process.exit(1)
}
