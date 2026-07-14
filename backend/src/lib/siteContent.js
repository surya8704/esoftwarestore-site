import { LEGAL_PAGE_DEFAULTS, LEGAL_PAGE_KEYS } from '../data/legalDefaults.js'
import { Guide, SitePage } from '../db/models.js'
import { loadGuides } from '../data/loadGuides.js'

export { LEGAL_PAGE_KEYS }

function mapPage(doc) {
  if (!doc) return null
  return {
    key: doc.key,
    title: doc.title,
    description: doc.description ?? '',
    updatedLabel: doc.updatedLabel ?? '',
    sections: (doc.sections ?? []).map((section) => ({
      title: section.title,
      paragraphs: section.paragraphs ?? [],
      list: section.list ?? [],
      links: (section.links ?? []).map((link) => ({ label: link.label, to: link.to })),
    })),
    updatedAt: doc.updatedAt ?? null,
  }
}

export async function ensureSitePage(key) {
  if (!LEGAL_PAGE_DEFAULTS[key]) return null
  let page = await SitePage.findOne({ key })
  if (!page) {
    const defaults = LEGAL_PAGE_DEFAULTS[key]
    page = await SitePage.create({
      key: defaults.key,
      title: defaults.title,
      description: defaults.description,
      updatedLabel: defaults.updatedLabel,
      sections: defaults.sections,
    })
  }
  return page
}

export async function getPublicSitePage(key) {
  if (!LEGAL_PAGE_DEFAULTS[key]) return null
  const page = await ensureSitePage(key)
  return mapPage(page)
}

export async function listAdminSitePages() {
  const pages = []
  for (const key of LEGAL_PAGE_KEYS) {
    const page = await ensureSitePage(key)
    pages.push(mapPage(page))
  }
  return pages
}

export async function updateSitePage(key, payload) {
  if (!LEGAL_PAGE_DEFAULTS[key]) return null
  const page = await ensureSitePage(key)
  if (payload.title !== undefined) page.title = String(payload.title).trim()
  if (payload.description !== undefined) page.description = String(payload.description).trim()
  if (payload.updatedLabel !== undefined) page.updatedLabel = String(payload.updatedLabel).trim()
  if (payload.sections !== undefined) {
    page.sections = (payload.sections ?? []).map((section) => ({
      title: String(section.title ?? '').trim(),
      paragraphs: (section.paragraphs ?? []).map((p) => String(p).trim()).filter(Boolean),
      list: (section.list ?? []).map((item) => String(item).trim()).filter(Boolean),
      links: (section.links ?? [])
        .filter((link) => link?.label && link?.to)
        .map((link) => ({ label: String(link.label).trim(), to: String(link.to).trim() })),
    }))
  }
  page.updatedAt = new Date()
  await page.save()
  return mapPage(page)
}

export async function resetSitePage(key) {
  const defaults = LEGAL_PAGE_DEFAULTS[key]
  if (!defaults) return null
  await SitePage.findOneAndDelete({ key })
  const page = await SitePage.create({
    key: defaults.key,
    title: defaults.title,
    description: defaults.description,
    updatedLabel: defaults.updatedLabel,
    sections: defaults.sections,
  })
  return mapPage(page)
}

function mapGuide(doc) {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    externalId: doc.externalId ?? null,
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt ?? '',
    contentHtml: doc.contentHtml ?? '',
    publishedAt: doc.publishedAt ?? null,
    modifiedAt: doc.modifiedAt ?? null,
    imageUrl: doc.imageUrl ?? '',
    categories: doc.categories ?? [],
    categorySlugs: doc.categorySlugs ?? [],
    sourceUrl: doc.sourceUrl ?? '',
    active: doc.active !== false,
  }
}

export function slugifyGuide(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140)
}

export async function ensureGuidesSeeded() {
  const count = await Guide.countDocuments()
  if (count > 0) return count
  const raw = loadGuides()
  if (!raw.length) return 0
  const docs = raw.map((g) => ({
    externalId: g.externalId != null ? String(g.externalId) : undefined,
    slug: g.slug,
    title: g.title,
    excerpt: g.excerpt ?? '',
    contentHtml: g.contentHtml ?? '',
    publishedAt: g.publishedAt ? new Date(g.publishedAt) : new Date(),
    modifiedAt: g.modifiedAt ? new Date(g.modifiedAt) : new Date(),
    imageUrl: g.imageUrl ?? '',
    categories: g.categories ?? [],
    categorySlugs: g.categorySlugs ?? [],
    sourceUrl: g.sourceUrl ?? '',
    active: true,
  }))
  await Guide.insertMany(docs, { ordered: false }).catch(() => {})
  return Guide.countDocuments()
}

export async function listPublicGuides() {
  await ensureGuidesSeeded()
  const guides = await Guide.find({ active: true }).sort({ publishedAt: -1 }).lean()
  return guides.map(mapGuide)
}

export async function findPublicGuideBySlug(slug) {
  await ensureGuidesSeeded()
  const guide = await Guide.findOne({ slug, active: true })
  return mapGuide(guide)
}

export async function listAdminGuides() {
  await ensureGuidesSeeded()
  const guides = await Guide.find({}).sort({ publishedAt: -1 })
  return guides.map(mapGuide)
}

export async function getAdminGuide(id) {
  const guide = await Guide.findById(id)
  return mapGuide(guide)
}

export async function createGuide(payload) {
  const title = String(payload.title ?? '').trim()
  if (!title) throw new Error('Title is required')
  let slug = slugifyGuide(payload.slug || title)
  if (!slug) throw new Error('Slug is required')
  const existing = await Guide.findOne({ slug })
  if (existing) throw new Error('A guide with this slug already exists')

  const categories = Array.isArray(payload.categories)
    ? payload.categories.map((c) => String(c).trim()).filter(Boolean)
    : String(payload.categories ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
  const categorySlugs = categories.map((c) => slugifyGuide(c))

  const guide = await Guide.create({
    title,
    slug,
    excerpt: String(payload.excerpt ?? '').trim(),
    contentHtml: String(payload.contentHtml ?? ''),
    imageUrl: String(payload.imageUrl ?? '').trim(),
    categories,
    categorySlugs,
    sourceUrl: String(payload.sourceUrl ?? '').trim(),
    publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : new Date(),
    modifiedAt: new Date(),
    active: payload.active !== false,
  })
  return mapGuide(guide)
}

export async function updateGuide(id, payload) {
  const guide = await Guide.findById(id)
  if (!guide) return null

  if (payload.title !== undefined) guide.title = String(payload.title).trim()
  if (payload.slug !== undefined) {
    const slug = slugifyGuide(payload.slug)
    if (!slug) throw new Error('Slug is required')
    const clash = await Guide.findOne({ slug, _id: { $ne: guide._id } })
    if (clash) throw new Error('A guide with this slug already exists')
    guide.slug = slug
  }
  if (payload.excerpt !== undefined) guide.excerpt = String(payload.excerpt).trim()
  if (payload.contentHtml !== undefined) guide.contentHtml = String(payload.contentHtml)
  if (payload.imageUrl !== undefined) guide.imageUrl = String(payload.imageUrl).trim()
  if (payload.sourceUrl !== undefined) guide.sourceUrl = String(payload.sourceUrl).trim()
  if (payload.active !== undefined) guide.active = Boolean(payload.active)
  if (payload.publishedAt !== undefined) {
    guide.publishedAt = payload.publishedAt ? new Date(payload.publishedAt) : guide.publishedAt
  }
  if (payload.categories !== undefined) {
    const categories = Array.isArray(payload.categories)
      ? payload.categories.map((c) => String(c).trim()).filter(Boolean)
      : String(payload.categories ?? '')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
    guide.categories = categories
    guide.categorySlugs = categories.map((c) => slugifyGuide(c))
  }
  guide.modifiedAt = new Date()
  await guide.save()
  return mapGuide(guide)
}

export async function deleteGuide(id) {
  const guide = await Guide.findByIdAndDelete(id)
  return Boolean(guide)
}
