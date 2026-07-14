import crypto from 'node:crypto'
import { loadCatalog } from '../data/loadCatalog.js'
import {
  Affiliate,
  Coupon,
  Product,
  ProductVariant,
  SupportVideo,
  User,
  Vendor,
} from './models.js'
import { seedLicensePool } from '../services/license.js'

export const hashPassword = (value) =>
  crypto.createHash('sha256').update(value).digest('hex')

export async function seedDatabase() {
  const catalog = loadCatalog()
  const productCount = await Product.countDocuments()
  if (productCount === 0) {
    for (const item of catalog) {
      const product = await Product.create({
        slug: item.slug,
        name: item.name,
        category: item.category,
        price: item.price,
        originalPrice: item.originalPrice,
        rating: item.rating > 0 ? item.rating : 45,
        stock: item.stock ?? 10,
        licenseType: item.licenseType ?? 'Lifetime',
        imageUrl: item.imageUrl,
        visualAccent: item.visualAccent ?? 'from-sky-500 to-cyan-400',
        description: item.description,
        downloadUrl: item.downloadUrl,
      })

      await ProductVariant.create({
        productId: product._id,
        name: 'Standard',
        sku: `${item.slug}-std`,
        price: item.price,
        originalPrice: item.originalPrice,
        stock: item.stock ?? 10,
        tierMinQty: 1,
        tierLabel: '1 License',
        isDefault: true,
      })

      await seedLicensePool(product._id, 0)
    }
  }

  // Products without an allowlist are visible worldwide (only blockedCountries restricts)
  await Product.updateMany({}, { $unset: { allowedCountries: 1 } })

  if ((await Coupon.countDocuments()) === 0) {
    await Coupon.insertMany([
      { code: 'SAVE10', discountType: 'percent', discountValue: 10, minAmount: 500 },
      { code: 'WELCOME15', discountType: 'percent', discountValue: 15, minAmount: 1000 },
      { code: 'FLAT200', discountType: 'fixed', discountValue: 200, minAmount: 1500 },
    ])
  }

  let officialVendor = await Vendor.findOne({ slug: 'esoftware-official' })
  if (!officialVendor) {
    officialVendor = await Vendor.create({
      name: 'eSoftware Official',
      slug: 'esoftware-official',
      email: 'vendor@esoftware.store',
      commissionRate: 0,
    })
  }

  await Product.updateMany({ vendorId: null }, { vendorId: officialVendor._id })

  const vendorEmail = 'vendor@demo.store'
  let vendorUser = await User.findOne({ email: vendorEmail })
  if (!vendorUser) {
    vendorUser = await User.create({
      name: 'Demo Vendor',
      email: vendorEmail,
      passwordHash: hashPassword('Vendor@123'),
      role: 'vendor',
    })
    const existingVendor = await Vendor.findOne({ slug: 'demo-licenses' })
    if (!existingVendor) {
      await Vendor.create({
        userId: vendorUser._id,
        name: 'Demo Licenses Co',
        slug: 'demo-licenses',
        email: vendorEmail,
        commissionRate: 15,
      })
    }
  }

  await SupportVideo.deleteMany({})

  const adminEmail = 'info@esoftwarestore.com'
  const adminPassword = 'Code11login..'
  const legacyAdminEmail = 'admin@esoftware.store'

  const legacyAdmin = await User.findOne({ email: legacyAdminEmail })
  if (legacyAdmin) {
    legacyAdmin.email = adminEmail
    legacyAdmin.passwordHash = hashPassword(adminPassword)
    legacyAdmin.role = 'admin'
    await legacyAdmin.save()
  }

  let admin = await User.findOne({ email: adminEmail })
  if (!admin) {
    admin = await User.create({
      name: 'Admin',
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: 'admin',
      affiliateCode: 'ADMIN',
    })
    await Affiliate.create({ userId: admin._id, code: 'ADMIN', commissionRate: 0 })
  }
}
