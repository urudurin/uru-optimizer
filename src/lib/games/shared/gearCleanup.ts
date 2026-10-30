import type { GearScore } from 'lib/games/shared/gearScore'

// Clean-up suggestions for a game's gear (shared/ui/gear/GearCleanup.tsx): each piece scored for every saved character
// with the gear scores the inventory already shows (shared/gearScore.ts), so the page can say which pieces nobody would
// wear and which unfinished ones are worth leveling. Scores only look at substats, not sets or main stats.

export type CleanupCandidate = { id: string, name: string }

export type CleanupRow<T> = {
  item: T,
  // The character this piece scores best for, when any character can use it
  best?: CleanupCandidate & GearScore,
  equipped: boolean,
  maxed: boolean,
}

// Below this score for everyone, an unworn piece is suggested as fodder
export const FODDER_PERCENT = 30
export const LEVEL_NEXT_COUNT = 10

export function cleanupRows<T>(
  items: T[],
  candidates: CleanupCandidate[],
  scoreAs: (item: T, characterId: string) => GearScore | undefined,
  info: { equipped: (item: T) => boolean, maxed: (item: T) => boolean },
): CleanupRow<T>[] {
  return items.map((item) => {
    let best: CleanupRow<T>['best']
    for (const candidate of candidates) {
      const score = scoreAs(item, candidate.id)
      if (score && (!best || score.percent > best.percent)) best = { ...candidate, ...score }
    }
    return { item, best, equipped: info.equipped(item), maxed: info.maxed(item) }
  })
}

// Unworn pieces that score low for every saved character, lowest first
export function fodder<T>(rows: CleanupRow<T>[]): CleanupRow<T>[] {
  return rows
    .filter((row) => !row.equipped && (row.best?.percent ?? 0) < FODDER_PERCENT)
    .sort((a, b) => (a.best?.percent ?? 0) - (b.best?.percent ?? 0))
}

// Pieces not at their top level yet that already score well for someone, best first
export function levelNext<T>(rows: CleanupRow<T>[]): CleanupRow<T>[] {
  return rows
    .filter((row) => !row.maxed && (row.best?.percent ?? 0) >= FODDER_PERCENT)
    .sort((a, b) => (b.best?.percent ?? 0) - (a.best?.percent ?? 0))
    .slice(0, LEVEL_NEXT_COUNT)
}
