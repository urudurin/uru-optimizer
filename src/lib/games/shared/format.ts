import { currentLocale } from 'lib/utils/i18nUtils'

// Number rounding and formatting shared by the non-HSR games

export function roundHalfUp(value: number, digits = 0): number {
  const factor = 10 ** digits
  // The small epsilon keeps values like 1.005 from rounding down because of float representation
  return Math.round((value + Number.EPSILON) * factor) / factor
}

// Rounded down to some digits, the way ZZZ's stat screen shows stats; the epsilon keeps 57.8 from showing as 57.7
export function roundDown(value: number, digits = 0): number {
  const factor = 10 ** digits
  return Math.floor(value * factor + 1e-6) / factor
}

// Thousands separators in the language HSR's picker chose (lib/utils/i18nUtils.ts currentLocale), up to 3 decimals
export function formatNumber(value: number, suffix = ''): string {
  return `${value.toLocaleString(currentLocale(), { maximumFractionDigits: 3 })}${suffix}`
}
