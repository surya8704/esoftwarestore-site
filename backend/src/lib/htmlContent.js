/**
 * Convert WooCommerce HTML product content into plain text that keeps
 * paragraphs and bullet/numbered lists intact.
 */
export function decodeHtmlEntities(text = '') {
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code)
      return Number.isFinite(n) ? String.fromCharCode(n) : _
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = Number.parseInt(hex, 16)
      return Number.isFinite(n) ? String.fromCharCode(n) : _
    })
}

export function htmlToPlainText(html = '') {
  const withBreaks = String(html || '')
    .replace(/\r\n/g, '\n')
    // Keep list structure before stripping tags
    .replace(/<\/li>\s*<li[^>]*>/gi, '\n- ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<(ul|ol)[^>]*>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|blockquote|section|article)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<(h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtmlEntities(withBreaks)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*[-•▪▸►]\s*/gm, '- ')
    .trim()
}

/** Prefer full description; merge unique short intro when useful. */
export function mergeProductDescriptions(shortHtml = '', fullHtml = '') {
  const shortText = htmlToPlainText(shortHtml)
  const fullText = htmlToPlainText(fullHtml)

  if (fullText && shortText) {
    const shortStart = shortText.slice(0, Math.min(120, shortText.length))
    if (fullText.includes(shortStart) || shortText.length < 40) return fullText
    // Short intro + full body (avoid duplicating if nearly identical)
    if (shortText === fullText) return fullText
    return `${shortText}\n\n${fullText}`.trim()
  }

  return fullText || shortText || ''
}

/** Pull bullet lines from description for shipping/feature lists. */
export function extractBulletLines(text = '', { max = 20 } = {}) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^[-*•▪▸►]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
    .map((line) => line.replace(/^[-*•▪▸►]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, max)
}
