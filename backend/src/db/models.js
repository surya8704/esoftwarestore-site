
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, maxlength: 180, unique: true },
  passwordHash: { type: String, required: true, maxlength: 255 },
  role: { type: String, required: true, maxlength: 30, default: 'customer' },
  countryCode: { type: String, maxlength: 2, default: 'IN' },
  locale: { type: String, maxlength: 10, default: 'en' },
  walletBalance: { type: Number, required: true, default: 0 },
  affiliateCode: { type: String, maxlength: 40 },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  socialProvider: { type: String, maxlength: 40 },
  createdAt: { type: Date, default: Date.now, required: true }
})

const vendorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true, maxlength: 160 },
  slug: { type: String, required: true, maxlength: 140, unique: true },
  email: { type: String, required: true, maxlength: 180 },
  commissionRate: { type: Number, required: true, default: 15 },
  active: { type: Boolean, required: true, default: true },
  createdAt: { type: Date, default: Date.now, required: true }
})

const vendorPayoutSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  amount: { type: Number, required: true },
  status: { type: String, required: true, maxlength: 30, default: 'pending' },
  reference: { type: String, maxlength: 120 },
  paidAt: Date,
  createdAt: { type: Date, default: Date.now, required: true }
})

const productSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  slug: { type: String, required: true, maxlength: 140, unique: true },
  name: { type: String, required: true, maxlength: 160 },
  category: { type: String, required: true, maxlength: 100 },
  price: { type: Number, required: true },
  originalPrice: { type: Number, required: true },
  rating: { type: Number, required: true },
  stock: { type: Number, required: true },
  licenseType: { type: String, required: true, maxlength: 80 },
  imageUrl: { type: String, maxlength: 500 },
  visualAccent: { type: String, required: true, maxlength: 80, default: 'from-sky-500 to-cyan-400' },
  description: String,
  hidePrice: { type: Boolean, required: true, default: false },
  hideCart: { type: Boolean, required: true, default: false },
  allowedCountries: String,
  blockedCountries: String,
  downloadUrl: { type: String, maxlength: 500 },
  videoUrl: { type: String, maxlength: 500 },
  active: { type: Boolean, required: true, default: true },
  createdAt: { type: Date, default: Date.now, required: true }
})

const productVariantSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true, maxlength: 120 },
  sku: { type: String, required: true, maxlength: 80, unique: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  tierMinQty: { type: Number, required: true, default: 1 },
  tierLabel: { type: String, maxlength: 80 },
  isDefault: { type: Boolean, required: true, default: false },
  active: { type: Boolean, required: true, default: true }
})

const licenseKeySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
  licenseKey: { type: String, required: true, maxlength: 200, unique: true },
  status: { type: String, required: true, maxlength: 20, default: 'available' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  assignedAt: Date,
  createdAt: { type: Date, default: Date.now, required: true }
})

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, maxlength: 40, unique: true },
  discountType: { type: String, required: true, maxlength: 20, default: 'percent' },
  discountValue: { type: Number, required: true },
  minAmount: { type: Number, required: true, default: 0 },
  maxUses: Number,
  usedCount: { type: Number, required: true, default: 0 },
  countryCodes: String,
  productIds: String,
  active: { type: Boolean, required: true, default: true },
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now, required: true }
})

const pricingRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 120 },
  countryCode: { type: String, maxlength: 2 },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
  minQty: { type: Number, required: true, default: 1 },
  priceOverride: Number,
  currency: { type: String, maxlength: 3, default: 'INR' },
  paymentMethods: String,
  shippingMode: { type: String, maxlength: 40, default: 'instant_digital' },
  active: { type: Boolean, required: true, default: true }
})

const cartSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, maxlength: 64, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, maxlength: 180 },
  countryCode: { type: String, maxlength: 2, default: 'IN' },
  currency: { type: String, maxlength: 3, default: 'INR' },
  couponCode: { type: String, maxlength: 40 },
  updatedAt: { type: Date, default: Date.now, required: true },
  createdAt: { type: Date, default: Date.now, required: true }
})

const cartItemSchema = new mongoose.Schema({
  cartId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
  quantity: { type: Number, required: true, default: 1 }
})

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sessionId: { type: String, maxlength: 64 },
  customerEmail: { type: String, required: true, maxlength: 180 },
  customerPhone: { type: String, maxlength: 40 },
  countryCode: { type: String, maxlength: 2, default: 'IN' },
  currency: { type: String, maxlength: 3, default: 'INR' },
  subtotal: { type: Number, required: true },
  discount: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true },
  couponCode: { type: String, maxlength: 40 },
  paymentStatus: { type: String, required: true, maxlength: 40 },
  orderStatus: { type: String, maxlength: 40, default: 'pending' },
  paymentMethod: { type: String, maxlength: 40 },
  razorpayOrderId: { type: String, maxlength: 120 },
  razorpayPaymentId: { type: String, maxlength: 120 },
  payuTxnId: { type: String, maxlength: 40 },
  payuPaymentId: { type: String, maxlength: 120 },
  stripePaymentId: { type: String, maxlength: 120 },
  stripeChargeId: { type: String, maxlength: 120 },
  refundAmount: { type: Number, default: 0 },
  refundId: { type: String, maxlength: 120 },
  refundReason: { type: String, maxlength: 500 },
  refundedAt: Date,
  confirmationCode: { type: String, maxlength: 20 },
  licenseKey: { type: String, maxlength: 200 },
  emailSent: { type: Boolean, required: true, default: false },
  whatsappSent: { type: Boolean, required: true, default: false },
  affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Affiliate' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  amount: Number,
  orderNotes: { type: String, maxlength: 500 },
  billing: {
    firstName: { type: String, maxlength: 80 },
    lastName: { type: String, maxlength: 80 },
    streetAddress: { type: String, maxlength: 200 },
    addressLine2: { type: String, maxlength: 120 },
    city: { type: String, maxlength: 80 },
    state: { type: String, maxlength: 80 },
    postalCode: { type: String, maxlength: 20 },
  },
  createdAt: { type: Date, default: Date.now, required: true }
})

const orderItemSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
  productName: { type: String, required: true, maxlength: 160 },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  licenseKey: { type: String, maxlength: 200 },
  downloadUrl: { type: String, maxlength: 500 },
  keySentAt: Date,
})

const abandonedCartSchema = new mongoose.Schema({
  cartId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart', required: true },
  email: { type: String, maxlength: 180 },
  step: { type: String, required: true, maxlength: 40, default: 'cart' },
  followUpStage: { type: Number, required: true, default: 0 },
  lastEmailAt: Date,
  recovered: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, default: Date.now, required: true }
})

const newsletterSubscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, maxlength: 180, unique: true },
  locale: { type: String, maxlength: 10, default: 'en' },
  countryCode: { type: String, maxlength: 2 },
  confirmed: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, default: Date.now, required: true }
})

const pageViewSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, maxlength: 64 },
  path: { type: String, required: true, maxlength: 300 },
  referrer: { type: String, maxlength: 500 },
  countryCode: { type: String, maxlength: 2 },
  locale: { type: String, maxlength: 10 },
  userAgent: { type: String, maxlength: 300 },
  createdAt: { type: Date, default: Date.now, required: true }
})

const affiliateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true, maxlength: 40, unique: true },
  commissionRate: { type: Number, required: true, default: 10 },
  totalEarnings: { type: Number, required: true, default: 0 },
  active: { type: Boolean, required: true, default: true },
  createdAt: { type: Date, default: Date.now, required: true }
})

const walletTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true, maxlength: 40 },
  reference: { type: String, maxlength: 120 },
  createdAt: { type: Date, default: Date.now, required: true }
})

const emailLogSchema = new mongoose.Schema({
  toEmail: { type: String, required: true, maxlength: 180 },
  subject: { type: String, required: true, maxlength: 200 },
  template: { type: String, required: true, maxlength: 80 },
  status: { type: String, required: true, maxlength: 20, default: 'sent' },
  opened: { type: Boolean, required: true, default: false },
  clicked: { type: Boolean, required: true, default: false },
  metadata: String,
  createdAt: { type: Date, default: Date.now, required: true }
})

const supportVideoSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  title: { type: String, required: true, maxlength: 200 },
  videoUrl: { type: String, required: true, maxlength: 500 },
  thumbnailUrl: { type: String, maxlength: 500 },
  locale: { type: String, maxlength: 10, default: 'en' },
  sortOrder: { type: Number, required: true, default: 0 },
  active: { type: Boolean, required: true, default: true }
})

const confirmationCodeSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  code: { type: String, required: true, maxlength: 20, unique: true },
  type: { type: String, required: true, maxlength: 40, default: 'order' },
  expiresAt: Date,
  used: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, default: Date.now, required: true }
})

const orderNoteSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, maxlength: 120 },
  noteType: { type: String, required: true, maxlength: 20, default: 'private' },
  content: { type: String, required: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now, required: true }
})

export const User = mongoose.model('User', userSchema)
export const Vendor = mongoose.model('Vendor', vendorSchema)
export const VendorPayout = mongoose.model('VendorPayout', vendorPayoutSchema)
export const Product = mongoose.model('Product', productSchema)
export const ProductVariant = mongoose.model('ProductVariant', productVariantSchema)
export const LicenseKey = mongoose.model('LicenseKey', licenseKeySchema)
export const Coupon = mongoose.model('Coupon', couponSchema)
export const PricingRule = mongoose.model('PricingRule', pricingRuleSchema)
export const Cart = mongoose.model('Cart', cartSchema)
export const CartItem = mongoose.model('CartItem', cartItemSchema)
export const Order = mongoose.model('Order', orderSchema)
export const OrderItem = mongoose.model('OrderItem', orderItemSchema)
export const AbandonedCart = mongoose.model('AbandonedCart', abandonedCartSchema)
export const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema)
export const PageView = mongoose.model('PageView', pageViewSchema)
export const Affiliate = mongoose.model('Affiliate', affiliateSchema)
export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema)
export const EmailLog = mongoose.model('EmailLog', emailLogSchema)
export const SupportVideo = mongoose.model('SupportVideo', supportVideoSchema)
export const ConfirmationCode = mongoose.model('ConfirmationCode', confirmationCodeSchema)
export const OrderNote = mongoose.model('OrderNote', orderNoteSchema)

