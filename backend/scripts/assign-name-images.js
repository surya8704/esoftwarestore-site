import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Product } from '../src/db/models.js'
import { productCoverApiUrl, isLegacyBrokenMediaUrl } from '../src/lib/productImages.js'
import { config } from '../src/config.js'

dotenv.config()

await mongoose.connect(config.mongoUrl)

const products = await Product.find()
let updated = 0

for (const product of products) {
  const nextUrl = productCoverApiUrl(product, config.apiPublicUrl)
  const current = product.imageUrl || ''
  const shouldReplace =
    !current ||
    isLegacyBrokenMediaUrl(current) ||
    current.includes('images.unsplash.com') ||
    current.includes('/api/media/product-cover') ||
    current.includes('/wp-content/')

  if (!shouldReplace) continue
  if (current === nextUrl) continue

  product.imageUrl = nextUrl
  await product.save()
  updated += 1
}

console.log(`Updated ${updated} / ${products.length} products with branded covers`)
await mongoose.disconnect()
