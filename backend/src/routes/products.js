import { mapId } from '../db/client.js'
import { Product, ProductReview, ProductVariant, SupportVideo } from '../db/models.js'
import { isProductVisible } from '../lib/utils.js'
import { createPricingContext, resolveProductPriceFromContext, publicVolumeTiers } from '../services/pricing.js'
import { detectRegion, getRegionForCountry, COUNTRY_REGION } from '../services/geo.js'
import { config, COUNTRY_PAYMENTS, CURRENCIES, LOCALES, isPaymentsLiveMode } from '../config.js'
import { resolveStoreProductImage } from '../lib/productImages.js'
import { attachReviewSummary, mergeProductReviews } from '../lib/productReviews.js'
import { attachBundleContents } from '../lib/bundles.js'

const normalizeProduct = (product) => {
  const p = mapId(product)
  const rating = Number(p.rating) / 10
  const summary = attachReviewSummary({ ...p, rating })
  const productType = p.productType === 'bundle' ? 'bundle' : 'standard'
  return {
    ...p,
    productType,
    isBundle: productType === 'bundle',
    bundleItems: (p.bundleItems ?? []).map((item) => ({
      productId: String(item.productId?._id ?? item.productId ?? ''),
      quantity: Number(item.quantity) || 1,
    })),
    rating,
    reviewCount: summary.reviewCount,
    price: Number(p.price),
    originalPrice: Number(p.originalPrice),
    stock: Number(p.stock),
    hidePrice: Boolean(p.hidePrice),
    hideCart: Boolean(p.hideCart),
    imageUrl: resolveStoreProductImage(p, config.apiPublicUrl),
  }
}

function enrichProduct(product, context, country, currency) {
  const pricing = resolveProductPriceFromContext(product, context, { countryCode: country, currency })
  const variants = (context.variantsByProductId.get(String(product._id ?? product.id)) ?? []).map((v) => ({
    ...mapId(v),
    displayPrice: pricing.unitPrice,
  }))

  return {
    ...normalizeProduct(product),
    displayPrice: pricing.unitPrice,
    currency: pricing.currency,
    paymentMethods: pricing.paymentMethods ?? COUNTRY_PAYMENTS[country] ?? COUNTRY_PAYMENTS.default,
    variants,
  }
}

export async function productRoutes(app) {
  app.get('/api/config', async () => ({
    currencies: CURRENCIES,
    locales: LOCALES,
    countryRegions: COUNTRY_REGION,
    defaultCountry: config.defaultCountry,
    defaultCurrency: config.defaultCurrency,
    defaultLocale: config.defaultLocale,
    countryPayments: COUNTRY_PAYMENTS,
    paymentsLiveMode: isPaymentsLiveMode(),
    cdnUrl: config.cdnUrl,
    clientUrl: config.clientUrl,
    googleClientId: config.googleClientId || null,
    googleLoginEnabled: Boolean(config.googleClientId),
    facebookAppId: config.facebookAppId || null,
    facebookLoginEnabled: Boolean(config.facebookAppId && config.facebookAppSecret),
    volumeDiscountTiers: publicVolumeTiers(),
  }))

  app.get('/api/geo', async (request) => detectRegion(request))

  app.post('/api/geo/resolve', async (request) => {
    const { country, locale } = request.body ?? {}
    if (!country) return getRegionForCountry(config.defaultCountry, locale)
    return getRegionForCountry(country, locale)
  })

  app.get('/api/products', async (request) => {
    const country = request.headers['x-country'] ?? config.defaultCountry
    const currency = request.headers['x-currency'] ?? config.defaultCurrency
    const catalog = await Product.find({ active: true }).sort({ createdAt: -1 }).lean()
    const visible = catalog.filter((p) => isProductVisible(p, country))
    const productIds = visible.map((p) => p._id)
    const context = await createPricingContext(productIds)
    const enriched = visible.map((product) => enrichProduct(product, context, country, currency))
    const withBundles = await attachBundleContents(enriched)

    return { products: withBundles, country, currency }
  })

  app.get('/api/products/:slug', async (request, reply) => {
    const country = request.headers['x-country'] ?? config.defaultCountry
    const currency = request.headers['x-currency'] ?? config.defaultCurrency
    const product = await Product.findOne({ slug: request.params.slug }).lean()
    if (!product || !isProductVisible(product, country)) return reply.notFound('Product not found')

    const context = await createPricingContext([product._id])
    const pricing = resolveProductPriceFromContext(product, context, { countryCode: country, currency })
    const variants = (context.variantsByProductId.get(String(product._id)) ?? []).map(mapId)
    const videos = await SupportVideo.find({ active: true }).lean()
    const enriched = await attachBundleContents({
      ...normalizeProduct(product),
      displayPrice: pricing.unitPrice,
      currency: pricing.currency,
      paymentMethods: pricing.paymentMethods ?? COUNTRY_PAYMENTS[country] ?? COUNTRY_PAYMENTS.default,
      shippingMode: pricing.shippingMode,
      variants,
    })

    return {
      product: enriched,
      videos: videos.filter((v) => !v.productId || v.productId.toString() === product._id.toString()).map(mapId),
    }
  })

  app.get('/api/products/:slug/reviews', async (request, reply) => {
    const country = request.headers['x-country'] ?? config.defaultCountry
    const locale = request.query.locale ?? request.headers['x-locale'] ?? config.defaultLocale
    const limit = parseInt(request.query.limit ?? '12', 10)
    const product = await Product.findOne({ slug: request.params.slug }).lean()
    if (!product || !isProductVisible(product, country)) return reply.notFound('Product not found')

    const normalized = normalizeProduct(product)
    const stored = await ProductReview.find({ productId: product._id, active: true })
      .sort({ createdAt: -1 })
      .limit(48)
      .lean()

    return mergeProductReviews(normalized, stored, { locale, limit })
  })
}
