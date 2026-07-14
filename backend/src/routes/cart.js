import { z } from 'zod'
import { mapId } from '../db/client.js'
import { Cart, CartItem, Product } from '../db/models.js'
import { generateSessionId } from '../lib/utils.js'
import { resolveStoreProductImage } from '../lib/productImages.js'
import { resolveProductPrice, validateCoupon } from '../services/pricing.js'
import { trackAbandonedCart } from '../services/marketing.js'
import { config } from '../config.js'

async function getOrCreateCart(sessionId) {
  let cart = await Cart.findOne({ sessionId })
  if (!cart) {
    cart = await Cart.create({ sessionId, countryCode: config.defaultCountry, currency: config.defaultCurrency })
  }
  return cart
}

export async function cartRoutes(app) {
  app.get('/api/cart', async (request) => {
    const sessionId = request.headers['x-session-id'] ?? generateSessionId()
    const cart = await getOrCreateCart(sessionId)
    const items = await CartItem.find({ cartId: cart._id })

    const enriched = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.productId)
        const pricing = await resolveProductPrice(product, {
          countryCode: cart.countryCode, currency: cart.currency, variantId: item.variantId, quantity: item.quantity,
        })
        return {
          ...mapId(item),
          product: product
            ? {
                id: product._id.toString(),
                name: product.name,
                slug: product.slug,
                category: product.category,
                imageUrl: resolveStoreProductImage(product, config.apiPublicUrl),
              }
            : null,
          unitPrice: pricing.unitPrice,
          lineTotal: pricing.unitPrice * item.quantity,
        }
      }),
    )

    const subtotal = enriched.reduce((sum, item) => sum + item.lineTotal, 0)
    let discount = 0
    if (cart.couponCode) {
      const couponResult = await validateCoupon(cart.couponCode, { subtotal, countryCode: cart.countryCode, productIds: enriched.map((i) => i.productId?.toString?.() ?? i.productId) })
      if (couponResult.valid) discount = couponResult.discount
    }

    return { sessionId, cart: { ...mapId(cart), items: enriched, subtotal, discount, total: subtotal - discount } }
  })

  app.post('/api/cart/items', async (request) => {
    const schema = z.object({ productId: z.string(), variantId: z.string().optional(), quantity: z.number().int().min(1).default(1) })
    const payload = schema.parse(request.body)
    const sessionId = request.headers['x-session-id'] ?? generateSessionId()
    const cart = await getOrCreateCart(sessionId)

    const existing = await CartItem.findOne({ cartId: cart._id, productId: payload.productId })
    if (existing) {
      existing.quantity += payload.quantity
      if (payload.variantId) existing.variantId = payload.variantId
      await existing.save()
    } else {
      await CartItem.create({ cartId: cart._id, productId: payload.productId, variantId: payload.variantId, quantity: payload.quantity })
    }
    return { sessionId, success: true }
  })

  app.patch('/api/cart', async (request) => {
    const schema = z.object({ email: z.string().email().optional(), couponCode: z.string().optional(), countryCode: z.string().length(2).optional(), currency: z.string().length(3).optional() })
    const payload = schema.parse(request.body)
    const sessionId = request.headers['x-session-id']
    if (!sessionId) throw app.httpErrors.badRequest('Session required')
    const cart = await getOrCreateCart(sessionId)
    if (payload.email) cart.email = payload.email
    if (payload.couponCode) cart.couponCode = payload.couponCode.toUpperCase()
    if (payload.countryCode) cart.countryCode = payload.countryCode
    if (payload.currency) cart.currency = payload.currency
    cart.updatedAt = new Date()
    await cart.save()
    if (payload.email) await trackAbandonedCart(cart._id, payload.email, 'checkout')
    return { success: true }
  })

  app.delete('/api/cart/items/:id', async (request, reply) => {
    const sessionId = request.headers['x-session-id']
    if (!sessionId) throw app.httpErrors.badRequest('Session required')
    const cart = await getOrCreateCart(sessionId)
    const result = await CartItem.deleteOne({ _id: request.params.id, cartId: cart._id })
    if (result.deletedCount === 0) return reply.notFound('Cart item not found')
    return { success: true }
  })
}
