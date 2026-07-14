import crypto from 'node:crypto'
import { z } from 'zod'
import { config } from '../config.js'
import { Affiliate, User } from '../db/models.js'
import { hashPassword } from '../db/seed.js'
import { verifyGoogleIdToken } from '../lib/googleAuth.js'
import { verifyFacebookAccessToken } from '../lib/facebookAuth.js'

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function userPayload(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    walletBalance: user.walletBalance,
    affiliateCode: user.affiliateCode,
    countryCode: user.countryCode,
    locale: user.locale,
    socialProvider: user.socialProvider ?? null,
  }
}

async function createCustomerWithAffiliate({
  name,
  email,
  passwordHash,
  countryCode,
  locale,
  socialProvider,
  googleId,
  facebookId,
}) {
  const affiliateCode = `REF${Date.now().toString(36).slice(-6).toUpperCase()}`
  const user = await User.create({
    name: name.trim(),
    email,
    passwordHash,
    role: 'customer',
    countryCode: countryCode ?? 'IN',
    locale: locale ?? 'en',
    affiliateCode,
    socialProvider,
    googleId,
    facebookId,
  })
  await Affiliate.create({ userId: user._id, code: affiliateCode })
  return user
}

async function signInResponse(reply, user) {
  const token = await reply.jwtSign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    { expiresIn: '30d' },
  )
  return { token, user: userPayload(user) }
}

async function findOrLinkSocialUser({
  provider,
  profileIdField,
  profileId,
  email,
  name,
  countryCode,
  locale,
}) {
  let user =
    (await User.findOne({ [profileIdField]: profileId })) ||
    (await User.findOne({ email }))

  if (!user) {
    user = await createCustomerWithAffiliate({
      name,
      email,
      passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
      countryCode: countryCode ?? config.defaultCountry,
      locale: locale ?? config.defaultLocale,
      socialProvider: provider,
      [profileIdField]: profileId,
    })
    return user
  }

  let dirty = false
  if (!user[profileIdField]) {
    user[profileIdField] = profileId
    dirty = true
  }
  if (!user.socialProvider) {
    user.socialProvider = provider
    dirty = true
  }
  if (dirty) await user.save()
  return user
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

    const user = await createCustomerWithAffiliate({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      countryCode,
      locale,
    })

    return signInResponse(reply, user)
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

    return signInResponse(reply, user)
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
    const schema = z.object({
      provider: z.enum(['google', 'facebook']),
      idToken: z.string().min(20).optional(),
      accessToken: z.string().min(20).optional(),
      countryCode: z.string().length(2).optional(),
      locale: z.string().max(10).optional(),
    })
    const payload = schema.parse(request.body)

    try {
      if (payload.provider === 'google') {
        if (!config.googleClientId) {
          throw app.httpErrors.badRequest('Google login is not configured. Set GOOGLE_CLIENT_ID on the server.')
        }
        if (!payload.idToken) throw app.httpErrors.badRequest('Google idToken is required')

        const profile = await verifyGoogleIdToken(payload.idToken, config.googleClientId)
        const user = await findOrLinkSocialUser({
          provider: 'google',
          profileIdField: 'googleId',
          profileId: profile.googleId,
          email: profile.email,
          name: profile.name,
          countryCode: payload.countryCode,
          locale: payload.locale,
        })
        return signInResponse(reply, user)
      }

      if (payload.provider === 'facebook') {
        if (!config.facebookAppId || !config.facebookAppSecret) {
          throw app.httpErrors.badRequest('Facebook login is not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.')
        }
        if (!payload.accessToken) throw app.httpErrors.badRequest('Facebook accessToken is required')

        const profile = await verifyFacebookAccessToken(payload.accessToken, {
          appId: config.facebookAppId,
          appSecret: config.facebookAppSecret,
        })
        const user = await findOrLinkSocialUser({
          provider: 'facebook',
          profileIdField: 'facebookId',
          profileId: profile.facebookId,
          email: profile.email,
          name: profile.name,
          countryCode: payload.countryCode,
          locale: payload.locale,
        })
        return signInResponse(reply, user)
      }

      throw app.httpErrors.badRequest('Unsupported social provider')
    } catch (err) {
      if (err.statusCode) throw err
      throw app.httpErrors.unauthorized(err.message || 'Social sign-in failed')
    }
  })

  app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await User.findById(request.user.sub)
    if (!user) throw app.httpErrors.notFound('User not found')
    return { user: userPayload(user) }
  })
}
