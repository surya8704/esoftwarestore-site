import mongoose from 'mongoose'
import { config } from '../config.js'

let memoryServer = null

export async function connectDB() {
  const options = {
    serverSelectionTimeoutMS: 15000,
    family: 4,
  }

  try {
    await mongoose.connect(config.mongoUrl, options)
    console.log('MongoDB connected (Atlas)')
    return
  } catch (error) {
    console.warn(`MongoDB Atlas connection failed: ${error.message}`)
    await mongoose.disconnect().catch(() => {})
  }

  if (process.env.NODE_ENV === 'production' || process.env.MONGO_MEMORY === '0') {
    throw new Error(
      'Could not connect to MongoDB Atlas. Check DATABASE_URL credentials in backend/.env',
    )
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server')
  memoryServer = await MongoMemoryServer.create()
  await mongoose.connect(memoryServer.getUri(), options)
  console.log('MongoDB connected (in-memory dev fallback)')
}

export function mapId(doc) {
  if (!doc) return null
  const obj = doc.toObject ? doc.toObject() : { ...doc }
  obj.id = obj._id?.toString?.() ?? obj.id
  return obj
}

export function mapIds(docs) {
  return docs.map(mapId)
}
