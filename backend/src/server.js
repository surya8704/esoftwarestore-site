import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import sensible from '@fastify/sensible'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { connectDB } from './db/client.js'
import { seedDatabase } from './db/seed.js'
import { registerAuth } from './plugins/auth.js'
import { adminRoutes, supportRoutes } from './routes/admin.js'
import { authRoutes } from './routes/auth.js'
import { cartRoutes } from './routes/cart.js'
import { checkoutRoutes } from './routes/checkout.js'
import { feedRoutes } from './routes/feeds.js'
import { marketingRoutes } from './routes/marketing.js'
import { productRoutes } from './routes/products.js'
import { guideRoutes } from './routes/guides.js'
import { uploadRoutes } from './routes/upload.js'
import { vendorRoutes } from './routes/vendor.js'
import { processAbandonedCartFollowUps } from './services/marketing.js'
import { pageRoutes } from './routes/pages.js'
import { ensureGuidesSeeded } from './lib/siteContent.js'
import { announcementRoutes } from './routes/announcements.js'
import { reviewRoutes } from './routes/reviews.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '..', 'uploads')

const app = Fastify({ logger: true })

await connectDB()

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (process.env.NODE_ENV !== 'production') return callback(null, true)
    const allowed = new Set(
      [config.clientUrl, ...(process.env.ALLOWED_ORIGINS?.split(',') ?? [])].filter(Boolean),
    )
    if (allowed.has(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true)
    }
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'X-Country', 'X-Currency', 'X-Locale'],
})
await app.register(sensible)
await app.register(jwt, { secret: config.jwtSecret })
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } })
await app.register(fastifyStatic, {
  root: uploadsDir,
  prefix: '/uploads/',
  decorateReply: false,
})
registerAuth(app)

app.get('/health', async () => ({ ok: true, version: '2.0.0' }))

await authRoutes(app)
await productRoutes(app)
await guideRoutes(app)
await pageRoutes(app)
await announcementRoutes(app)
await reviewRoutes(app)
await vendorRoutes(app)
await cartRoutes(app)
await checkoutRoutes(app)
await marketingRoutes(app)
await supportRoutes(app)
await adminRoutes(app)
await feedRoutes(app)
await uploadRoutes(app, { uploadsDir, apiPublicUrl: config.apiPublicUrl })

try {
  await seedDatabase()
  await ensureGuidesSeeded()
} catch (error) {
  app.log.warn({ err: error }, 'Database seed skipped')
}

setInterval(() => {
  processAbandonedCartFollowUps().catch((err) => app.log.error(err))
}, 60 * 60 * 1000)

app.listen({ port: config.port, host: '0.0.0.0' }).then(() => {
  app.log.info(`API running on port ${config.port}`)
  // Kick once shortly after boot so reminders don’t wait a full hour after deploys
  setTimeout(() => {
    processAbandonedCartFollowUps()
      .then((result) => app.log.info({ result }, 'Abandoned cart follow-up run'))
      .catch((err) => app.log.error(err))
  }, 15_000)
})
