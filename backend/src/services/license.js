import * as XLSX from 'xlsx'
import { LicenseKey, Order, OrderItem, Product } from '../db/models.js'
import { mapId } from '../db/client.js'
import { sendOrderDeliveryEmail } from './email.js'
import { sendOrderWhatsApp } from './whatsapp.js'

const KEY_HEADER_CANDIDATES = [
  'license_key',
  'licensekey',
  'license key',
  'product_key',
  'productkey',
  'product key',
  'activation_key',
  'activationkey',
  'activation key',
  'serial',
  'serial_key',
  'serialkey',
  'key',
  'keys',
  'code',
  'codes',
]

function normalizeKeyValue(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Atomically claim one available key for a product. Never invents keys.
 * Returns the key string, or null if the pool is empty.
 */
export async function assignLicenseKey({ productId, variantId, orderId }) {
  const updated = await LicenseKey.findOneAndUpdate(
    { productId, status: 'available' },
    {
      $set: {
        status: 'assigned',
        orderId,
        assignedAt: new Date(),
        ...(variantId ? { variantId } : {}),
      },
    },
    { sort: { createdAt: 1 }, new: true },
  )
  return updated?.licenseKey ?? null
}

export async function countAvailableKeys(productId) {
  return LicenseKey.countDocuments({ productId, status: 'available' })
}

export async function getLicensePoolStats(productId) {
  const [available, assigned, total] = await Promise.all([
    LicenseKey.countDocuments({ productId, status: 'available' }),
    LicenseKey.countDocuments({ productId, status: 'assigned' }),
    LicenseKey.countDocuments({ productId }),
  ])
  return { available, assigned, total }
}

export async function getLicensePoolStatsForProducts(productIds) {
  if (!productIds?.length) return {}
  const rows = await LicenseKey.aggregate([
    { $match: { productId: { $in: productIds } } },
    {
      $group: {
        _id: { productId: '$productId', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ])

  const map = {}
  for (const id of productIds) {
    map[String(id)] = { available: 0, assigned: 0, total: 0 }
  }
  for (const row of rows) {
    const id = String(row._id.productId)
    if (!map[id]) map[id] = { available: 0, assigned: 0, total: 0 }
    map[id].total += row.count
    if (row._id.status === 'available') map[id].available += row.count
    if (row._id.status === 'assigned') map[id].assigned += row.count
  }
  return map
}

function extractKeysFromRows(rows) {
  if (!rows.length) return []
  const headers = Object.keys(rows[0] ?? {}).map((h) => String(h).trim())
  const lowerHeaders = headers.map((h) => h.toLowerCase())
  let keyHeader = headers[0]
  for (const candidate of KEY_HEADER_CANDIDATES) {
    const idx = lowerHeaders.indexOf(candidate)
    if (idx >= 0) {
      keyHeader = headers[idx]
      break
    }
  }

  const keys = []
  const seen = new Set()
  for (const row of rows) {
    const raw = normalizeKeyValue(row[keyHeader] ?? Object.values(row)[0])
    if (!raw || raw.length < 4) continue
    // Skip header-looking values accidentally present as data
    if (KEY_HEADER_CANDIDATES.includes(raw.toLowerCase())) continue
    const dedupe = raw.toLowerCase()
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    keys.push(raw)
  }
  return keys
}

export function parseLicenseKeysFromBuffer(buffer, filename = '') {
  const name = String(filename).toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '')
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (!lines.length) return []
    const first = lines[0].toLowerCase()
    const start = KEY_HEADER_CANDIDATES.some((h) => first === h || first.startsWith(`${h},`) || first.startsWith(`${h}\t`))
      ? 1
      : 0
    const keys = []
    const seen = new Set()
    for (const line of lines.slice(start)) {
      const cell = normalizeKeyValue(line.split(/[,\t;]/)[0])
      if (!cell || cell.length < 4) continue
      const dedupe = cell.toLowerCase()
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      keys.push(cell)
    }
    return keys
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  return extractKeysFromRows(rows)
}

/**
 * Import unique product keys into the available pool for a product.
 * Skips keys that already exist (any status) so keys are never reused.
 */
export async function importLicenseKeys(productId, keys) {
  const unique = []
  const seen = new Set()
  for (const raw of keys) {
    const key = normalizeKeyValue(raw)
    if (!key || key.length < 4) continue
    const dedupe = key.toLowerCase()
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    unique.push(key)
  }

  if (!unique.length) {
    return { imported: 0, duplicates: 0, invalid: keys.length, available: await countAvailableKeys(productId) }
  }

  const existing = await LicenseKey.find({
    licenseKey: { $in: unique },
  }).select('licenseKey')
  const existingSet = new Set(existing.map((doc) => doc.licenseKey.toLowerCase()))

  const toInsert = unique
    .filter((key) => !existingSet.has(key.toLowerCase()))
    .map((licenseKey) => ({
      productId,
      licenseKey,
      status: 'available',
    }))

  let imported = 0
  if (toInsert.length) {
    try {
      const result = await LicenseKey.insertMany(toInsert, { ordered: false })
      imported = result.length
    } catch (err) {
      // Partial insert on duplicate key races
      imported = err?.insertedDocs?.length ?? (await LicenseKey.countDocuments({
        productId,
        licenseKey: { $in: toInsert.map((d) => d.licenseKey) },
        status: 'available',
      }))
      if (!imported && err?.writeErrors) {
        imported = toInsert.length - err.writeErrors.length
      }
    }
  }

  return {
    imported,
    duplicates: unique.length - toInsert.length,
    invalid: Math.max(0, keys.length - unique.length),
    available: await countAvailableKeys(productId),
  }
}

async function assignKeysForOrderItem(item, orderId) {
  const needed = Math.max(1, Number(item.quantity) || 1)
  const keys = []
  for (let i = 0; i < needed; i += 1) {
    const key = await assignLicenseKey({
      productId: item.productId,
      variantId: item.variantId,
      orderId,
    })
    if (!key) {
      return { complete: false, licenseKey: keys.length ? keys.join('\n') : null, missing: needed - keys.length }
    }
    keys.push(key)
  }
  return { complete: true, licenseKey: keys.join('\n'), missing: 0 }
}

/**
 * Fill missing keys on a paid order. Completes + emails when all items keyed;
 * otherwise leaves orderStatus = pending for manual handling.
 */
export async function deliverKeysForPaidOrder(order, { forceEmail = false } = {}) {
  const items = await OrderItem.find({ orderId: order._id })
  let allComplete = true
  let newlyAssigned = false

  for (const item of items) {
    if (item.licenseKey?.trim()) continue
    const result = await assignKeysForOrderItem(item, order._id)
    if (result.licenseKey) {
      item.licenseKey = result.licenseKey
      item.keySentAt = undefined
      await item.save()
      newlyAssigned = true
    }
    if (!result.complete) allComplete = false
  }

  const refreshed = await OrderItem.find({ orderId: order._id })
  allComplete = refreshed.every((item) => Boolean(item.licenseKey?.trim()))
  const primaryKey = refreshed.find((item) => item.licenseKey)?.licenseKey ?? null

  order.licenseKey = primaryKey
  order.paymentStatus = 'paid'

  if (!allComplete) {
    order.orderStatus = 'pending'
    await order.save()
    return {
      delivered: false,
      awaitingKeys: true,
      confirmationCode: order.confirmationCode,
      licenseKey: primaryKey,
      items: refreshed.map((item) => ({
        productName: item.productName,
        licenseKey: item.licenseKey ?? null,
      })),
      emailDelivered: false,
      newlyAssigned,
    }
  }

  // All keys available — deliver and complete
  order.orderStatus = 'completed'
  await order.save()

  let emailDelivered = Boolean(order.emailSent)
  if ((!order.emailSent || forceEmail) && primaryKey) {
    try {
      const emailResult = await sendOrderDeliveryEmail({
        order: mapId(order),
        items: refreshed.map(mapId),
        confirmationCode: order.confirmationCode,
      })
      if (emailResult.status === 'sent') {
        order.emailSent = true
        emailDelivered = true
        for (const item of refreshed) {
          item.keySentAt = new Date()
          await item.save()
        }
        await order.save()
      }
    } catch (err) {
      console.error('[license] email delivery failed:', err.message)
    }

    await sendOrderWhatsApp({
      phone: order.customerWhatsapp || order.customerPhone,
      order: mapId(order),
      confirmationCode: order.confirmationCode,
      licenseKey: primaryKey,
    })
  }

  return {
    delivered: true,
    awaitingKeys: false,
    confirmationCode: order.confirmationCode,
    licenseKey: primaryKey,
    items: refreshed.map((item) => ({
      productName: item.productName,
      licenseKey: item.licenseKey,
    })),
    emailDelivered,
    newlyAssigned,
  }
}

/**
 * After keys are imported, try to auto-deliver older paid orders that are
 * still pending because the key pool was empty.
 */
export async function processPendingKeyDeliveries({ limit = 50 } = {}) {
  const pending = await Order.find({
    paymentStatus: 'paid',
    orderStatus: { $in: ['pending', 'processing', 'on_hold'] },
  })
    .sort({ createdAt: 1 })
    .limit(limit)

  const results = {
    checked: pending.length,
    delivered: 0,
    stillWaiting: 0,
    failed: 0,
  }

  for (const order of pending) {
    try {
      const items = await OrderItem.find({ orderId: order._id })
      const needsKeys = items.some((item) => !item.licenseKey?.trim())
      if (!needsKeys && order.emailSent && order.orderStatus === 'completed') {
        continue
      }
      if (!needsKeys && !order.emailSent) {
        const delivery = await deliverKeysForPaidOrder(order, { forceEmail: true })
        if (delivery.delivered) results.delivered += 1
        else results.stillWaiting += 1
        continue
      }
      if (!needsKeys) {
        if (order.orderStatus !== 'completed') {
          order.orderStatus = 'completed'
          await order.save()
        }
        continue
      }

      const delivery = await deliverKeysForPaidOrder(order)
      if (delivery.delivered) results.delivered += 1
      else results.stillWaiting += 1
    } catch {
      results.failed += 1
    }
  }

  return results
}

export async function countOrdersAwaitingKeys() {
  const paidOrders = await Order.find({
    paymentStatus: 'paid',
    orderStatus: { $in: ['pending', 'processing', 'on_hold'] },
  }).select('_id')

  if (!paidOrders.length) return 0

  const orderIds = paidOrders.map((o) => o._id)
  const missing = await OrderItem.aggregate([
    {
      $match: {
        orderId: { $in: orderIds },
        $or: [{ licenseKey: null }, { licenseKey: '' }, { licenseKey: { $exists: false } }],
      },
    },
    { $group: { _id: '$orderId' } },
  ])
  return missing.length
}

/** Kept for local seed/demo; production keys should come from Excel import. */
export async function seedLicensePool(productId, count = 0) {
  if (!count || count <= 0) return
  const keys = Array.from({ length: count }, (_, index) => ({
    productId,
    licenseKey: `POOL-${productId}-${String(index + 1).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    status: 'available',
  }))
  if (keys.length) await LicenseKey.insertMany(keys, { ordered: false }).catch(() => {})
}

export async function getVariant(variantId) {
  if (!variantId) return null
  const { ProductVariant } = await import('../db/models.js')
  return ProductVariant.findById(variantId)
}
