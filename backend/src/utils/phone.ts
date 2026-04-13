/**
 * Phone number validation and normalization using libphonenumber-js.
 * Falls back to basic regex if library not installed.
 */
export function validateAndNormalizePhone(phone: string, countryCode: string = 'CA'): { valid: boolean; e164: string | null } {
  try {
    const { parsePhoneNumber } = require('libphonenumber-js')
    const parsed = parsePhoneNumber(phone, countryCode as any)
    if (parsed && parsed.isValid()) {
      return { valid: true, e164: parsed.format('E.164') }
    }
    return { valid: false, e164: null }
  } catch {
    // Fallback: basic E.164 check
    const cleaned = phone.replace(/[^+\d]/g, '')
    if (/^\+?\d{7,15}$/.test(cleaned)) {
      const e164 = cleaned.startsWith('+') ? cleaned : '+' + cleaned
      return { valid: true, e164 }
    }
    return { valid: false, e164: null }
  }
}

export function countryFlag(code: string): string {
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397))
}
