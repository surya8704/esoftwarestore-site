const BULLET_RE = /^\s*(?:[-*•▪▸►]|[\u2022\u2023\u25E6])\s+(.*)$/
const ORDERED_RE = /^\s*(\d+)[.)]\s+(.*)$/

/**
 * Split plain-text product descriptions into paragraphs and lists so
 * admin-entered bullet lines render as real <ul>/<ol> items.
 */
export function parseDescriptionBlocks(text) {
  const lines = String(text ?? '')
    .replace(/\r\n/g, '\n')
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

  for (const raw of lines) {
    const line = String(raw ?? '')
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    const ordered = line.match(ORDERED_RE)
    if (ordered) {
      flushParagraph()
      if (!list || list.type !== 'ol') {
        flushList()
        list = { type: 'ol', items: [] }
      }
      list.items.push(ordered[2].trim())
      continue
    }

    const bullet = line.match(BULLET_RE)
    if (bullet) {
      flushParagraph()
      if (!list || list.type !== 'ul') {
        flushList()
        list = { type: 'ul', items: [] }
      }
      list.items.push(bullet[1].trim())
      continue
    }

    flushList()
    paragraphLines.push(line.trim())
  }

  flushParagraph()
  flushList()
  return blocks
}

export default function ProductDescription({ text, className = '', clamp = false }) {
  const blocks = parseDescriptionBlocks(text)

  if (!blocks.length) return null

  if (clamp) {
    const preview =
      blocks.find((b) => b.type === 'p')?.text ||
      blocks.find((b) => b.items)?.items?.[0] ||
      ''
    if (!preview) return null
    return <p className={`line-clamp-4 ${className}`.trim()}>{preview}</p>
  }

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === 'p') {
          return (
            <p key={`p-${index}`} className="leading-relaxed">
              {block.text}
            </p>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={`ol-${index}`} className="list-decimal space-y-2 pl-5">
              {block.items.map((item, i) => (
                <li key={`ol-${index}-${i}`}>{item}</li>
              ))}
            </ol>
          )
        }
        return (
          <ul key={`ul-${index}`} className="list-disc space-y-2 pl-5">
            {block.items.map((item, i) => (
              <li key={`ul-${index}-${i}`}>{item}</li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
