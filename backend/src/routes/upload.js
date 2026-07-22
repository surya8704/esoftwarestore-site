import crypto from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Vendor } from '../db/models.js'
import { normalizeVendorPermissions, vendorHasPermission } from '../lib/vendorPermissions.js'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/x-webp',
  'image/gif',
])

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  wepg: 'image/webp', // common typo of .webp
  gif: 'image/gif',
}

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/x-webp': 'webp',
  'image/gif': 'gif',
}

function resolveImageType(file) {
  const mime = String(file?.mimetype || '').toLowerCase().trim()
  if (ALLOWED_TYPES.has(mime)) {
    return { mime, ext: EXT_BY_MIME[mime] || 'jpg' }
  }

  const original = String(file?.filename || file?.fieldname || '')
  const rawExt = path.extname(original).replace(/^\./, '').toLowerCase()
  const mimeFromExt = MIME_BY_EXT[rawExt]
  if (mimeFromExt) {
    return { mime: mimeFromExt, ext: EXT_BY_MIME[mimeFromExt] || rawExt }
  }

  return null
}

export async function uploadRoutes(app, { uploadsDir, apiPublicUrl }) {
  const productsDir = path.join(uploadsDir, 'products')
  const guidesDir = path.join(uploadsDir, 'guides')
  const trustBadgesDir = path.join(uploadsDir, 'trust-badges')
  await fs.mkdir(productsDir, { recursive: true })
  await fs.mkdir(guidesDir, { recursive: true })
  await fs.mkdir(trustBadgesDir, { recursive: true })

  async function saveImageUpload(file, subdir) {
    if (!file) throw app.httpErrors.badRequest('No image file provided')
    const resolved = resolveImageType(file)
    if (!resolved) {
      throw app.httpErrors.badRequest('Only JPEG, PNG, WebP, and GIF images are allowed')
    }

    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${resolved.ext}`
    const dest = path.join(uploadsDir, subdir, filename)
    await pipeline(file.file, createWriteStream(dest))

    const imageUrl = `${apiPublicUrl}/uploads/${subdir}/${filename}`
    return { imageUrl, filename }
  }

  app.post('/api/upload/product-image', { preHandler: [app.requireStaff] }, async (request) => {
    if (request.user.role === 'vendor') {
      const vendor = await Vendor.findOne({ userId: request.user.sub })
      if (!vendor || !vendor.active) {
        throw app.httpErrors.forbidden('Vendor account is inactive or missing')
      }
      const permissions = normalizeVendorPermissions(vendor.permissions)
      if (!vendorHasPermission(permissions, 'canUploadImages')) {
        throw app.httpErrors.forbidden('You do not have permission to upload images')
      }
    }

    const file = await request.file()
    return saveImageUpload(file, 'products')
  })

  app.post('/api/upload/guide-image', { preHandler: [app.requireAdmin] }, async (request) => {
    const file = await request.file()
    return saveImageUpload(file, 'guides')
  })

  app.post('/api/upload/trust-badge-image', { preHandler: [app.requireAdmin] }, async (request) => {
    const file = await request.file()
    return saveImageUpload(file, 'trust-badges')
  })


  app.get('/api/media/product-cover', async (request, reply) => {
    const { buildProductCoverSvg } = await import('../lib/productImages.js')
    const name = String(request.query?.name ?? 'Software')
    const category = String(request.query?.category ?? '')
    const slug = String(request.query?.slug ?? '')
    const productType = String(request.query?.productType ?? '')
    const svg = buildProductCoverSvg({ name, category, slug, productType })
    reply
      .header('Content-Type', 'image/svg+xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      .send(svg)
  })
}
