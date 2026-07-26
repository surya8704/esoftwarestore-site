/**
 * Refresh product descriptions + shipping bullets in MongoDB from the
 * (re-fetched) esoftwarestore catalog JSON.
 *
 * Usage: node scripts/refresh-product-descriptions.js
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { loadCatalog } from '../src/data/loadCatalog.js'
import { Product } from '../src/db/models.js'

const uri = process.env.DATABASE_URL || process.env.MONGODB_URI
if (!uri) {
  console.error('DATABASE_URL / MONGODB_URI is required')
  process.exit(1)
}

await mongoose.connect(uri)
const catalog = loadCatalog()
let updated = 0
let skipped = 0

for (const item of catalog) {
  const description = String(item.description || '').trim()
  if (!description) {
    skipped += 1
    continue
  }

  const bullets = Array.isArray(item.shippingBullets)
    ? item.shippingBullets.map((b) => String(b || '').trim()).filter(Boolean)
    : []

  const result = await Product.updateOne(
    { slug: item.slug },
    {
      $set: {
        description,
        ...(bullets.length ? { shippingBullets: bullets } : {}),
      },
    },
  )

  if (result.matchedCount) updated += 1
  else skipped += 1
}

console.log(`Updated ${updated} products (${skipped} skipped/missing)`)
await mongoose.disconnect()
process.exit(0)
