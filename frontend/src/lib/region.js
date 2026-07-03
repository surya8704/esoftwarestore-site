/** Mirrors backend COUNTRY_REGION for client-side fallback */
export const COUNTRY_REGION = {
  IN: { currency: 'INR', locale: 'en' },
  US: { currency: 'USD', locale: 'en' },
  GB: { currency: 'GBP', locale: 'en' },
  UK: { currency: 'GBP', locale: 'en' },
  DE: { currency: 'EUR', locale: 'de' },
  AT: { currency: 'EUR', locale: 'de' },
  CH: { currency: 'EUR', locale: 'de' },
  FR: { currency: 'EUR', locale: 'fr' },
  BE: { currency: 'EUR', locale: 'fr' },
  ES: { currency: 'EUR', locale: 'es' },
  MX: { currency: 'USD', locale: 'es' },
  IT: { currency: 'EUR', locale: 'it' },
  PT: { currency: 'EUR', locale: 'pt' },
  BR: { currency: 'BRL', locale: 'pt' },
  NL: { currency: 'EUR', locale: 'nl' },
  PL: { currency: 'EUR', locale: 'pl' },
  RU: { currency: 'RUB', locale: 'ru' },
  AE: { currency: 'AED', locale: 'ar' },
  SA: { currency: 'AED', locale: 'ar' },
  CA: { currency: 'CAD', locale: 'en' },
  AU: { currency: 'AUD', locale: 'en' },
  NZ: { currency: 'AUD', locale: 'en' },
  JP: { currency: 'JPY', locale: 'en' },
  SG: { currency: 'USD', locale: 'en' },
  IE: { currency: 'EUR', locale: 'en' },
}

export const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ar']

export const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  RUB: '₽',
  BRL: 'R$',
}

const TZ_COUNTRY = {
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Sao_Paulo': 'BR',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Lisbon': 'PT',
  'Europe/Amsterdam': 'NL',
  'Europe/Warsaw': 'PL',
  'Europe/Moscow': 'RU',
  'Asia/Dubai': 'AE',
  'Asia/Tokyo': 'JP',
  'Australia/Sydney': 'AU',
  'Pacific/Auckland': 'NZ',
}

const STORAGE_KEYS = {
  country: 'country',
  currency: 'currency',
  locale: 'locale',
  manual: 'regionManual',
}

export function isRegionManual() {
  return localStorage.getItem(STORAGE_KEYS.manual) === 'true'
}

export function persistRegion({ country, currency, locale }, manual = false) {
  localStorage.setItem(STORAGE_KEYS.country, country)
  localStorage.setItem(STORAGE_KEYS.currency, currency)
  localStorage.setItem(STORAGE_KEYS.locale, locale)
  if (manual) localStorage.setItem(STORAGE_KEYS.manual, 'true')
  else localStorage.removeItem(STORAGE_KEYS.manual)
}

export function readStoredRegion() {
  return {
    country: localStorage.getItem(STORAGE_KEYS.country) ?? 'IN',
    currency: localStorage.getItem(STORAGE_KEYS.currency) ?? 'INR',
    locale: localStorage.getItem(STORAGE_KEYS.locale) ?? 'en',
  }
}

function resolveRegion(countryCode, preferredLocale) {
  const country = String(countryCode ?? 'IN').toUpperCase()
  const mapped = COUNTRY_REGION[country] ?? { currency: 'USD', locale: 'en' }
  const locale = preferredLocale && SUPPORTED_LOCALES.includes(preferredLocale)
    ? preferredLocale
    : mapped.locale
  return { country: country === 'UK' ? 'GB' : country, currency: mapped.currency, locale }
}

export function detectRegionFromBrowser() {
  const nav = navigator.language ?? 'en'
  const [lang, regionPart] = nav.split('-')
  const preferredLocale = SUPPORTED_LOCALES.includes(lang) ? lang : 'en'

  let country = regionPart?.toUpperCase()
  if (!country || !COUNTRY_REGION[country]) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    country = TZ_COUNTRY[tz] ?? 'IN'
  }

  return resolveRegion(country, preferredLocale)
}

export function getRegionForSelection(country, locale) {
  return resolveRegion(country, locale)
}

export const REGION_OPTIONS = [
  { country: 'IN', label: 'India', flag: '🇮🇳' },
  { country: 'US', label: 'United States', flag: '🇺🇸' },
  { country: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { country: 'DE', label: 'Germany', flag: '🇩🇪' },
  { country: 'FR', label: 'France', flag: '🇫🇷' },
  { country: 'ES', label: 'Spain', flag: '🇪🇸' },
  { country: 'IT', label: 'Italy', flag: '🇮🇹' },
  { country: 'PT', label: 'Portugal / Brazil', flag: '🇵🇹' },
  { country: 'NL', label: 'Netherlands', flag: '🇳🇱' },
  { country: 'AE', label: 'UAE', flag: '🇦🇪' },
  { country: 'CA', label: 'Canada', flag: '🇨🇦' },
  { country: 'AU', label: 'Australia', flag: '🇦🇺' },
  { country: 'JP', label: 'Japan', flag: '🇯🇵' },
  { country: 'RU', label: 'Russia', flag: '🇷🇺' },
]

export const LOCALE_LABELS = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  ar: 'العربية',
}
