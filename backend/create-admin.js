import mongoose from 'mongoose'
import { User } from './src/db/models.js'
import { hashPassword } from './src/db/seed.js'
import { config } from './src/config.js'

const adminEmail = 'info@esoftwarestore.com'
const adminPassword = 'Code11login..'

async function createAdmin() {
  try {
    await mongoose.connect(config.mongoUrl, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      },
    })
    console.log('Connected to MongoDB')

    const existing = await User.findOne({ email: adminEmail })
    if (existing) {
      existing.passwordHash = hashPassword(adminPassword)
      existing.role = 'admin'
      await existing.save()
      console.log('Admin user updated successfully!')
    } else {
      await User.create({
        name: 'Admin',
        email: adminEmail,
        passwordHash: hashPassword(adminPassword),
        role: 'admin',
        countryCode: 'IN',
        locale: 'en',
        walletBalance: 0,
        affiliateCode: 'ADMIN',
        socialProvider: null,
      })
      console.log('Admin user created successfully!')
    }

    console.log(`Email: ${adminEmail}`)
    process.exit(0)
  } catch (err) {
    console.error('Error creating admin:', err)
    process.exit(1)
  }
}

createAdmin()
