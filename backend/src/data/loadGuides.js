import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const guidesPath = path.join(__dirname, 'esoftwarestore-guides.json')

export function loadGuides() {
  if (!fs.existsSync(guidesPath)) return []
  const raw = JSON.parse(fs.readFileSync(guidesPath, 'utf8'))
  if (Array.isArray(raw)) return raw
  return raw.guides ?? []
}
