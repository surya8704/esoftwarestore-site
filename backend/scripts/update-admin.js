import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { User } from '../src/db/models.js'
import { hashPassword } from '../src/db/seed.js'
import { config } from '../src/config.js'

dotenv.config()

const adminEmail = 'info@esoftwarestore.com'
const adminPassword = 'Code11login..'
const legacyAdminEmail = 'admin@esoftware.store'

await mongoose.connect(config.mongoUrl)

const legacyAdmin = await User.findOne({ email: legacyAdminEmail })
if (legacyAdmin) {
  legacyAdmin.email = adminEmail
  legacyAdmin.passwordHash = hashPassword(adminPassword)
  legacyAdmin.role = 'admin'
  await legacyAdmin.save()
  console.log(`Migrated ${legacyAdminEmail} → ${adminEmail}`)
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
  console.log(`Created admin: ${adminEmail}`)
} else {
  admin.passwordHash = hashPassword(adminPassword)
  admin.role = 'admin'
  await admin.save()
  console.log(`Updated password for: ${adminEmail}`)
}

await mongoose.disconnect()
console.log('Done.')
