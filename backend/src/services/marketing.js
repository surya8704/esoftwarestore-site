import { AbandonedCart, Cart, CartItem, Product } from '../db/models.js'
import { resolveStoreProductImage } from '../lib/productImages.js'
import { config } from '../config.js'
import { resolveProductPrice } from './pricing.js'
import { sendAbandonedCartEmail } from './email.js'

/** Hours from first abandon tracking (createdAt) when each reminder is due. */
const FOLLOW_UP_HOURS = [1, 24, 72]

export async function trackAbandonedCart(cartId, email, step = 'checkout') {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return null

  const existing = await AbandonedCart.findOne({ cartId })
  if (existing) {
    existing.email = normalized
    existing.step = step
    // Re-open reminder funnel if they abandoned again after a prior recovery
    if (existing.recovered) {
      existing.recovered = false
      existing.followUpStage = 0
      existing.lastEmailAt = null
      existing.createdAt = new Date()
    }
    await existing.save()
    return existing._id
  }

  const created = await AbandonedCart.create({
    cartId,
    email: normalized,
    step,
    followUpStage: 0,
    recovered: false,
  })
  return created._id
}

async function loadCartSnapshot(cartId) {
  const cart = await Cart.findById(cartId)
  if (!cart) return null

  const items = await CartItem.find({ cartId })
  if (!items.length) return { cart, items: [], empty: true }

  const enriched = []
  for (const item of items) {
    const product = await Product.findById(item.productId)
    if (!product) continue
    const pricing = await resolveProductPrice(product, {
      countryCode: cart.countryCode || config.defaultCountry,
      currency: cart.currency || config.defaultCurrency,
      variantId: item.variantId,
      quantity: item.quantity,
    })
    enriched.push({
      name: product.name,
      quantity: item.quantity,
      unitPrice: pricing.unitPrice,
      lineTotal: pricing.unitPrice * item.quantity,
      currency: pricing.currency,
      imageUrl: resolveStoreProductImage(product, config.apiPublicUrl),
      slug: product.slug,
    })
  }

  const subtotal = enriched.reduce((sum, row) => sum + row.lineTotal, 0)
  return {
    cart,
    items: enriched,
    empty: enriched.length === 0,
    subtotal,
    currency: cart.currency || config.defaultCurrency,
  }
}

export async function processAbandonedCartFollowUps() {
  const rows = await AbandonedCart.find({ recovered: false }).sort({ createdAt: 1 }).limit(200)
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    if (!row.email) {
      skipped += 1
      continue
    }

    const stage = Number(row.followUpStage) || 0
    if (stage >= FOLLOW_UP_HOURS.length) continue

    const hours = FOLLOW_UP_HOURS[stage]
    const dueAt = new Date(row.createdAt)
    dueAt.setHours(dueAt.getHours() + hours)
    if (dueAt > new Date()) continue

    const snapshot = await loadCartSnapshot(row.cartId)
    if (!snapshot || snapshot.empty) {
      row.recovered = true
      await row.save()
      skipped += 1
      continue
    }

    try {
      const result = await sendAbandonedCartEmail({
        email: row.email,
        cartId: row.cartId,
        stage,
        items: snapshot.items,
        subtotal: snapshot.subtotal,
        currency: snapshot.currency,
      })

      const ok = result?.status === 'sent' || result?.status === 'logged'
      if (!ok) {
        failed += 1
        continue
      }

      row.followUpStage = stage + 1
      row.lastEmailAt = new Date()
      await row.save()
      sent += 1
    } catch (err) {
      failed += 1
      console.error('[abandoned-cart] send failed', row._id?.toString?.(), err?.message || err)
    }
  }

  return { sent, skipped, failed, checked: rows.length }
}

export async function markCartRecovered(cartId) {
  if (!cartId) return
  await AbandonedCart.updateMany({ cartId }, { recovered: true })
}

/** If the cart still has no items, stop reminder emails. */
export async function markCartRecoveredIfEmpty(cartId) {
  if (!cartId) return
  const count = await CartItem.countDocuments({ cartId })
  if (count === 0) await markCartRecovered(cartId)
}
