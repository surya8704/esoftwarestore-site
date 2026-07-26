import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { UploadedFile, Vendor } from '../db/models.js'
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

const ALLOWED_SUBDIRS = new Set(['products', 'guides', 'trust-badges'])

function resolveImageType(file) {
  const mime = String(file?.mimetype || '').toLowerCase().trim()
  if (ALLOWED_TYPES.has(mime)) {
    return { mime, ext: EXT_BY_MIME[mime] || 'jpg' }
  }

  // Windows / some browsers send WebP as empty or application/octet-stream
  const original = String(file?.filename || file?.fieldname || '')
  const rawExt = path.extname(original).replace(/^\./, '').toLowerCase()
  const mimeFromExt = MIME_BY_EXT[rawExt]
  if (mimeFromExt && (!mime || mime === 'application/octet-stream' || mime === 'binary/octet-stream')) {
    return { mime: mimeFromExt, ext: EXT_BY_MIME[mimeFromExt] || rawExt }
  }
  if (mimeFromExt) {
    return { mime: mimeFromExt, ext: EXT_BY_MIME[mimeFromExt] || rawExt }
  }

  return null
}

function mimeFromFilename(filename) {
  const ext = path.extname(filename).replace(/^\./, '').toLowerCase()
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

async function readUploadBuffer(fileStream) {
  const chunks = []
  for await (const chunk of fileStream) chunks.push(chunk)
  return Buffer.concat(chunks)
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
    const buffer = await readUploadBuffer(file.file)

    // Disk cache (may be wiped on Render free tier) + MongoDB (persistent)
    await fs.writeFile(dest, buffer)
    await UploadedFile.findOneAndUpdate(
      { subdir, filename },
      {
        subdir,
        filename,
        mime: resolved.mime,
        data: buffer,
        size: buffer.length,
        createdAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    const imageUrl = `${apiPublicUrl}/uploads/${subdir}/${filename}`
    return { imageUrl, filename }
  }

  // Persistent serve: disk first, then MongoDB (survives Render redeploys)
  app.get('/uploads/:subdir/:filename', async (request, reply) => {
    const subdir = String(request.params.subdir || '')
    const filename = String(request.params.filename || '')
    if (!ALLOWED_SUBDIRS.has(subdir) || !filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return reply.code(404).send({ error: 'Not found' })
    }

    const diskPath = path.join(uploadsDir, subdir, filename)
    try {
      await fs.access(diskPath)
      reply
        .type(mimeFromFilename(filename))
        .header('Cache-Control', 'public, max-age=31536000, immutable')
      return reply.send(createReadStream(diskPath))
    } catch {
      // fall through to MongoDB
    }

    const doc = await UploadedFile.findOne({ subdir, filename }).lean()
    if (!doc?.data) {
      return reply.code(404).send({ error: 'Not found' })
    }

    const payload = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data.buffer || doc.data)
    return reply
      .type(doc.mime || mimeFromFilename(filename))
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('Content-Length', String(payload.length))
      .send(payload)
  })

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
