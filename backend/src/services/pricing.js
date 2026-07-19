import { Coupon, PricingRule, ProductVariant } from '../db/models.js'
import { convertPrice, parseJsonList } from '../lib/utils.js'
import { config, CURRENCIES } from '../config.js'
import { applyVolumeDiscount } from '../lib/volumeTiers.js'
import { getVariant } from './license.js'

export { getVariant }
export { VOLUME_DISCOUNT_TIERS, getVolumeDiscountPercent, publicVolumeTiers } from '../lib/volumeTiers.js'

/** Convert an amount from one catalog currency to another using INR-anchored rates. */
export function convertCurrencyAmount(amount, fromCurrency, toCurrency, currencies = CURRENCIES) {
  const from = String(fromCurrency || config.catalogBaseCurrency || 'USD').toUpperCase()
  const to = String(toCurrency || config.catalogBaseCurrency || 'USD').toUpperCase()
  const value = Number(amount) || 0
  if (from === to) return Math.round(value)
  const fromRate = currencies[from]?.rate ?? 1
  const toRate = currencies[to]?.rate ?? 1
  if (!fromRate) return Math.round(value * toRate)
  return Math.round((value / fromRate) * toRate)
}

function ruleSpecificity(rule) {
  let score = Number(rule.minQty) || 0
  if (rule.productId) score += 100
  if (rule.countryCode) score += 10
  if (rule.variantId) score += 50
  return score
}

function matchRules(rules, { product, countryCode, variantId, quantity }) {
  const productId = String(product._id ?? product.id)
  return rules
    .filter((rule) => {
      if (rule.countryCode && rule.countryCode !== countryCode) return false
      if (rule.productId && String(rule.productId) !== productId) return false
      if (rule.variantId && variantId && String(rule.variantId) !== String(variantId)) return false
      if ((rule.minQty ?? 1) > quantity) return false
      return true
    })
    .sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a))
}

function resolveFromContext(product, context, { countryCode, currency, variantId = null, quantity = 1 }) {
  const productVariants = context?.variantsByProductId?.get(String(product._id ?? product.id)) ?? []
  const variant = variantId
    ? productVariants.find((v) => String(v._id) === String(variantId))
    : null

  let basePrice = variant?.price ?? product.price
  const rules = context?.rules ?? []
  const matching = matchRules(rules, { product, countryCode, variantId, quantity })
  const matched = matching[0]
  const catalogBase = config.catalogBaseCurrency || 'USD'
  const targetCurrency = currency || catalogBase

  // Regional / rule price overrides are stored in the rule's currency (often the region's local currency).
  if (matched?.priceOverride != null && Number(matched.priceOverride) > 0) {
    const ruleCurrency = matched.currency || catalogBase
    const converted = convertCurrencyAmount(matched.priceOverride, ruleCurrency, targetCurrency)
    const volume = applyVolumeDiscount(converted, quantity)
    return {
      unitPrice: volume.unitPrice,
      listUnitPrice: volume.listUnitPrice,
      volumeDiscountPercent: volume.volumeDiscountPercent,
      currency: targetCurrency,
      paymentMethods: parseJsonList(matched.paymentMethods),
      shippingMode: matched.shippingMode ?? 'instant_digital',
      variant,
      priceSource: 'regional',
    }
  }

  const tier = [...productVariants]
    .sort((a, b) => a.tierMinQty - b.tierMinQty)
    .reverse()
    .find((item) => quantity >= item.tierMinQty)
  if (tier) basePrice = tier.price

  const converted = convertPrice(basePrice, targetCurrency, CURRENCIES, catalogBase)
  const volume = applyVolumeDiscount(converted, quantity)

  return {
    unitPrice: volume.unitPrice,
    listUnitPrice: volume.listUnitPrice,
    volumeDiscountPercent: volume.volumeDiscountPercent,
    currency: targetCurrency,
    paymentMethods: parseJsonList(matched?.paymentMethods),
    shippingMode: matched?.shippingMode ?? 'instant_digital',
    variant,
    priceSource: tier ? 'tier' : 'base',
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

export async function listProductRegionalPrices(productId) {
  const rules = await PricingRule.find({
    productId,
    active: true,
    countryCode: { $ne: null, $exists: true },
    priceOverride: { $ne: null },
  })
    .sort({ countryCode: 1 })
    .lean()

  return rules
    .filter((rule) => rule.countryCode && Number(rule.priceOverride) > 0)
    .map((rule) => ({
      id: String(rule._id),
      countryCode: rule.countryCode,
      price: Number(rule.priceOverride),
      currency: rule.currency || 'INR',
      name: rule.name,
    }))
}

/**
 * Upsert country→price rows for a product. Empty/null price removes that country's override.
 * Prices are stored in each region's local currency (see COUNTRY_REGION mapping).
 */
export async function syncProductRegionalPrices(product, regionalPrices = []) {
  const productId = product._id ?? product.id
  const productName = product.name || 'Product'
  const incoming = Array.isArray(regionalPrices) ? regionalPrices : []

  const desired = new Map()
  for (const row of incoming) {
    const countryCode = String(row.countryCode || '').trim().toUpperCase()
    if (!countryCode || countryCode.length !== 2) continue
    const price = Number(row.price)
    if (!Number.isFinite(price) || price <= 0) continue
    const currency = String(row.currency || 'INR').trim().toUpperCase().slice(0, 3)
    desired.set(countryCode, { price: Math.round(price), currency })
  }

  const existing = await PricingRule.find({
    productId,
    countryCode: { $ne: null, $exists: true },
    priceOverride: { $ne: null },
  })

  const byCountry = new Map()
  for (const rule of existing) {
    if (!rule.countryCode) continue
    const key = rule.countryCode.toUpperCase()
    if (!byCountry.has(key)) byCountry.set(key, [])
    byCountry.get(key).push(rule)
  }

  for (const [countryCode, rows] of byCountry.entries()) {
    const wanted = desired.get(countryCode)
    const [primary, ...dupes] = rows
    if (!wanted) {
      await PricingRule.deleteMany({ _id: { $in: rows.map((r) => r._id) } })
      continue
    }
    primary.name = `Regional · ${productName} · ${countryCode}`
    primary.priceOverride = wanted.price
    primary.currency = wanted.currency
    primary.minQty = 1
    primary.active = true
    primary.variantId = undefined
    await primary.save()
    if (dupes.length) {
      await PricingRule.deleteMany({ _id: { $in: dupes.map((r) => r._id) } })
    }
    desired.delete(countryCode)
  }

  for (const [countryCode, wanted] of desired.entries()) {
    await PricingRule.create({
      name: `Regional · ${productName} · ${countryCode}`,
      productId,
      countryCode,
      priceOverride: wanted.price,
      currency: wanted.currency,
      minQty: 1,
      shippingMode: 'instant_digital',
      active: true,
    })
  }

  return listProductRegionalPrices(productId)
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
