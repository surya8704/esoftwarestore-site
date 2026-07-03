
import crypto from 'crypto'
import { User } from './src/db/models.js'
import mongoose from 'mongoose'
import { config } from './src/config.js'

async function createAdmin() {
  try {
    await mongoose.connect(config.mongoUrl, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      }
    })
    console.log('Connected to MongoDB')

    const password = 'Admin@123'
    const passwordHash = crypto.pbkdf2Sync(password, 'salt', 100000, 64, 'sha512').toString('hex')

    const admin = new User({
      name: 'Admin',
      email: 'admin@esoftware.store',
      passwordHash,
      role: 'admin',
      countryCode: 'IN',
      locale: 'en',
      walletBalance: 0,
      affiliateCode: 'ADMIN123',
      socialProvider: null,
    })

    await admin.save()
    console.log('Admin user created successfully!')
    console.log('Email: admin@esoftware.store')
    console.log('Password: Admin@123')
    process.exit(0)
  } catch (err) {
    console.error('Error creating admin:', err)
    process.exit(1)
  }
}

createAdmin()
