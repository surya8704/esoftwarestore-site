import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../src/data/esoftwarestore-catalog.json')
const BASE = 'https://www.esoftwarestore.com/wp-json/wc/store/v1/products'

const ACCENTS = [
  'from-sky-500 to-cyan-400',
  'from-blue-600 to-indigo-500',
  'from-emerald-500 to-teal-400',
  'from-violet-500 to-fuchsia-400',
  'from-amber-500 to-orange-400',
  'from-rose-500 to-pink-400',
]

function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function toRupees(minor) {
  return Math.max(1, Math.round(Number(minor) / 100))
}

function mapCategory(name = 'Software') {
  const n = name.toLowerCase()
  if (n.includes('windows') || n.includes('microsoft')) return 'Windows'
  if (n.includes('office')) return 'Microsoft Office'
  if (n.includes('antivirus') || n.includes('security') || n.includes('mcafee') || n.includes('kaspersky')) return 'Antivirus'
  if (n.includes('autodesk') || n.includes('adobe') || n.includes('corel')) return 'Design'
  if (n.includes('server') || n.includes('sql')) return 'Server'
  return name || 'Software'
}

function inferLicenseType(name = '') {
  const n = name.toLowerCase()
  if (n.includes('1 year') || n.includes('365') || n.includes('subscription')) return '1 Year'
  if (n.includes('mak') || n.includes('volume')) return 'Volume'
  return 'Lifetime'
}

function transform(product, index) {
  const prices = product.prices ?? {}
  const price = toRupees(prices.sale_price || prices.price)
  const regular = toRupees(prices.regular_price)
  const originalPrice = regular > price ? regular : Math.round(price * 1.35)
  const category = mapCategory(product.categories?.[0]?.name)
  const description = stripHtml(product.short_description || product.description).slice(0, 1000)

  return {
    externalId: product.id,
    slug: product.slug,
    name: product.name.trim(),
    category,
    price,
    originalPrice,
    rating: Math.round(Number(product.average_rating || 4.5) * 10) || 45,
    stock: product.is_in_stock === false ? 0 : Math.max(1, Number(product.low_stock_remaining) || 15),
    licenseType: inferLicenseType(product.name),
    imageUrl: product.images?.[0]?.src ?? null,
    visualAccent: ACCENTS[index % ACCENTS.length],
    description: description || product.name,
    downloadUrl: product.permalink,
    sku: product.sku || null,
    onSale: Boolean(product.on_sale),
  }
}

async function fetchPage(page, perPage = 100) {
  const url = `${BASE}?per_page=${perPage}&page=${page}`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'eSoftwareStore-Importer/1.0' },
  })
  if (!response.ok) throw new Error(`Page ${page} failed: ${response.status}`)
  return response.json()
}

async function fetchAll() {
  const all = []
  for (let page = 1; page <= 20; page += 1) {
    const batch = await fetchPage(page)
    if (!batch.length) break
    all.push(...batch)
    process.stdout.write(`Fetched page ${page}: ${batch.length} products (${all.length} total)\n`)
    if (batch.length < 100) break
  }

  const unique = [...new Map(all.map((p) => [p.slug, p])).values()]
  const catalog = unique.map(transform)
  fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2))
  process.stdout.write(`Saved ${catalog.length} products → ${OUT}\n`)
  return catalog.length
}

const agentDir = path.join(process.env.USERPROFILE ?? '', '.cursor/projects/c-Users-shiva-esoftwarestore-site/agent-tools')
const localPages = [
  '5476b3d6-b5d3-44ce-ae2a-51c5a28290ad.txt',
  'f6566a4f-ed4e-4bb5-b1e3-7cc7378d5f75.txt',
]

function importFromCachedFiles() {
  const all = []
  for (const file of localPages) {
    const filePath = path.join(agentDir, file)
    if (!fs.existsSync(filePath)) continue
    all.push(...JSON.parse(fs.readFileSync(filePath, 'utf8')))
  }
  if (!all.length) return false
  const unique = [...new Map(all.map((p) => [p.slug, p])).values()]
  const catalog = unique.map(transform)
  fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2))
  process.stdout.write(`Imported ${catalog.length} products from cache → ${OUT}\n`)
  return true
}

try {
  const ok = await fetchAll().catch(() => null)
  if (!ok) {
    if (!importFromCachedFiles()) {
      process.stderr.write('Could not fetch products online or from cache.\n')
      process.exit(1)
    }
  }
} catch (error) {
  if (!importFromCachedFiles()) throw error
}
