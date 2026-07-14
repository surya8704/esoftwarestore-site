import { Vendor } from '../db/models.js'
import { normalizeVendorPermissions, vendorHasPermission } from '../lib/vendorPermissions.js'

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
    if (request.user.role !== 'vendor' && request.user.role !== 'admin') {
      reply.forbidden('Vendor access required')
    }
  })

  app.decorate('requireStaff', async function requireStaff(request, reply) {
    await app.authenticate(request, reply)
    if (reply.sent) return
    if (request.user.role !== 'admin' && request.user.role !== 'vendor') {
      reply.forbidden('Admin or vendor access required')
    }
  })

  /**
   * Resolves vendor id, loads vendor onto request.vendorContext, and blocks inactive vendors.
   * Admins may impersonate via ?vendorId=.
   */
  app.decorate('resolveVendorId', async function resolveVendorId(request, reply) {
    let vendor = null

    if (request.user.role === 'admin' && request.query?.vendorId) {
      vendor = await Vendor.findById(request.query.vendorId)
      if (!vendor) {
        reply.notFound('Vendor not found')
        return null
      }
    } else if (request.user.role === 'admin' && !request.query?.vendorId) {
      // Admin hitting vendor routes without vendorId — still allowed for /me? No, they need a vendor link
      // Keep previous behavior: look up linked vendor account if admin somehow has one
      vendor = await Vendor.findOne({ userId: request.user.sub })
      if (!vendor) {
        reply.forbidden('Pass vendorId query when acting as a vendor from admin')
        return null
      }
    } else {
      vendor = await Vendor.findOne({ userId: request.user.sub })
      if (!vendor) {
        reply.forbidden('No vendor account linked')
        return null
      }
      if (!vendor.active) {
        reply.forbidden('This vendor account is deactivated. Contact the platform admin.')
        return null
      }
    }

    const permissions = normalizeVendorPermissions(vendor.permissions)
    request.vendorContext = {
      vendor,
      vendorId: vendor._id.toString(),
      permissions,
    }
    return vendor._id.toString()
  })

  app.decorate('requireVendorPermission', (permissionKey) => (
    async function checkVendorPermission(request, reply) {
      await app.requireVendor(request, reply)
      if (reply.sent) return
      // Admins bypass permission checks when managing via vendor APIs
      if (request.user.role === 'admin') {
        const vendorId = await app.resolveVendorId(request, reply)
        if (!vendorId) return
        return
      }
      const vendorId = await app.resolveVendorId(request, reply)
      if (!vendorId) return
      if (!vendorHasPermission(request.vendorContext?.permissions, permissionKey)) {
        reply.forbidden(`Permission required: ${permissionKey}`)
      }
    }
  ))
}
