function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function hashKey(value) {
  let hash = 0
  const text = String(value ?? '')
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash
}

function shortenTitle(name = '') {
  return String(name)
    .replace(/[“”"]/g, '')
    .replace(/\s*[|–—-]\s*.*$/, '')
    .replace(/\s*:\s*.*$/, '')
    .replace(/\b(Everything You Need to Know About|Complete Guide to|Step-by-Step|for Seamless|Advanced|Professional|Comprehensive)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48)
}

function brandFromName(name = '', category = '') {
  const text = `${name} ${category}`.toLowerCase()

  if (/autocad|auto\s*cad/.test(text)) {
    return {
      brand: 'Autodesk',
      product: 'AutoCAD',
      from: '#0E5A8A',
      to: '#00E0C6',
      accent: '#FFFFFF',
      icon: 'cad',
    }
  }
  if (/revit|bim/.test(text)) {
    return { brand: 'Autodesk', product: 'Revit', from: '#1F4E79', to: '#3AA6D9', accent: '#FFF', icon: 'building' }
  }
  if (/maya|mudbox|arnold|flame/.test(text)) {
    return { brand: 'Autodesk', product: 'Media & Entertainment', from: '#111827', to: '#7C3AED', accent: '#FFF', icon: '3d' }
  }
  if (/fusion|inventor|navisworks|alias|forma|vault|recap|autodesk/.test(text)) {
    return { brand: 'Autodesk', product: 'Design Suite', from: '#0696D7', to: '#0B3C5D', accent: '#FFF', icon: 'gear' }
  }
  if (/corel/.test(text)) {
    return { brand: 'Corel', product: 'CorelDRAW', from: '#00A651', to: '#004B2E', accent: '#FFF', icon: 'pen' }
  }
  if (/adobe|photoshop|illustrator|acrobat/.test(text)) {
    return { brand: 'Adobe', product: 'Creative', from: '#FF0000', to: '#4B0000', accent: '#FFF', icon: 'pen' }
  }
  if (/visual\s*studio/.test(text)) {
    return { brand: 'Microsoft', product: 'Visual Studio', from: '#5C2D91', to: '#1B0A33', accent: '#FFF', icon: 'code' }
  }
  if (/sql\s*server/.test(text)) {
    return { brand: 'Microsoft', product: 'SQL Server', from: '#CC2927', to: '#4A0D0C', accent: '#FFF', icon: 'db' }
  }
  if (/windows\s*server|datacenter/.test(text)) {
    return { brand: 'Microsoft', product: 'Windows Server', from: '#0078D4', to: '#001B3D', accent: '#FFF', icon: 'server' }
  }
  if (/windows/.test(text)) {
    return { brand: 'Microsoft', product: 'Windows', from: '#0078D4', to: '#00BCF2', accent: '#FFF', icon: 'windows' }
  }
  if (/\bexcel\b/.test(text)) {
    return { brand: 'Microsoft', product: 'Excel', from: '#217346', to: '#0B3D24', accent: '#FFF', icon: 'sheet' }
  }
  if (/\bword\b/.test(text)) {
    return { brand: 'Microsoft', product: 'Word', from: '#2B579A', to: '#0F274D', accent: '#FFF', icon: 'doc' }
  }
  if (/powerpoint|power\s*point/.test(text)) {
    return { brand: 'Microsoft', product: 'PowerPoint', from: '#C43E1C', to: '#5A1408', accent: '#FFF', icon: 'slides' }
  }
  if (/outlook/.test(text)) {
    return { brand: 'Microsoft', product: 'Outlook', from: '#0072C6', to: '#00335C', accent: '#FFF', icon: 'mail' }
  }
  if (/visio/.test(text)) {
    return { brand: 'Microsoft', product: 'Visio', from: '#3955A3', to: '#1A274D', accent: '#FFF', icon: 'flow' }
  }
  if (/\bproject\b/.test(text)) {
    return { brand: 'Microsoft', product: 'Project', from: '#31752F', to: '#143312', accent: '#FFF', icon: 'chart' }
  }
  if (/\boffice\b|microsoft\s*365|\b365\b|mak/.test(text)) {
    return { brand: 'Microsoft', product: 'Office', from: '#D83B01', to: '#7A1F00', accent: '#FFF', icon: 'office' }
  }
  if (/antivirus|kaspersky|mcafee|norton|security|defender/.test(text)) {
    return { brand: 'Security', product: 'Antivirus', from: '#0F766E', to: '#042F2E', accent: '#FFF', icon: 'shield' }
  }
  if (/server/.test(text) || /server/i.test(category)) {
    return { brand: 'Enterprise', product: 'Server', from: '#334155', to: '#0F172A', accent: '#FFF', icon: 'server' }
  }
  return {
    brand: 'eSoftware',
    product: category || 'Software',
    from: '#1E3A5F',
    to: '#F97316',
    accent: '#FFF',
    icon: 'box',
  }
}

function iconMarkup(kind) {
  switch (kind) {
    case 'windows':
      return `<g fill="#fff" opacity="0.95">
        <rect x="40" y="40" width="42" height="42" rx="4"/>
        <rect x="90" y="40" width="42" height="42" rx="4"/>
        <rect x="40" y="90" width="42" height="42" rx="4"/>
        <rect x="90" y="90" width="42" height="42" rx="4"/>
      </g>`
    case 'office':
      return `<g>
        <rect x="42" y="42" width="36" height="36" rx="6" fill="#D83B01"/>
        <rect x="90" y="42" width="36" height="36" rx="6" fill="#217346"/>
        <rect x="42" y="90" width="36" height="36" rx="6" fill="#2B579A"/>
        <rect x="90" y="90" width="36" height="36" rx="6" fill="#C43E1C"/>
      </g>`
    case 'shield':
      return `<path d="M86 36c24 10 40 14 40 14v34c0 28-26 48-40 54-14-6-40-26-40-54V50s16-4 40-14z" fill="none" stroke="#fff" stroke-width="8"/>`
    case 'code':
      return `<path d="M70 60 L50 86 L70 112 M100 60 L120 86 L100 112 M92 52 L78 120" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`
    case 'server':
      return `<g fill="none" stroke="#fff" stroke-width="7">
        <rect x="48" y="48" width="76" height="28" rx="8"/><rect x="48" y="86" width="76" height="28" rx="8"/>
        <circle cx="64" cy="62" r="3" fill="#fff"/><circle cx="64" cy="100" r="3" fill="#fff"/>
      </g>`
    case 'cad':
      return `<g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round">
        <path d="M50 120 L50 50 L120 50"/><path d="M50 95 H95 V50"/><circle cx="110" cy="110" r="12"/>
      </g>`
    case 'building':
      return `<g fill="#fff" opacity="0.95">
        <rect x="55" y="55" width="60" height="75" rx="4"/>
        <rect x="66" y="68" width="12" height="12" fill="#1F4E79"/>
        <rect x="92" y="68" width="12" height="12" fill="#1F4E79"/>
        <rect x="66" y="92" width="12" height="12" fill="#1F4E79"/>
        <rect x="92" y="92" width="12" height="12" fill="#1F4E79"/>
      </g>`
    case 'db':
      return `<g fill="none" stroke="#fff" stroke-width="7">
        <ellipse cx="86" cy="52" rx="36" ry="14"/><path d="M50 52 V112 c0 8 16 14 36 14s36-6 36-14V52"/>
      </g>`
    default:
      return `<g fill="none" stroke="#fff" stroke-width="7">
        <rect x="52" y="48" width="68" height="84" rx="10"/>
        <path d="M52 78 H120"/>
      </g>`
  }
}

/** Build a branded software-style SVG cover from product name. */
export function buildProductCoverSvg({ name = '', category = '', slug = '' } = {}) {
  const brand = brandFromName(name, category)
  const title = shortenTitle(name) || brand.product
  const lines = wrapTitle(title, 18)
  const hash = hashKey(slug || name)
  const shine = 18 + (hash % 40)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand.from}"/>
      <stop offset="100%" stop-color="${brand.to}"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.16)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="900" height="900" fill="url(#bg)"/>
  <circle cx="${720 + (hash % 60)}" cy="${160 + (hash % 40)}" r="180" fill="rgba(255,255,255,0.08)"/>
  <circle cx="${120 + (hash % 50)}" cy="${760}" r="220" fill="rgba(0,0,0,0.12)"/>
  <rect x="70" y="70" width="760" height="760" rx="42" fill="url(#card)" stroke="rgba(255,255,255,0.22)" stroke-width="2" filter="url(#shadow)"/>
  <text x="110" y="150" fill="rgba(255,255,255,0.75)" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="3">${escapeXml(brand.brand.toUpperCase())}</text>
  <g transform="translate(110 210) scale(2.2)">${iconMarkup(brand.icon)}</g>
  <text x="110" y="560" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" letter-spacing="2">${escapeXml(brand.product.toUpperCase())}</text>
  ${lines.map((line, i) => `<text x="110" y="${620 + i * 52}" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="800">${escapeXml(line)}</text>`).join('')}
  <rect x="110" y="760" width="200" height="10" rx="5" fill="rgba(255,255,255,${(shine / 100).toFixed(2)})"/>
  <text x="110" y="805" fill="rgba(255,255,255,0.7)" font-family="Segoe UI, Arial, sans-serif" font-size="22">Digital license · Instant delivery</text>
</svg>`
}

function wrapTitle(title, maxChars) {
  const words = title.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
      if (lines.length === 2) break
    } else {
      current = next
    }
  }
  if (lines.length < 2 && current) lines.push(current)
  if (words.length && lines.length === 2) {
    const used = [...lines[0].split(' '), ...lines[1].split(' ')].length
    if (used < words.length) lines[1] = `${lines[1].replace(/\s+\S+$/, '')}…`
  }
  return lines.slice(0, 2)
}

export function productCoverDataUri(product) {
  const svg = buildProductCoverSvg({
    name: product?.name,
    category: product?.category,
    slug: product?.slug || product?.id,
  })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function productCoverApiUrl(product, apiPublicUrl) {
  const base = String(apiPublicUrl || '').replace(/\/$/, '')
  if (!base) return productCoverDataUri(product)
  const params = new URLSearchParams({
    name: product?.name || 'Software',
    category: product?.category || '',
    slug: product?.slug || product?.id || '',
  })
  return `${base}/api/media/product-cover?${params.toString()}`
}

export function isLegacyBrokenMediaUrl(url) {
  if (!url) return true
  if (String(url).includes('/wp-content/')) return true
  if (String(url).includes('images.unsplash.com')) return true
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return host === 'esoftwarestore.com'
  } catch {
    return true
  }
}

export function isCustomUploadedImageUrl(url) {
  return Boolean(url && String(url).includes('/uploads/'))
}

export function shouldAutoGenerateProductImage(url) {
  const value = String(url ?? '').trim()
  if (!value) return true
  if (isLegacyBrokenMediaUrl(value)) return true
  if (value.includes('/api/media/product-cover')) return true
  return false
}

/** Persisted image URL for create/update — keeps custom uploads & external URLs, else branded cover. */
export function resolveProductImageForSave(product, apiPublicUrl) {
  const custom = String(product?.imageUrl ?? '').trim()
  if (custom && !shouldAutoGenerateProductImage(custom)) {
    return custom
  }
  return productCoverApiUrl(product, apiPublicUrl)
}

export function resolveStoreProductImage(product, apiPublicUrl = '') {
  const custom = product?.imageUrl
  if (custom && !isLegacyBrokenMediaUrl(custom) && !String(custom).includes('/api/media/product-cover')) {
    // Keep admin-uploaded images hosted on API /uploads
    if (String(custom).includes('/uploads/')) return custom
  }
  if (apiPublicUrl) return productCoverApiUrl(product, apiPublicUrl)
  return productCoverDataUri(product)
}
