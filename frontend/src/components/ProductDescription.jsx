const BULLET_MARK = '[-*•▪▸►\u2022\u2023\u25E6\u2013\u2014]'
const LINE_BULLET_RE = new RegExp(`^\\s*${BULLET_MARK}\\s*(\\S.*)$`)
const ORDERED_RE = /^\s*(\d+)[.)]\s+(\S.*)$/
const HR_RE = /^\s*-{3,}\s*$/
/** Split glued bullets: "... purchase -Product will ..." or "... purchase - Product will ..." */
const INLINE_BULLET_SPLIT_RE = /\s+(?=-\s*\S)/

/**
 * Split plain-text product descriptions into paragraphs and lists.
 * Every line that starts with "-" (with or without a space) is a bullet.
 * Multiple bullets stuck on one line are split apart.
 */
export function parseDescriptionBlocks(text) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')

  const blocks = []
  let paragraphLines = []
  let list = null

  const flushParagraph = () => {
    const content = paragraphLines.join(' ').replace(/\s+/g, ' ').trim()
    if (content) blocks.push({ type: 'p', text: content })
    paragraphLines = []
  }

  const flushList = () => {
    if (list?.items?.length) blocks.push(list)
    list = null
  }

  const pushBullet = (item) => {
    const trimmed = String(item || '').trim()
    if (!trimmed) return
    flushParagraph()
    if (!list || list.type !== 'ul') {
      flushList()
      list = { type: 'ul', items: [] }
    }
    list.items.push(trimmed)
  }

  const pushOrdered = (item) => {
    const trimmed = String(item || '').trim()
    if (!trimmed) return
    flushParagraph()
    if (!list || list.type !== 'ol') {
      flushList()
      list = { type: 'ol', items: [] }
    }
    list.items.push(trimmed)
  }

  /** Expand one physical line into one or more bullet item strings. */
  const expandBulletItems = (line) => {
    if (HR_RE.test(line)) return null
    const matched = line.match(LINE_BULLET_RE)
    if (!matched) return null

    const body = matched[1]
    const parts = body.split(INLINE_BULLET_SPLIT_RE).map((part) =>
      part.replace(new RegExp(`^${BULLET_MARK}\\s*`), '').trim(),
    )
    return parts.filter(Boolean)
  }

  for (const raw of lines) {
    const line = String(raw ?? '')
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    const ordered = line.match(ORDERED_RE)
    if (ordered) {
      pushOrdered(ordered[2])
      continue
    }

    const bulletItems = expandBulletItems(line)
    if (bulletItems) {
      for (const item of bulletItems) pushBullet(item)
      continue
    }

    flushList()
    paragraphLines.push(line.trim())
  }

  flushParagraph()
  flushList()
  return blocks
}

/** Feature bullets for the buy box; remaining prose for the Description tab. */
export function splitDescriptionParts(text) {
  const blocks = parseDescriptionBlocks(text)
  const bullets = []
  const paragraphs = []

  for (const block of blocks) {
    if (block.type === 'ul' || block.type === 'ol') {
      for (const item of block.items || []) {
        if (item) bullets.push(item)
      }
    } else if (block.type === 'p' && block.text) {
      paragraphs.push(block.text)
    }
  }

  return {
    bullets,
    description: paragraphs.join('\n\n').trim(),
  }
}

export default function ProductDescription({ text, className = '', clamp = false, mode = 'all' }) {
  const blocks = parseDescriptionBlocks(text)
  const filtered =
    mode === 'bullets'
      ? blocks.filter((b) => b.type === 'ul' || b.type === 'ol')
      : mode === 'prose'
        ? blocks.filter((b) => b.type === 'p')
        : blocks

  if (!filtered.length) return null

  if (clamp) {
    const preview =
      filtered.find((b) => b.type === 'p')?.text ||
      filtered.find((b) => b.items)?.items?.[0] ||
      ''
    if (!preview) return null
    return <p className={`line-clamp-4 ${className}`.trim()}>{preview}</p>
  }

  return (
    <div className={`product-description ${className}`.trim()}>
      {filtered.map((block, index) => {
        if (block.type === 'p') {
          return (
            <p key={`p-${index}`} className="leading-relaxed">
              {block.text}
            </p>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={`ol-${index}`} className="product-desc-list product-desc-list--ordered">
              {block.items.map((item, i) => (
                <li key={`ol-${index}-${i}`}>{item}</li>
              ))}
            </ol>
          )
        }
        return (
          <ul key={`ul-${index}`} className="product-desc-list product-desc-list--bullets">
            {block.items.map((item, i) => (
              <li key={`ul-${index}-${i}`}>{item}</li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
