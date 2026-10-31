import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { useSyncExternalStore } from 'react'

// Substat weights a user set for a character, after HSR's Scoring algorithm modal: they replace the game's own table
// (ZZZ presets, Genshin and WuWa statPriorities.ts) wherever that character's gear is scored. Kept in localStorage
// `<game>-score-weights` as { [characterId]: { [stat]: weight } } and carried in backups (shared/backup.ts). A web
// worker has no localStorage, so there the defaults apply (gear scores aren't worked out in workers).

const storageKey = (game: string) => `${game}-score-weights`
const listeners = new Set<() => void>()
let version = 0

function readAll(game: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readStorage(storageKey(game)) ?? '{}')
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

// A character's own weights, or undefined for the game's defaults. Never throws; anything not a number is skipped
export function weightOverrides(game: string, characterId: string): Record<string, number> | undefined {
  const raw = readAll(game)[characterId]
  if (typeof raw !== 'object' || raw === null) return undefined
  const weights = Object.fromEntries(Object.entries(raw).filter(([, w]) => typeof w === 'number' && Number.isFinite(w) && w >= 0)) as Record<string, number>
  return Object.keys(weights).length > 0 ? weights : undefined
}

// undefined puts the character back on the defaults
export function saveWeightOverrides(game: string, characterId: string, weights: Record<string, number> | undefined) {
  const all = readAll(game)
  if (weights) all[characterId] = weights
  else delete all[characterId]
  writeStorage(storageKey(game), JSON.stringify(all))
  version++
  for (const listener of listeners) listener()
}

// The defaults with the character's own weights on top
export function withWeightOverrides(game: string, characterId: string, defaults: Record<string, number>): Record<string, number> {
  const overrides = weightOverrides(game, characterId)
  return overrides ? { ...defaults, ...overrides } : defaults
}

// Changes whenever weights are saved, so pages scoring gear re-render
export function useScoreWeightsVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
  )
}
