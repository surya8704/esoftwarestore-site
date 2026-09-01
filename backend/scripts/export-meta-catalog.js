/**
 * Export active products to a Meta (Facebook) catalog CSV for ads.
 *
 * Usage:
 *   node scripts/export-meta-catalog.js
 *   node scripts/export-meta-catalog.js --currency=USD --out=../exports/meta-product-catalog.csv
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Product, ProductVariant } from '../src/db/models.js'
import { config } from '../src/config.js'
import { buildMetaCatalogCsv } from '../src/services/feeds.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = ''] = arg.replace(/^--/, '').split('=')
    return [key, value]
  }),
)

const currency = (args.currency || 'USD').toUpperCase()
const outPath = path.resolve(
  __dirname,
  args.out || '../../exports/meta-product-catalog.csv',
)

await mongoose.connect(config.mongoUrl)

const products = await Product.find({ active: true }).sort({ name: 1 }).lean()
const variants = await ProductVariant.find({ active: { $ne: false } }).lean()
const variantsByProductId = new Map()
for (const variant of variants) {
  const key = String(variant.productId)
  if (!variantsByProductId.has(key)) variantsByProductId.set(key, [])
  variantsByProductId.get(key).push(variant)
}

const csv = buildMetaCatalogCsv(products, variantsByProductId, {
  currency,
  baseCurrency: config.catalogBaseCurrency || 'USD',
})

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, csv, 'utf8')

const frontendPublic = path.resolve(__dirname, '../../frontend/public/meta-product-catalog.csv')
const frontendApi = path.resolve(__dirname, '../../frontend/api/meta-product-catalog.csv')
fs.mkdirSync(path.dirname(frontendPublic), { recursive: true })
fs.writeFileSync(frontendPublic, csv, 'utf8')
fs.writeFileSync(frontendApi, csv, 'utf8')

const rowCount = csv.trim().split('\n').length - 1
console.log(`Exported ${rowCount} catalog rows (${products.length} products) to ${outPath}`)
console.log(`Currency: ${currency}`)

await mongoose.disconnect()
process.exit(0)
