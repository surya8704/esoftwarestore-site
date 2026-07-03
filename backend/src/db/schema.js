import { boolean, int, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 180 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 30 }).notNull().default('customer'),
  countryCode: varchar('country_code', { length: 2 }).default('IN'),
  locale: varchar('locale', { length: 10 }).default('en'),
  walletBalance: int('wallet_balance').notNull().default(0),
  affiliateCode: varchar('affiliate_code', { length: 40 }),
  referredBy: int('referred_by'),
  socialProvider: varchar('social_provider', { length: 40 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const vendors = mysqlTable('vendors', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id'),
  name: varchar('name', { length: 160 }).notNull(),
  slug: varchar('slug', { length: 140 }).notNull().unique(),
  email: varchar('email', { length: 180 }).notNull(),
  commissionRate: int('commission_rate').notNull().default(15),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const vendorPayouts = mysqlTable('vendor_payouts', {
  id: int('id').autoincrement().primaryKey(),
  vendorId: int('vendor_id').notNull(),
  amount: int('amount').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  reference: varchar('reference', { length: 120 }),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const products = mysqlTable('products', {
  id: int('id').autoincrement().primaryKey(),
  vendorId: int('vendor_id'),
  slug: varchar('slug', { length: 140 }).notNull().unique(),
  name: varchar('name', { length: 160 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  price: int('price').notNull(),
  originalPrice: int('original_price').notNull(),
  rating: int('rating').notNull(),
  stock: int('stock').notNull(),
  licenseType: varchar('license_type', { length: 80 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  visualAccent: varchar('visual_accent', { length: 80 }).notNull().default('from-sky-500 to-cyan-400'),
  description: text('description'),
  hidePrice: boolean('hide_price').notNull().default(false),
  hideCart: boolean('hide_cart').notNull().default(false),
  allowedCountries: text('allowed_countries'),
  blockedCountries: text('blocked_countries'),
  downloadUrl: varchar('download_url', { length: 500 }),
  videoUrl: varchar('video_url', { length: 500 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const productVariants = mysqlTable('product_variants', {
  id: int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  sku: varchar('sku', { length: 80 }).notNull().unique(),
  price: int('price').notNull(),
  originalPrice: int('original_price').notNull(),
  stock: int('stock').notNull().default(0),
  tierMinQty: int('tier_min_qty').notNull().default(1),
  tierLabel: varchar('tier_label', { length: 80 }),
  isDefault: boolean('is_default').notNull().default(false),
  active: boolean('active').notNull().default(true),
})

export const licenseKeys = mysqlTable('license_keys', {
  id: int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull(),
  variantId: int('variant_id'),
  licenseKey: varchar('license_key', { length: 200 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('available'),
  orderId: int('order_id'),
  assignedAt: timestamp('assigned_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const coupons = mysqlTable('coupons', {
  id: int('id').autoincrement().primaryKey(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  discountType: varchar('discount_type', { length: 20 }).notNull().default('percent'),
  discountValue: int('discount_value').notNull(),
  minAmount: int('min_amount').notNull().default(0),
  maxUses: int('max_uses'),
  usedCount: int('used_count').notNull().default(0),
  countryCodes: text('country_codes'),
  productIds: text('product_ids'),
  active: boolean('active').notNull().default(true),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const pricingRules = mysqlTable('pricing_rules', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  countryCode: varchar('country_code', { length: 2 }),
  productId: int('product_id'),
  variantId: int('variant_id'),
  minQty: int('min_qty').notNull().default(1),
  priceOverride: int('price_override'),
  currency: varchar('currency', { length: 3 }).default('INR'),
  paymentMethods: text('payment_methods'),
  shippingMode: varchar('shipping_mode', { length: 40 }).default('instant_digital'),
  active: boolean('active').notNull().default(true),
})

export const carts = mysqlTable('carts', {
  id: int('id').autoincrement().primaryKey(),
  sessionId: varchar('session_id', { length: 64 }).notNull().unique(),
  userId: int('user_id'),
  email: varchar('email', { length: 180 }),
  countryCode: varchar('country_code', { length: 2 }).default('IN'),
  currency: varchar('currency', { length: 3 }).default('INR'),
  couponCode: varchar('coupon_code', { length: 40 }),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const cartItems = mysqlTable('cart_items', {
  id: int('id').autoincrement().primaryKey(),
  cartId: int('cart_id').notNull(),
  productId: int('product_id').notNull(),
  variantId: int('variant_id'),
  quantity: int('quantity').notNull().default(1),
})

export const orders = mysqlTable('orders', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id'),
  sessionId: varchar('session_id', { length: 64 }),
  customerEmail: varchar('customer_email', { length: 180 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 40 }),
  countryCode: varchar('country_code', { length: 2 }).default('IN'),
  currency: varchar('currency', { length: 3 }).default('INR'),
  subtotal: int('subtotal').notNull(),
  discount: int('discount').notNull().default(0),
  total: int('total').notNull(),
  couponCode: varchar('coupon_code', { length: 40 }),
  paymentStatus: varchar('payment_status', { length: 40 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 40 }),
  razorpayOrderId: varchar('razorpay_order_id', { length: 120 }),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 120 }),
  confirmationCode: varchar('confirmation_code', { length: 20 }),
  licenseKey: varchar('license_key', { length: 200 }),
  emailSent: boolean('email_sent').notNull().default(false),
  whatsappSent: boolean('whatsapp_sent').notNull().default(false),
  affiliateId: int('affiliate_id'),
  productId: int('product_id'),
  amount: int('amount'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const orderItems = mysqlTable('order_items', {
  id: int('id').autoincrement().primaryKey(),
  orderId: int('order_id').notNull(),
  productId: int('product_id').notNull(),
  variantId: int('variant_id'),
  productName: varchar('product_name', { length: 160 }).notNull(),
  quantity: int('quantity').notNull().default(1),
  unitPrice: int('unit_price').notNull(),
  licenseKey: varchar('license_key', { length: 200 }),
})

export const abandonedCarts = mysqlTable('abandoned_carts', {
  id: int('id').autoincrement().primaryKey(),
  cartId: int('cart_id').notNull(),
  email: varchar('email', { length: 180 }),
  step: varchar('step', { length: 40 }).notNull().default('cart'),
  followUpStage: int('follow_up_stage').notNull().default(0),
  lastEmailAt: timestamp('last_email_at'),
  recovered: boolean('recovered').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const newsletterSubscribers = mysqlTable('newsletter_subscribers', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 180 }).notNull().unique(),
  locale: varchar('locale', { length: 10 }).default('en'),
  countryCode: varchar('country_code', { length: 2 }),
  confirmed: boolean('confirmed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const pageViews = mysqlTable('page_views', {
  id: int('id').autoincrement().primaryKey(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  path: varchar('path', { length: 300 }).notNull(),
  referrer: varchar('referrer', { length: 500 }),
  countryCode: varchar('country_code', { length: 2 }),
  locale: varchar('locale', { length: 10 }),
  userAgent: varchar('user_agent', { length: 300 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const affiliates = mysqlTable('affiliates', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  commissionRate: int('commission_rate').notNull().default(10),
  totalEarnings: int('total_earnings').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const walletTransactions = mysqlTable('wallet_transactions', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  amount: int('amount').notNull(),
  type: varchar('type', { length: 40 }).notNull(),
  reference: varchar('reference', { length: 120 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const emailLogs = mysqlTable('email_logs', {
  id: int('id').autoincrement().primaryKey(),
  toEmail: varchar('to_email', { length: 180 }).notNull(),
  subject: varchar('subject', { length: 200 }).notNull(),
  template: varchar('template', { length: 80 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('sent'),
  opened: boolean('opened').notNull().default(false),
  clicked: boolean('clicked').notNull().default(false),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const supportVideos = mysqlTable('support_videos', {
  id: int('id').autoincrement().primaryKey(),
  productId: int('product_id'),
  title: varchar('title', { length: 200 }).notNull(),
  videoUrl: varchar('video_url', { length: 500 }).notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  locale: varchar('locale', { length: 10 }).default('en'),
  sortOrder: int('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
})

export const confirmationCodes = mysqlTable('confirmation_codes', {
  id: int('id').autoincrement().primaryKey(),
  orderId: int('order_id').notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  type: varchar('type', { length: 40 }).notNull().default('order'),
  expiresAt: timestamp('expires_at'),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
