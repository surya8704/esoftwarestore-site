/** Curated Unsplash covers keyed by software keywords in the product name. */
const IMAGE_RULES = [
  { match: /autocad|auto\s*cad/i, images: [
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1487958449943-2429e8be8624?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /revit|bim|architecture/i, images: [
    'https://images.unsplash.com/photo-1487958449943-2429e8be8624?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /maya|mudbox|arnold|flame|3d|vfx|sculpt/i, images: [
    'https://images.unsplash.com/photo-1618005182384-a83fe53d284d?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /fusion|inventor|autodesk|navisworks|alias|forma|vehicle tracking|infodrainage|vault|recap/i, images: [
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /corel|draw|illustrator|photoshop|adobe|creative/i, images: [
    'https://images.unsplash.com/photo-1626785774573-4b7993143484?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /visual\s*studio|vs\s*20|ide|developer|coding/i, images: [
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /sql\s*server|database|server\s*20/i, images: [
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a2?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /windows\s*server|datacenter|server/i, images: [
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /windows/i, images: [
    'https://images.unsplash.com/photo-1629654297299-c8506221ca97?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /\boffice\b|microsoft\s*365|365|mak/i, images: [
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /\bexcel\b/i, images: [
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /\bword\b/i, images: [
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /powerpoint|power\s*point/i, images: [
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /outlook/i, images: [
    'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /visio/i, images: [
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /project\b/i, images: [
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',
  ]},
  { match: /antivirus|kaspersky|mcafee|norton|security|defender/i, images: [
    'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=900&q=80',
  ]},
]

const CATEGORY_IMAGES = {
  Windows: [
    'https://images.unsplash.com/photo-1629654297299-c8506221ca97?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?auto=format&fit=crop&w=900&q=80',
  ],
  'Microsoft Office': [
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=900&q=80',
  ],
  Design: [
    'https://images.unsplash.com/photo-1626785774573-4b7993143484?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=80',
  ],
  Antivirus: [
    'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=900&q=80',
  ],
  Server: [
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=80',
  ],
}

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80',
]

function hashKey(value) {
  const text = String(value ?? '')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return hash
}

function pickFrom(list, key) {
  if (!list?.length) return null
  return list[hashKey(key) % list.length]
}

export function getProductImageByName(productOrName, category = '', slug = '') {
  const name =
    typeof productOrName === 'string'
      ? productOrName
      : productOrName?.name ?? ''
  const cat =
    typeof productOrName === 'string'
      ? category
      : productOrName?.category ?? category
  const key =
    typeof productOrName === 'string'
      ? slug || name
      : productOrName?.slug || productOrName?.id || productOrName?._id || name

  const haystack = `${name} ${cat}`
  for (const rule of IMAGE_RULES) {
    if (rule.match.test(haystack)) {
      return pickFrom(rule.images, key)
    }
  }

  const byCategory = CATEGORY_IMAGES[cat]
  if (byCategory?.length) return pickFrom(byCategory, key)

  return pickFrom(DEFAULT_IMAGES, key)
}

export function isLegacyBrokenMediaUrl(url) {
  if (!url) return true
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return host === 'esoftwarestore.com'
  } catch {
    return true
  }
}

export function resolveStoreProductImage(product) {
  const custom = product?.imageUrl
  if (custom && !isLegacyBrokenMediaUrl(custom)) return custom
  return getProductImageByName(product)
}
