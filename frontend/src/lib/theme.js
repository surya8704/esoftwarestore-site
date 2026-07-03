const STORAGE_KEY = 'theme'

export function getStoredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return null
}

export function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme
  return getSystemTheme()
}

export function getInitialTheme() {
  return getStoredTheme() ?? getSystemTheme()
}

export function applyTheme(theme) {
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = resolved === 'dark' ? '#0f172a' : '#1e3a5f'
}

export function persistTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}
