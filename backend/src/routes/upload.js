import crypto from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const extForMime = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function uploadRoutes(app, { uploadsDir, apiPublicUrl }) {
  const productsDir = path.join(uploadsDir, 'products')
  await fs.mkdir(productsDir, { recursive: true })

  app.post('/api/upload/product-image', { preHandler: [app.requireStaff] }, async (request) => {
    const file = await request.file()
    if (!file) throw app.httpErrors.badRequest('No image file provided')
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw app.httpErrors.badRequest('Only JPEG, PNG, WebP, and GIF images are allowed')
    }

    const ext = extForMime[file.mimetype] ?? 'jpg'
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`
    const dest = path.join(productsDir, filename)
    await pipeline(file.file, createWriteStream(dest))

    const imageUrl = `${apiPublicUrl}/uploads/products/${filename}`
    return { imageUrl, filename }
  })
}
