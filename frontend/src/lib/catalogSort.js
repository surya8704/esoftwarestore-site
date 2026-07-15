/**
 * Default homepage priority: Microsoft / Windows products first.
 */
export function microsoftWindowsPriority(product) {
  const haystack = `${product?.name || ''} ${product?.category || ''} ${product?.slug || ''}`.toLowerCase()
  let score = 0

  if (/\bwindows\b/.test(haystack)) score += 120
  if (/\bmicrosoft\b/.test(haystack)) score += 100
  // Common Microsoft product lines often listed with Windows
  if (/\boffice\b/.test(haystack) || /\bmicrosoft 365\b/.test(haystack) || /\bms\s*365\b/.test(haystack)) {
    score += 50
  }
  if (/\bvisual studio\b/.test(haystack) || /\bsql server\b/.test(haystack) || /\bwindows server\b/.test(haystack)) {
    score += 40
  }

  // Prefer newer Windows versions slightly within the Windows group
  if (/\bwindows\s*11\b/.test(haystack)) score += 15
  else if (/\bwindows\s*10\b/.test(haystack)) score += 10

  return score
}

export function sortByDefaultCatalogOrder(list) {
  return [...list].sort((a, b) => {
    const priority = microsoftWindowsPriority(b) - microsoftWindowsPriority(a)
    if (priority !== 0) return priority
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
  })
}
