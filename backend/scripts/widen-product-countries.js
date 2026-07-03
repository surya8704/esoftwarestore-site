import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { config } from '../src/config.js'

dotenv.config()

const url = config.mongoUrl
await mongoose.connect(url)
const result = await mongoose.connection.collection('products').updateMany(
  {},
  { $unset: { allowedCountries: '' } },
)
console.log(`Cleared allowedCountries on ${result.modifiedCount} products`)

const response = await fetch('http://localhost:4000/api/products', {
  headers: {
    'X-Country': 'AU',
    'X-Currency': 'AUD',
    'X-Session-Id': 'migration-test',
  },
})
const data = await response.json()
console.log(`AU product count: ${data.products?.length ?? 0}`)

await mongoose.disconnect()
