import { Coupon, PricingRule, ProductVariant } from '../db/models.js'
import { convertPrice, parseJsonList } from '../lib/utils.js'
import { CURRENCIES } from '../config.js'
import { getVariant } from './license.js'

export { getVariant }

function matchRules(rules, { product, countryCode, variantId, quantity }) {
  const productId = String(product._id ?? product.id)
  return rules
    .filter((rule) => {
      if (rule.countryCode && rule.countryCode !== countryCode) return false
      if (rule.productId && String(rule.productId) !== productId) return false
      if (rule.variantId && variantId && String(rule.variantId) !== String(variantId)) return false
      if (rule.minQty > quantity) return false
      return true
    })
    .sort((a, b) => b.minQty - a.minQty)
}

function resolveFromContext(product, context, { countryCode, currency, variantId = null, quantity = 1 }) {
  const productVariants = context?.variantsByProductId?.get(String(product._id ?? product.id)) ?? []
  const variant = variantId
    ? productVariants.find((v) => String(v._id) === String(variantId))
    : null

  let basePrice = variant?.price ?? product.price
  const rules = context?.rules ?? []

  const matching = matchRules(rules, { product, countryCode, variantId, quantity })
  if (matching[0]?.priceOverride) basePrice = matching[0].priceOverride

  const tier = [...productVariants].sort((a, b) => a.tierMinQty - b.tierMinQty).reverse().find((item) => quantity >= item.tierMinQty)
  if (tier) basePrice = tier.price

  const resolvedCurrency = matching[0]?.currency ?? currency
  return {
    unitPrice: convertPrice(basePrice, resolvedCurrency, CURRENCIES),
    currency: resolvedCurrency,
    paymentMethods: parseJsonList(matching[0]?.paymentMethods),
    shippingMode: matching[0]?.shippingMode ?? 'instant_digital',
    variant,
  }
}

export async function createPricingContext(productIds = []) {
  const [rules, allVariants] = await Promise.all([
    PricingRule.find({ active: true }).lean(),
    productIds.length
      ? ProductVariant.find({ productId: { $in: productIds }, active: true }).lean()
      : ProductVariant.find({ active: true }).lean(),
  ])

  const variantsByProductId = new Map()
  for (const variant of allVariants) {
    const key = String(variant.productId)
    if (!variantsByProductId.has(key)) variantsByProductId.set(key, [])
    variantsByProductId.get(key).push(variant)
  }

  return { rules, variantsByProductId }
}

export function resolveProductPriceFromContext(product, context, options) {
  return resolveFromContext(product, context, options)
}

export async function resolveProductPrice(product, { countryCode, currency, variantId, quantity = 1 }) {
  const context = await createPricingContext([product._id ?? product.id])
  if (variantId) {
    const external = await getVariant(variantId)
    if (external) {
      const tiers = context.variantsByProductId.get(String(product._id ?? product.id)) ?? []
      const merged = tiers.some((v) => String(v._id) === String(variantId)) ? tiers : [...tiers, external]
      context.variantsByProductId.set(String(product._id ?? product.id), merged)
    }
  }
  return resolveFromContext(product, context, { countryCode, currency, variantId, quantity })
}

export async function validateCoupon(code, { subtotal, countryCode, productIds = [] }) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase() })
  if (!coupon || !coupon.active) return { valid: false, message: 'Invalid coupon' }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { valid: false, message: 'Coupon expired' }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return { valid: false, message: 'Coupon usage limit reached' }
  if (subtotal < coupon.minAmount) return { valid: false, message: `Minimum order ${coupon.minAmount}` }

  const countries = parseJsonList(coupon.countryCodes)
  if (countries?.length && !countries.includes(countryCode)) return { valid: false, message: 'Coupon not valid in your country' }

  const allowedProducts = parseJsonList(coupon.productIds)
  if (allowedProducts?.length && !productIds.some((id) => allowedProducts.includes(String(id)))) {
    return { valid: false, message: 'Coupon not valid for these products' }
  }

  const discount = coupon.discountType === 'percent'
    ? Math.round((subtotal * coupon.discountValue) / 100)
    : coupon.discountValue

  return { valid: true, discount: Math.min(discount, subtotal), coupon }
}
