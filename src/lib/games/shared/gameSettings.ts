import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { useSyncExternalStore } from 'react'

// Each game's settings, after HSR's Settings drawer (lib/overlays/drawers/SettingsDrawer.tsx), kept in localStorage
// `<game>-settings` and carried in backups (shared/backup.ts). Read by the stores when they equip gear, and by pages.

// Equipping a piece another character wears: 'replace' takes it from them and leaves their slot empty (HSR's default),
// 'swap' gives them this character's old piece instead
export type EquipBehavior = 'replace' | 'swap'

export type GameSettings = { equipBehavior: EquipBehavior }

export const DEFAULT_GAME_SETTINGS: GameSettings = { equipBehavior: 'replace' }

const storageKey = (game: string) => `${game}-settings`
const listeners = new Set<() => void>()
const cache = new Map<string, GameSettings>()

// Never throws: anything unreadable falls back to the defaults, one setting at a time
export function readGameSettings(game: string): GameSettings {
  const cached = cache.get(game)
  if (cached) return cached
  let saved: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(readStorage(storageKey(game)) ?? '{}')
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>
  } catch {
    // defaults
  }
  const settings: GameSettings = {
    equipBehavior: saved.equipBehavior === 'swap' || saved.equipBehavior === 'replace' ? saved.equipBehavior : DEFAULT_GAME_SETTINGS.equipBehavior,
  }
  cache.set(game, settings)
  return settings
}

export function writeGameSettings(game: string, change: Partial<GameSettings>) {
  const settings = { ...readGameSettings(game), ...change }
  writeStorage(storageKey(game), JSON.stringify(settings))
  cache.set(game, settings)
  for (const listener of listeners) listener()
}

// A backup restore writes the key directly: forget what was read so the next read sees it
export function forgetGameSettings() {
  cache.clear()
  for (const listener of listeners) listener()
}

export function useGameSettings(game: string): GameSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => readGameSettings(game),
  )
}

// Whether equipping swaps with the previous owner
export function swapsOnEquip(game: string): boolean {
  return readGameSettings(game).equipBehavior === 'swap'
}
