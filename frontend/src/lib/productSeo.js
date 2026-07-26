const POWER_WORDS = [
  'best',
  'guide',
  'complete',
  'genuine',
  'official',
  'instant',
  'lifetime',
  'pro',
  'premium',
  'secure',
  'fast',
  'new',
  'sale',
  'deal',
  'discount',
  'license',
  'activation',
]

function normalizeText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function wordCount(text = '') {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return words.length
}

function containsKeyword(haystack, keyword) {
  const h = normalizeText(haystack)
  const k = normalizeText(keyword)
  if (!h || !k) return false
  return h.includes(k)
}

function keywordInFirstPercent(content, keyword, percent = 10) {
  const text = String(content || '')
  if (!text.trim() || !keyword) return false
  const sliceLen = Math.max(40, Math.ceil(text.length * (percent / 100)))
  return containsKeyword(text.slice(0, sliceLen), keyword)
}

function keywordDensity(content, keyword) {
  const words = String(content || '')
    .toLowerCase()
    .match(/[a-z0-9']+/g)
  if (!words?.length || !keyword) return 0
  const keyParts = normalizeText(keyword).split(/\s+/).filter(Boolean)
  if (!keyParts.length) return 0
  let hits = 0
  for (let i = 0; i <= words.length - keyParts.length; i += 1) {
    if (keyParts.every((part, idx) => words[i + idx] === part)) hits += 1
  }
  return (hits / words.length) * 100
}

function scoreColor(score) {
  if (score >= 80) return 'green'
  if (score >= 51) return 'orange'
  return 'red'
}

function sectionStatus(checks) {
  const failed = checks.filter((c) => !c.ok)
  const errors = failed.filter((c) => c.severity !== 'warning').length
  const warnings = failed.filter((c) => c.severity === 'warning').length
  if (errors > 0) return { label: `${errors} Error${errors === 1 ? '' : 's'}`, tone: 'error', errors, warnings }
  if (warnings > 0) return { label: `${warnings} Warning${warnings === 1 ? '' : 's'}`, tone: 'warning', errors, warnings }
  return { label: 'All Good', tone: 'good', errors: 0, warnings: 0 }
}

/**
 * Rank Math–style product SEO analysis used in admin.
 */
export function analyzeProductSeo(input = {}) {
  const name = String(input.name || '').trim()
  const slug = String(input.slug || '').trim()
  const description = String(input.description || '').trim()
  const seoTitle = String(input.seoTitle || '').trim() || name
  const seoDescription = String(input.seoDescription || '').trim() || description.slice(0, 160)
  const imageUrl = String(input.imageUrl || '').trim()
  const keywords = (input.focusKeywords || [])
    .map((k) => String(k || '').trim())
    .filter(Boolean)
  const primaryKeyword = keywords[0] || ''
  const content = [name, description, ...(input.variantDescriptions || [])].filter(Boolean).join('\n\n')
  const words = wordCount(content)
  const titleLen = seoTitle.length
  const metaLen = seoDescription.length
  const density = primaryKeyword ? keywordDensity(content, primaryKeyword) : 0
  const hasNumberInTitle = /\d/.test(seoTitle)
  const hasPowerWord = POWER_WORDS.some((w) => containsKeyword(seoTitle, w))
  const hasBullets = /^[\s]*[-*•]/m.test(description) || /<li[\s>]/i.test(description)
  const hasImage = Boolean(imageUrl) && !imageUrl.includes('/api/media/product-cover')

  const basic = [
    {
      id: 'kw-title',
      ok: Boolean(primaryKeyword) && containsKeyword(seoTitle, primaryKeyword),
      text: primaryKeyword
        ? containsKeyword(seoTitle, primaryKeyword)
          ? `Focus Keyword “${primaryKeyword}” is used in the SEO title.`
          : `Add Focus Keyword “${primaryKeyword}” to the SEO title.`
        : 'Add a Focus Keyword to check SEO title usage.',
      weight: 12,
    },
    {
      id: 'kw-meta',
      ok: Boolean(primaryKeyword) && containsKeyword(seoDescription, primaryKeyword),
      text: primaryKeyword
        ? containsKeyword(seoDescription, primaryKeyword)
          ? `Focus Keyword found in the meta description.`
          : `Add Focus Keyword “${primaryKeyword}” to the meta description.`
        : 'Add a Focus Keyword to check meta description usage.',
      weight: 10,
    },
    {
      id: 'kw-slug',
      ok: Boolean(primaryKeyword) && containsKeyword(slug.replace(/-/g, ' '), primaryKeyword),
      text: primaryKeyword
        ? containsKeyword(slug.replace(/-/g, ' '), primaryKeyword)
          ? 'Focus Keyword used in the URL slug.'
          : 'Include the Focus Keyword in the product URL slug.'
        : 'Add a Focus Keyword to check URL slug usage.',
      weight: 10,
    },
    {
      id: 'kw-intro',
      ok: Boolean(primaryKeyword) && keywordInFirstPercent(content, primaryKeyword, 10),
      text: primaryKeyword
        ? keywordInFirstPercent(content, primaryKeyword, 10)
          ? 'Focus Keyword appears in the first 10% of the content.'
          : 'Use the Focus Keyword near the beginning of the description.'
        : 'Add a Focus Keyword to check content introduction usage.',
      weight: 8,
    },
    {
      id: 'word-count',
      ok: words >= 200,
      severity: words >= 120 ? 'warning' : 'error',
      text:
        words >= 200
          ? `Content is ${words} words long. Good job!`
          : words >= 120
            ? `Content is ${words} words. Aim for 200+ words.`
            : `Content is only ${words} words. Write at least 200 words.`,
      weight: 10,
    },
    {
      id: 'schema',
      ok: true,
      text: 'Product Schema will be output on the storefront product page.',
      weight: 8,
    },
  ]

  const additional = [
    {
      id: 'image',
      ok: hasImage,
      text: hasImage
        ? 'Product has a custom featured image.'
        : 'Add a custom product image (not only the auto cover).',
      weight: 8,
    },
    {
      id: 'density',
      ok: !primaryKeyword || (density >= 0.5 && density <= 2.5),
      severity: 'warning',
      text: primaryKeyword
        ? density >= 0.5 && density <= 2.5
          ? `Keyword density is ${density.toFixed(1)}%. Looks good.`
          : `Keyword density is ${density.toFixed(1)}%. Aim for about 0.5%–2.5%.`
        : 'Add a Focus Keyword to measure keyword density.',
      weight: 6,
    },
    {
      id: 'meta-length',
      ok: metaLen >= 120 && metaLen <= 160,
      severity: metaLen >= 70 && metaLen <= 180 ? 'warning' : 'error',
      text:
        metaLen >= 120 && metaLen <= 160
          ? `Meta description is ${metaLen} characters. Perfect.`
          : `Meta description is ${metaLen} characters. Aim for 120–160.`,
      weight: 6,
    },
    {
      id: 'title-length',
      ok: titleLen >= 30 && titleLen <= 60,
      severity: titleLen >= 20 && titleLen <= 70 ? 'warning' : 'error',
      text:
        titleLen >= 30 && titleLen <= 60
          ? `SEO title is ${titleLen} characters. Good length.`
          : `SEO title is ${titleLen} characters. Aim for 30–60.`,
      weight: 6,
    },
  ]

  const titleReadability = [
    {
      id: 'title-number',
      ok: hasNumberInTitle,
      severity: 'warning',
      text: hasNumberInTitle
        ? 'SEO title contains a number.'
        : 'Consider adding a number to the SEO title (e.g. Windows 11).',
      weight: 3,
    },
    {
      id: 'title-power',
      ok: hasPowerWord,
      severity: 'warning',
      text: hasPowerWord
        ? 'SEO title uses a strong / power word.'
        : 'Add a power word to the SEO title (Genuine, Instant, Lifetime…).',
      weight: 3,
    },
    {
      id: 'title-keyword-start',
      ok: Boolean(primaryKeyword) && normalizeText(seoTitle).startsWith(normalizeText(primaryKeyword)),
      severity: 'warning',
      text: primaryKeyword
        ? normalizeText(seoTitle).startsWith(normalizeText(primaryKeyword))
          ? 'Focus Keyword appears at the beginning of the SEO title.'
          : 'Try starting the SEO title with the Focus Keyword.'
        : 'Add a Focus Keyword to check title placement.',
      weight: 4,
    },
  ]

  const contentReadability = [
    {
      id: 'content-bullets',
      ok: hasBullets,
      severity: 'warning',
      text: hasBullets
        ? 'Description uses bullet points for scannability.'
        : 'Add bullet points to the product description.',
      weight: 3,
    },
    {
      id: 'content-image',
      ok: hasImage,
      severity: 'warning',
      text: hasImage ? 'Content includes a product image.' : 'Add a product image to improve engagement.',
      weight: 2,
    },
    {
      id: 'content-length',
      ok: words >= 300,
      severity: words >= 200 ? 'warning' : 'error',
      text:
        words >= 300
          ? `Detailed content (${words} words) helps rankings.`
          : `Expand the description toward 300+ words (currently ${words}).`,
      weight: 4,
    },
  ]

  const sections = [
    { id: 'basic', label: 'Basic SEO', checks: basic },
    { id: 'additional', label: 'Additional', checks: additional },
    { id: 'title', label: 'Title Readability', checks: titleReadability },
    { id: 'content', label: 'Content Readability', checks: contentReadability },
  ].map((section) => ({
    ...section,
    status: sectionStatus(section.checks),
  }))

  const allChecks = sections.flatMap((s) => s.checks)
  const maxScore = allChecks.reduce((sum, c) => sum + (c.weight || 0), 0) || 100
  const earned = allChecks.reduce((sum, c) => sum + (c.ok ? c.weight || 0 : 0), 0)
  const score = Math.round((earned / maxScore) * 100)

  const keywordResults = keywords.map((keyword) => {
    const hits = [
      containsKeyword(seoTitle, keyword),
      containsKeyword(seoDescription, keyword),
      containsKeyword(slug.replace(/-/g, ' '), keyword),
      containsKeyword(content, keyword),
    ].filter(Boolean).length
    return {
      keyword,
      ok: hits >= 3,
      hits,
    }
  })

  return {
    score,
    maxScore: 100,
    color: scoreColor(score),
    primaryKeyword,
    keywordResults,
    sections,
    preview: {
      title: seoTitle ? `${seoTitle} | eSoftware Store` : 'eSoftware Store',
      url: `https://www.esoftwarestore.com/product/${slug || 'product-slug'}`,
      description: seoDescription || 'Add a meta description to preview the Google snippet.',
    },
    stats: {
      words,
      titleLen,
      metaLen,
      density: Number(density.toFixed(2)),
    },
  }
}

export function seoScoreBadgeClass(score) {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (score >= 51) return 'bg-amber-100 text-amber-900 border-amber-200'
  return 'bg-rose-100 text-rose-800 border-rose-200'
}
