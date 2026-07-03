import { z } from 'zod'
import { EmailLog, NewsletterSubscriber, PageView } from '../db/models.js'
import { sendNewsletterWelcome } from '../services/email.js'
import { processAbandonedCartFollowUps } from '../services/marketing.js'
import { validateCoupon } from '../services/pricing.js'

export async function marketingRoutes(app) {
  app.post('/api/track/page', async (request) => {
    const schema = z.object({
      path: z.string(),
      referrer: z.string().optional(),
      locale: z.string().optional(),
    })
    const payload = schema.parse(request.body)
    const sessionId = request.headers['x-session-id'] ?? 'anonymous'
    const country = request.headers['x-country'] ?? 'IN'

    await PageView.create({
      sessionId,
      path: payload.path,
      referrer: payload.referrer,
      countryCode: country,
      locale: payload.locale,
      userAgent: request.headers['user-agent']?.slice(0, 300),
    })

    return { tracked: true }
  })

  app.post('/api/newsletter/subscribe', async (request) => {
    const schema = z.object({
      email: z.string().email(),
      locale: z.string().optional(),
      countryCode: z.string().optional(),
    })
    const payload = schema.parse(request.body)

    try {
      await NewsletterSubscriber.create({
        email: payload.email,
        locale: payload.locale ?? 'en',
        countryCode: payload.countryCode,
        confirmed: true,
      })
    } catch {
      /* already subscribed */
    }

    await sendNewsletterWelcome({ email: payload.email })
    return { success: true }
  })

  app.post('/api/coupons/validate', async (request) => {
    const schema = z.object({
      code: z.string(),
      subtotal: z.number(),
      countryCode: z.string().default('IN'),
      productIds: z.array(z.string()).default([]),
    })
    const payload = schema.parse(request.body)
    return validateCoupon(payload.code, payload)
  })

  app.get('/api/email/track/open/:id', async (request, reply) => {
    await EmailLog.findByIdAndUpdate(request.params.id, { opened: true })
    return reply.type('image/gif').send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'))
  })

  app.post('/api/cron/abandoned-carts', async (request) => {
    const secret = request.headers['x-cron-secret']
    if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
      throw app.httpErrors.unauthorized('Invalid cron secret')
    }
    return processAbandonedCartFollowUps()
  })
}
