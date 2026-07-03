import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { loadCatalog } from '../src/data/loadCatalog.js'
import { db } from '../src/db/client.js'
import { productVariants, products } from '../src/db/schema.js'
import { seedLicensePool } from '../src/services/license.js'

function toRow(product) {
  const rating = product.rating > 0 ? product.rating : 45
  return {
    slug: product.slug,
    name: product.name,
    category: product.category,
    price: product.price,
    originalPrice: product.originalPrice,
    rating,
    stock: product.stock ?? 10,
    licenseType: product.licenseType ?? 'Lifetime',
    imageUrl: product.imageUrl,
    visualAccent: product.visualAccent ?? 'from-sky-500 to-cyan-400',
    description: product.description,
    downloadUrl: product.downloadUrl ?? null,
    active: true,
  }
}

async function upsertProduct(product) {
  const row = toRow(product)
  const existing = await db.select().from(products).where(eq(products.slug, product.slug))
  if (existing[0]) {
    await db.update(products).set(row).where(eq(products.id, existing[0].id))
    return { action: 'updated', id: existing[0].id }
  }

  const inserted = await db.insert(products).values(row).$returningId()
  const productId = inserted[0].id

  await db.insert(productVariants).values({
    productId,
    name: 'Standard',
    sku: `${product.slug}-std`,
    price: row.price,
    originalPrice: row.originalPrice,
    stock: row.stock,
    tierMinQty: 1,
    tierLabel: '1 License',
    isDefault: true,
  })

  await seedLicensePool(productId, 5)
  return { action: 'created', id: productId }
}

const catalog = loadCatalog()
let created = 0
let updated = 0

for (const product of catalog) {
  const result = await upsertProduct(product)
  if (result.action === 'created') created += 1
  else updated += 1
}

console.log(`Imported ${catalog.length} products (${created} created, ${updated} updated)`)
process.exit(0)
