import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalog as fallbackCatalog } from './catalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const catalogPath = path.join(__dirname, 'esoftwarestore-catalog.json')

export function loadCatalog() {
  if (fs.existsSync(catalogPath)) {
    const items = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
    if (items.length > 0) return items
  }
  return fallbackCatalog
}

export const catalogSource = fs.existsSync(catalogPath) ? 'esoftwarestore-catalog.json' : 'catalog.js'
