/** ISO 3166-1 alpha-2 → international dial code */
export const COUNTRY_DIAL_CODES = {
  IN: '+91',
  US: '+1',
  GB: '+44',
  UK: '+44',
  DE: '+49',
  AT: '+43',
  CH: '+41',
  FR: '+33',
  BE: '+32',
  ES: '+34',
  MX: '+52',
  IT: '+39',
  PT: '+351',
  BR: '+55',
  NL: '+31',
  PL: '+48',
  RU: '+7',
  AE: '+971',
  SA: '+966',
  CA: '+1',
  AU: '+61',
  NZ: '+64',
  JP: '+81',
  SG: '+65',
  IE: '+353',
}

export const COUNTRY_LABELS = {
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  PT: 'Portugal',
  NL: 'Netherlands',
  AE: 'UAE',
  CA: 'Canada',
  AU: 'Australia',
  JP: 'Japan',
  RU: 'Russia',
  BR: 'Brazil',
  PL: 'Poland',
  AT: 'Austria',
  CH: 'Switzerland',
  BE: 'Belgium',
  MX: 'Mexico',
  SA: 'Saudi Arabia',
  NZ: 'New Zealand',
  SG: 'Singapore',
  IE: 'Ireland',
}

export function getDialCodeForCountry(countryCode) {
  const code = String(countryCode ?? 'IN').toUpperCase()
  return COUNTRY_DIAL_CODES[code] ?? '+1'
}

export function getCountryLabel(countryCode) {
  const code = String(countryCode ?? 'IN').toUpperCase()
  return COUNTRY_LABELS[code] ?? code
}

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/** Build E.164 number from regional dial code + local digits */
export function normalizePhoneNumber(countryCode, rawNumber) {
  const dialCode = getDialCodeForCountry(countryCode)
  const dialDigits = digitsOnly(dialCode)
  let local = digitsOnly(rawNumber)

  if (!local || local.length < 7 || local.length > 15) return null

  if (local.startsWith(dialDigits) && local.length > dialDigits.length + 6) {
    return `+${local}`
  }

  if (local.startsWith('0') && dialDigits === '91') {
    local = local.replace(/^0+/, '')
  }

  return `+${dialDigits}${local}`
}

export function formatPhoneForDisplay(stored, countryCode) {
  if (!stored) return null
  const value = String(stored).trim()
  if (value.startsWith('+')) return value
  const dial = getDialCodeForCountry(countryCode)
  return `${dial} ${value}`
}

export function buildContactSummary(order) {
  const countryCode = order.countryCode ?? order.billing?.countryCode ?? 'IN'
  return {
    countryCode,
    countryLabel: getCountryLabel(countryCode),
    dialCode: order.phoneDialCode ?? getDialCodeForCountry(countryCode),
    phone: order.customerPhone ?? null,
    phoneDisplay: formatPhoneForDisplay(order.customerPhone, countryCode),
    whatsapp: order.customerWhatsapp ?? order.customerPhone ?? null,
    whatsappDisplay: formatPhoneForDisplay(order.customerWhatsapp ?? order.customerPhone, countryCode),
  }
}
