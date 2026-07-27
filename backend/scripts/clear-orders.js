/**
 * Deletes all orders and related records.
 * Also releases license keys that were assigned to those orders.
 *
 * Usage: node scripts/clear-orders.js
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import {
  ConfirmationCode,
  LicenseKey,
  Order,
  OrderItem,
  OrderNote,
} from '../src/db/models.js'
import { config } from '../src/config.js'

dotenv.config()

await mongoose.connect(config.mongoUrl)

const orderCount = await Order.countDocuments()
const itemCount = await OrderItem.countDocuments()
const noteCount = await OrderNote.countDocuments()
const codeCount = await ConfirmationCode.countDocuments()
const assignedKeys = await LicenseKey.countDocuments({ orderId: { $ne: null } })

console.log('Before clear:')
console.log(`  Orders: ${orderCount}`)
console.log(`  Order items: ${itemCount}`)
console.log(`  Order notes: ${noteCount}`)
console.log(`  Confirmation codes: ${codeCount}`)
console.log(`  Assigned license keys: ${assignedKeys}`)

if (orderCount === 0 && itemCount === 0 && noteCount === 0 && codeCount === 0 && assignedKeys === 0) {
  console.log('Nothing to clear.')
  await mongoose.disconnect()
  process.exit(0)
}

const released = await LicenseKey.updateMany(
  { orderId: { $ne: null } },
  { $set: { status: 'available', orderId: null, assignedAt: null } },
)
const notes = await OrderNote.deleteMany({})
const codes = await ConfirmationCode.deleteMany({})
const items = await OrderItem.deleteMany({})
const orders = await Order.deleteMany({})

console.log('Cleared:')
console.log(`  Released license keys: ${released.modifiedCount}`)
console.log(`  Deleted order notes: ${notes.deletedCount}`)
console.log(`  Deleted confirmation codes: ${codes.deletedCount}`)
console.log(`  Deleted order items: ${items.deletedCount}`)
console.log(`  Deleted orders: ${orders.deletedCount}`)

await mongoose.disconnect()
console.log('Done.')
