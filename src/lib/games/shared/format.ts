// Number rounding and formatting shared by the non-HSR games

export function roundHalfUp(value: number, digits = 0): number {
  const factor = 10 ** digits
  // The small epsilon keeps values like 1.005 from rounding down because of float representation
  return Math.round((value + Number.EPSILON) * factor) / factor
}

// Thousands separators, the way the games show numbers
export function formatNumber(value: number, suffix = ''): string {
  return `${value.toLocaleString('en-US')}${suffix}`
}
