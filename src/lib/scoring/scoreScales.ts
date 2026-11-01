// The DPS score scale, kept free of other imports so light modules (the other games' scoring in lib/games) can share it

// Gradual scale
export const SimScoreGrades = {
  'AEON': 150, // Verified only
  'WTF+': 140, // +10
  'WTF': 130, // +9
  'SSS+': 121, // +8
  'SSS': 113, // +7
  'SS+': 106, // +6
  'SS': 100, // Benchmark
  'S+': 95,
  'S': 90,
  'A+': 85,
  'A': 80,
  'B+': 75,
  'B': 70,
  'C+': 65,
  'C': 60,
  'D+': 55,
  'D': 50,
  'F+': 45,
  'F': 40,
}

export function calculateScorePercent(
  score: number,
  baseline: number,
  benchmark: number,
  perfection: number,
): number {
  const clampedPerfection = Math.max(perfection, benchmark)
  if (score >= benchmark) {
    const range = clampedPerfection - benchmark
    return range > 0 ? 1 + (score - benchmark) / range : 1
  }
  const range = benchmark - baseline
  return range > 0 ? (score - baseline) / range : 0
}
