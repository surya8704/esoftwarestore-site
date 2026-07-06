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

export function getDialCodeForCountry(countryCode) {
  const code = String(countryCode ?? 'IN').toUpperCase()
  return COUNTRY_DIAL_CODES[code] ?? '+1'
}

export function isValidLocalPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}
