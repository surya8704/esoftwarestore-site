import { z } from 'zod'
import { mapId } from '../db/client.js'
import { Announcement } from '../db/models.js'

function mapAnnouncement(doc) {
  return {
    ...mapId(doc),
    title: doc.title,
    message: doc.message,
    linkUrl: doc.linkUrl || '',
    linkLabel: doc.linkLabel || '',
    active: doc.active !== false,
    pinned: Boolean(doc.pinned),
    startsAt: doc.startsAt ?? null,
    endsAt: doc.endsAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function isCurrentlyVisible(announcement, now = new Date()) {
  if (!announcement.active) return false
  if (announcement.startsAt && new Date(announcement.startsAt) > now) return false
  if (announcement.endsAt && new Date(announcement.endsAt) < now) return false
  return true
}

const announcementBodySchema = z.object({
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(400),
  linkUrl: z.string().trim().max(500).optional().nullable(),
  linkLabel: z.string().trim().max(80).optional().nullable(),
  active: z.boolean().optional().default(true),
  pinned: z.boolean().optional().default(false),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
})

function parseOptionalDate(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export async function announcementRoutes(app) {
  app.get('/api/announcements', async () => {
    const now = new Date()
    const items = await Announcement.find({ active: true })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(40)
      .lean()

    const announcements = items
      .filter((item) => isCurrentlyVisible(item, now))
      .slice(0, 12)
      .map(mapAnnouncement)

    return { announcements }
  })

  app.get('/api/admin/announcements', { preHandler: [app.requireAdmin] }, async () => {
    const items = await Announcement.find().sort({ pinned: -1, createdAt: -1 }).limit(200)
    return { announcements: items.map(mapAnnouncement) }
  })

  app.post('/api/admin/announcements', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const payload = announcementBodySchema.parse(request.body ?? {})
    const announcement = await Announcement.create({
      title: payload.title,
      message: payload.message,
      linkUrl: payload.linkUrl || '',
      linkLabel: payload.linkLabel || '',
      active: payload.active !== false,
      pinned: Boolean(payload.pinned),
      startsAt: parseOptionalDate(payload.startsAt) ?? null,
      endsAt: parseOptionalDate(payload.endsAt) ?? null,
      updatedAt: new Date(),
    })
    return reply.code(201).send({ announcement: mapAnnouncement(announcement) })
  })

  app.put('/api/admin/announcements/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const payload = announcementBodySchema.parse(request.body ?? {})
    const announcement = await Announcement.findById(request.params.id)
    if (!announcement) return reply.code(404).send({ message: 'Announcement not found' })

    announcement.title = payload.title
    announcement.message = payload.message
    announcement.linkUrl = payload.linkUrl || ''
    announcement.linkLabel = payload.linkLabel || ''
    announcement.active = payload.active !== false
    announcement.pinned = Boolean(payload.pinned)
    if (payload.startsAt !== undefined) announcement.startsAt = parseOptionalDate(payload.startsAt)
    if (payload.endsAt !== undefined) announcement.endsAt = parseOptionalDate(payload.endsAt)
    announcement.updatedAt = new Date()
    await announcement.save()

    return { announcement: mapAnnouncement(announcement) }
  })

  app.patch('/api/admin/announcements/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      active: z.boolean().optional(),
      pinned: z.boolean().optional(),
    })
    const payload = schema.parse(request.body ?? {})
    const announcement = await Announcement.findById(request.params.id)
    if (!announcement) return reply.code(404).send({ message: 'Announcement not found' })
    if (payload.active !== undefined) announcement.active = payload.active
    if (payload.pinned !== undefined) announcement.pinned = payload.pinned
    announcement.updatedAt = new Date()
    await announcement.save()
    return { announcement: mapAnnouncement(announcement) }
  })

  app.delete('/api/admin/announcements/:id', { preHandler: [app.requireAdmin] }, async (request, reply) => {
    const announcement = await Announcement.findByIdAndDelete(request.params.id)
    if (!announcement) return reply.code(404).send({ message: 'Announcement not found' })
    return { ok: true }
  })
}
