const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'to', 'of', 'in', 'on',
  'edition', 'license', 'key', 'digital', 'download', 'software', 'pc',
  'oem', 'retail', 'lifetime', 'version',
])

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[+_/\\|]+/g, ' ')
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value) {
  return normalizeName(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
}

/** Shared family stem, e.g. "windows 10 pro" → "windows 10" */
function familyKey(name) {
  const tokens = tokenize(name)
  if (!tokens.length) return ''
  if (tokens.length === 1) return tokens[0]
  // Keep product + version/year when present (windows 10, office 2021, visual studio 2022)
  const second = tokens[1]
  if (/^\d{2,4}(\.\d+)?$/.test(second) || /^(xp|vista|ce)$/.test(second)) {
    return `${tokens[0]} ${second}`
  }
  return tokens.slice(0, 2).join(' ')
}

function sharedTokenScore(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0
  const setB = new Set(bTokens)
  let score = 0
  for (const token of aTokens) {
    if (setB.has(token)) {
      // Version/year tokens matter more for "Windows 10" vs "Windows 11"
      score += /^\d{2,4}/.test(token) ? 18 : 10
    }
  }
  return score
}

/**
 * Rank other catalog products by similarity to the current product.
 * Prefers same family (Windows 10 → Windows 10 Pro), then shared tokens, then category.
 */
export function getSimilarProducts(product, catalog = [], { limit = 8 } = {}) {
  if (!product || !catalog.length) return []

  const productId = String(product.id ?? '')
  const productSlug = product.slug
  const name = product.name || ''
  const tokens = tokenize(name)
  const family = familyKey(name)
  const normalizedName = normalizeName(name)

  const scored = []
  for (const candidate of catalog) {
    if (!candidate) continue
    if (productSlug && candidate.slug === productSlug) continue
    if (productId && String(candidate.id) === productId) continue

    const candidateName = candidate.name || ''
    const candidateTokens = tokenize(candidateName)
    const candidateFamily = familyKey(candidateName)
    const candidateNormalized = normalizeName(candidateName)

    let score = sharedTokenScore(tokens, candidateTokens)

    if (family && candidateFamily && family === candidateFamily) {
      score += 60
    } else if (family && candidateNormalized.includes(family)) {
      score += 45
    } else if (candidateFamily && normalizedName.includes(candidateFamily)) {
      score += 35
    }

    // Starts with same leading words (windows 10 …)
    if (tokens.length >= 2) {
      const prefix = tokens.slice(0, 2).join(' ')
      if (candidateNormalized.startsWith(prefix)) score += 20
    }

    if (product.category && candidate.category === product.category) {
      score += 8
    }

    // Mild boost for similar price band
    const priceA = Number(product.displayPrice ?? product.price) || 0
    const priceB = Number(candidate.displayPrice ?? candidate.price) || 0
    if (priceA > 0 && priceB > 0) {
      const ratio = Math.min(priceA, priceB) / Math.max(priceA, priceB)
      if (ratio >= 0.5) score += Math.round(ratio * 4)
    }

    if (score <= 0) continue
    scored.push({ product: candidate, score })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return String(a.product.name || '').localeCompare(String(b.product.name || ''))
  })

  // Prefer a strong similar set; if nothing scores well, fall back to same category
  const strong = scored.filter((row) => row.score >= 18)
  const pool = strong.length ? strong : scored.filter((row) => row.product.category === product.category)

  if (!pool.length && product.category) {
    return catalog
      .filter((p) => p.category === product.category && p.slug !== productSlug)
      .slice(0, limit)
  }

  return pool.slice(0, limit).map((row) => row.product)
}
