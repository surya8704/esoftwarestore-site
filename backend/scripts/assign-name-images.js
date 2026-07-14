import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Product } from '../src/db/models.js'
import { getProductImageByName, isLegacyBrokenMediaUrl } from '../src/lib/productImages.js'
import { config } from '../src/config.js'

dotenv.config()

await mongoose.connect(config.mongoUrl)

const products = await Product.find()
let updated = 0

for (const product of products) {
  const nextUrl = getProductImageByName(product)
  if (!nextUrl) continue
  if (product.imageUrl === nextUrl) continue
  if (product.imageUrl && !isLegacyBrokenMediaUrl(product.imageUrl)) {
    // Keep manually uploaded / custom working images
    continue
  }
  product.imageUrl = nextUrl
  await product.save()
  updated += 1
}

console.log(`Updated ${updated} / ${products.length} product images based on name`)
await mongoose.disconnect()
