/** Stopwords for search — keep edition words like "pro" / years so queries stay precise. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'to', 'of', 'in', 'on', 'by',
  'edition', 'license', 'key', 'digital', 'download', 'software', 'pc', 'pcs',
  'oem', 'retail', 'lifetime', 'version', 'code', 'activation', 'genuine',
  'best', 'buy', 'now', 'get',
])

/** Whole-token aliases expanded before matching. */
const SYNONYMS = {
  win: 'windows',
  win10: 'windows 10',
  win11: 'windows 11',
  windows10: 'windows 10',
  windows11: 'windows 11',
  ms: 'microsoft',
  m365: 'microsoft 365',
  o365: 'office 365',
  office365: 'office 365',
  microsoft365: 'microsoft 365',
  ppt: 'powerpoint',
  ps: 'photoshop',
  '3dsmax': '3ds max',
  mssql: 'sql server',
  w10: 'windows 10',
  w11: 'windows 11',
  proplus: 'professional plus',
}

export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[+_/\\|]+/g, ' ')
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function expandSynonyms(text) {
  return normalizeSearchText(text)
    .split(' ')
    .filter(Boolean)
    .map((token) => SYNONYMS[token] || token)
    .join(' ')
}

export function tokenizeSearchQuery(value) {
  const expanded = expandSynonyms(value)
  return expanded
    .split(' ')
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))
}

function wordsOf(text) {
  return normalizeSearchText(text).split(' ').filter(Boolean)
}

/** Soft match for short prefixes and 1-char typos on longer tokens. */
function tokenMatchQuality(haystack, token) {
  if (!token || !haystack) return 0
  if (haystack.includes(token)) {
    // Prefer whole-word hits; substring in a longer word is weaker for short tokens
    const words = wordsOf(haystack)
    if (words.includes(token)) return 3
    if (token.length >= 4) return 2
  }

  const words = wordsOf(haystack)
  let best = 0
  for (const word of words) {
    if (word === token) return 3
    // Short tokens (pro, max, sql) must be exact words — avoid "pro" → "product"
    if (token.length <= 3) continue
    if (word.startsWith(token)) best = Math.max(best, 2)
    else if (word.length >= 4 && token.startsWith(word)) best = Math.max(best, 2)
    else if (token.length >= 5 && word.length >= 5 && levenshteinAtMost1(token, word)) {
      best = Math.max(best, 1)
    }
  }
  return best
}

function levenshteinAtMost1(a, b) {
  if (a === b) return true
  const lenDiff = Math.abs(a.length - b.length)
  if (lenDiff > 1) return false
  if (a.length > b.length) return levenshteinAtMost1(b, a)

  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (a.length === b.length) {
      i += 1
      j += 1
    } else {
      j += 1
    }
  }
  if (j < b.length || i < a.length) edits += 1
  return edits <= 1
}

function buildProductFields(product) {
  const name = normalizeSearchText(product?.name)
  const slug = normalizeSearchText(String(product?.slug || '').replace(/-/g, ' '))
  const category = normalizeSearchText(product?.category)
  const licenseType = normalizeSearchText(product?.licenseType)
  const productType = normalizeSearchText(product?.productType)
  // Cap description so marketing copy doesn't drown out name matches
  const description = normalizeSearchText(product?.description).slice(0, 280)
  const primary = [name, slug, category, licenseType, productType].filter(Boolean).join(' ')
  return { name, slug, category, licenseType, productType, description, primary }
}

/** Boost when query tokens appear in order as a phrase inside the name. */
function orderedPhraseBoost(name, tokens) {
  if (tokens.length < 2) return 0
  const words = wordsOf(name)
  let ti = 0
  let adjacent = 0
  let lastIdx = -2
  for (let wi = 0; wi < words.length && ti < tokens.length; wi += 1) {
    const token = tokens[ti]
    const word = words[wi]
    const hit =
      word === token ||
      (token.length >= 4 && word.startsWith(token))
    if (hit) {
      if (wi === lastIdx + 1) adjacent += 1
      lastIdx = wi
      ti += 1
    }
  }
  if (ti < tokens.length) return 0
  return 20 + adjacent * 12
}

/** Boost when query tokens sit next to each other in the title (any order). */
function adjacentTokenBoost(name, tokens) {
  if (tokens.length < 2) return 0
  const tokenSet = new Set(tokens)
  const words = wordsOf(name)
  let pairs = 0
  for (let i = 0; i < words.length - 1; i += 1) {
    if (tokenSet.has(words[i]) && tokenSet.has(words[i + 1])) pairs += 1
  }
  return pairs * 18
}

/**
 * Score how well a product matches a search query.
 * Returns 0 when the product should be excluded.
 */
export function scoreProductMatch(product, query) {
  const raw = String(query || '').trim()
  if (!raw) return 0

  const normalizedQuery = expandSynonyms(raw)
  const tokens = tokenizeSearchQuery(raw)
  if (!tokens.length) {
    const fields = buildProductFields(product)
    return fields.name.includes(normalizeSearchText(raw)) ? 10 : 0
  }

  const fields = buildProductFields(product)
  let score = 0
  let primaryHits = 0
  let nameHits = 0
  let exactNameHits = 0

  if (fields.name.includes(normalizedQuery)) score += 120
  else if (fields.primary.includes(normalizedQuery)) score += 70

  score += orderedPhraseBoost(fields.name, tokens)
  score += adjacentTokenBoost(fields.name, tokens)

  for (const token of tokens) {
    const nameQ = tokenMatchQuality(fields.name, token)
    if (nameQ) {
      const weight = /^\d{2,4}$/.test(token) ? 32 : 28
      score += Math.round(weight * (nameQ / 3))
      nameHits += 1
      primaryHits += 1
      if (nameQ >= 3) exactNameHits += 1
      continue
    }

    const slugQ = tokenMatchQuality(fields.slug, token)
    if (slugQ) {
      score += Math.round(20 * (slugQ / 3))
      primaryHits += 1
      continue
    }

    const catQ = tokenMatchQuality(fields.category, token)
    if (catQ) {
      score += Math.round(14 * (catQ / 3))
      primaryHits += 1
      continue
    }

    const metaQ = Math.max(
      tokenMatchQuality(fields.licenseType, token),
      tokenMatchQuality(fields.productType, token),
    )
    if (metaQ) {
      score += Math.round(10 * (metaQ / 3))
      primaryHits += 1
      continue
    }

    const descQ = tokenMatchQuality(fields.description, token)
    if (descQ >= 3) {
      score += 4
      continue
    }

    return 0
  }

  // Reject weak description-only hits (common false positives)
  if (primaryHits === 0) return 0
  // Multi-word queries should hit the product name for most tokens
  if (tokens.length >= 2 && nameHits === 0) return 0
  if (tokens.length >= 3 && nameHits < Math.ceil(tokens.length / 2)) return 0

  if (fields.name.startsWith(tokens[0])) score += 18
  else {
    const firstWord = wordsOf(fields.name)[0]
    if (firstWord) {
      const leadQuality = Math.max(...tokens.map((t) => tokenMatchQuality(firstWord, t)), 0)
      if (leadQuality >= 1) score += leadQuality >= 3 ? 18 : 36
    }
  }
  if (nameHits === tokens.length) score += 24
  if (exactNameHits === tokens.length) score += 16

  // Prefer titles that lead with the product family (Windows / Office / AutoCAD)
  const lead = wordsOf(fields.name)[0]
  if (lead && tokens.includes(lead)) score += 22

  return score
}

/**
 * Filter catalog by search query and attach relevance scores.
 * When `sortByRelevance` is true (default), results are ordered best-match first.
 */
export function searchProducts(products = [], query = '', { sortByRelevance = true } = {}) {
  const q = String(query || '').trim()
  if (!q) return products.map((product) => ({ product, score: 0 }))

  const scored = []
  for (const product of products) {
    if (!product) continue
    const score = scoreProductMatch(product, q)
    if (score > 0) scored.push({ product, score })
  }

  if (sortByRelevance) {
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return String(a.product.name || '').localeCompare(String(b.product.name || ''))
    })
  }

  return scored
}

export function filterProductsBySearch(products = [], query = '') {
  return searchProducts(products, query, { sortByRelevance: true }).map((row) => row.product)
}
