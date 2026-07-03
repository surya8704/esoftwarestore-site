import crypto from 'node:crypto'
import { config } from '../config.js'
import { Affiliate, User } from '../db/models.js'
import { hashPassword } from '../db/seed.js'

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

export async function authRoutes(app) {
  app.post('/api/auth/signup', async (request, reply) => {
    const { name, email, password, countryCode, locale } = request.body ?? {}
    const normalizedEmail = normalizeEmail(email)
    if (!name?.trim() || !normalizedEmail || !password) {
      throw app.httpErrors.badRequest('Name, email, and password are required')
    }
    if (password.length < 6) {
      throw app.httpErrors.badRequest('Password must be at least 6 characters')
    }

    const existing = await User.findOne({ email: normalizedEmail })
    if (existing) throw app.httpErrors.conflict('Email already registered')

    const affiliateCode = `REF${Date.now().toString(36).slice(-6).toUpperCase()}`
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      role: 'customer',
      countryCode: countryCode ?? 'IN',
      locale: locale ?? 'en',
      affiliateCode,
    })
    await Affiliate.create({ userId: user._id, code: affiliateCode })

    const token = await reply.jwtSign({ sub: user._id.toString(), email: user.email, role: user.role })
    return {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        affiliateCode,
      },
    }
  })

  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body ?? {}
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail || !password) {
      throw app.httpErrors.badRequest('Email and password are required')
    }

    const user = await User.findOne({ email: normalizedEmail })
    if (!user || user.passwordHash !== hashPassword(password)) {
      throw app.httpErrors.unauthorized('Incorrect email or password')
    }

    const token = await reply.jwtSign({ sub: user._id.toString(), email: user.email, role: user.role })
    return {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        walletBalance: user.walletBalance,
        affiliateCode: user.affiliateCode,
      },
    }
  })

  app.post('/api/auth/magic-link', async (request) => {
    const { email } = request.body ?? {}
    const token = crypto.randomBytes(24).toString('hex')
    return {
      message: 'Magic link sent',
      previewUrl: `${config.clientUrl}/auth/verify?token=${token}&email=${encodeURIComponent(normalizeEmail(email))}`,
    }
  })

  app.post('/api/auth/social', async (request, reply) => {
    const { provider, email, name } = request.body ?? {}
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail || !name?.trim()) {
      throw app.httpErrors.badRequest('Name and email are required')
    }

    let user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(crypto.randomBytes(16).toString('hex')),
        role: 'customer',
        socialProvider: provider,
        affiliateCode: `SOC${Date.now().toString(36).slice(-6).toUpperCase()}`,
      })
    }

    const token = await reply.jwtSign({ sub: user._id.toString(), email: user.email, role: user.role })
    return {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }
  })

  app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await User.findById(request.user.sub)
    if (!user) throw app.httpErrors.notFound('User not found')
    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        walletBalance: user.walletBalance,
        affiliateCode: user.affiliateCode,
        countryCode: user.countryCode,
        locale: user.locale,
      },
    }
  })
}
