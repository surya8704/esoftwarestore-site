import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CSV = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'meta-product-catalog.csv'),
  'utf8',
)

export default function handler(_req, res) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="meta-product-catalog.csv"')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).end(CSV)
}
