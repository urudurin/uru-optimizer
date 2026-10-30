// Shared parts of the "Try with sample data" rosters (each game's data/sampleData.ts): made-up gear for one character,
// the same every time, so a first-time visitor can see the optimizer, damage and scores before importing their own.
// Everything a sample adds has an id starting with SAMPLE_PREFIX, so pages can tell it apart and offer to remove it.

export const SAMPLE_PREFIX = 'sample-'

export function isSampleId(id: string): boolean {
  return id.startsWith(SAMPLE_PREFIX)
}

// A small seeded random number generator (Park-Miller), so the sample gear never changes between visits
export function seededRandom(seed: number): () => number {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => (state = (state * 16807) % 2147483647) / 2147483647
}

export function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)]
}

// n different items from the list, in random order
export function pickDistinct<T>(random: () => number, list: readonly T[], n: number): T[] {
  const pool = [...list]
  const chosen: T[] = []
  while (chosen.length < n && pool.length > 0) chosen.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  return chosen
}

// Splits extra rolls over substats at random: [1, 1, 1, 1] plus `extra` more
export function spreadRolls(random: () => number, substats: number, extra: number): number[] {
  const rolls = Array.from({ length: substats }, () => 1)
  for (let i = 0; i < extra; i++) rolls[Math.floor(random() * substats)]++
  return rolls
}
