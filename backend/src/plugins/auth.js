import { Vendor } from '../db/models.js'

export function registerAuth(app) {
  app.decorate('authenticate', async function authenticate(request, reply) {
    try { await request.jwtVerify() } catch { reply.unauthorized('Invalid or expired token') }
  })

  app.decorate('requireAdmin', async function requireAdmin(request, reply) {
    await app.authenticate(request, reply)
    if (reply.sent) return
    if (request.user.role !== 'admin') reply.forbidden('Admin access required')
  })

  app.decorate('requireVendor', async function requireVendor(request, reply) {
    await app.authenticate(request, reply)
    if (reply.sent) return
    if (request.user.role !== 'vendor' && request.user.role !== 'admin') reply.forbidden('Vendor access required')
  })

  app.decorate('requireStaff', async function requireStaff(request, reply) {
    await app.authenticate(request, reply)
    if (reply.sent) return
    if (request.user.role !== 'admin' && request.user.role !== 'vendor') {
      reply.forbidden('Admin or vendor access required')
    }
  })

  app.decorate('resolveVendorId', async function resolveVendorId(request, reply) {
    if (request.user.role === 'admin' && request.query?.vendorId) return request.query.vendorId
    const vendor = await Vendor.findOne({ userId: request.user.sub })
    if (!vendor) { reply.forbidden('No vendor account linked'); return null }
    return vendor._id.toString()
  })
}
