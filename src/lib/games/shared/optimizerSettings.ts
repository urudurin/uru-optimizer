import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import {
  useCallback,
  useReducer,
} from 'react'

// Optimizer settings saved per character, like HSR's optimizer: going back to a character brings back their target,
// sets, main stats, minimums and so on. Kept in this browser under one key per game ('<game>-optimizer-settings'),
// with the character last opened. Saved values are only used where they match the defaults' shape, so a save from an
// older version (or a broken one) falls back to defaults instead of breaking the page.

export type SavedOptimizerSettings = {
  last?: string,
  byCharacter: Record<string, Record<string, unknown>>,
  // One-time changes already made to this save (see migrateOptimizerSettings)
  migrations?: string[],
}

export function readOptimizerSettings(storageKey: string): SavedOptimizerSettings {
  try {
    const parsed: unknown = JSON.parse(readStorage(storageKey) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null) return { byCharacter: {} }
    const { last, byCharacter, migrations } = parsed as Partial<SavedOptimizerSettings>
    return {
      ...(typeof last === 'string' ? { last } : {}),
      ...(Array.isArray(migrations) ? { migrations: migrations.filter((m): m is string => typeof m === 'string') } : {}),
      byCharacter: typeof byCharacter === 'object' && byCharacter !== null && !Array.isArray(byCharacter) ? byCharacter : {},
    }
  } catch {
    return { byCharacter: {} }
  }
}

function kindOf(value: unknown): string {
  if (value === null) return 'null'
  return Array.isArray(value) ? 'array' : typeof value
}

// The defaults with every saved value of the right kind laid over them. null counts as matching either way, for
// optional choices like "no 4-piece set"
export function mergeSettings<T extends object>(defaults: T, saved: Record<string, unknown> | undefined): T {
  if (!saved) return defaults
  const merged: Record<string, unknown> = { ...(defaults as Record<string, unknown>) }
  for (const [key, fallback] of Object.entries(defaults)) {
    if (!(key in saved)) continue
    const value = saved[key]
    if (value === null || fallback === null || kindOf(value) === kindOf(fallback)) merged[key] = value
  }
  return merged as T
}

export type SettingsUpdate<T> = Partial<T> | ((current: T) => Partial<T>)

// The settings for one character, and a function to change some of them (saved straight away). Characters never
// changed get defaults(characterId)
export function useCharacterSettings<T extends object>(
  storageKey: string,
  characterId: string,
  defaults: (characterId: string) => T,
): [T, (update: SettingsUpdate<T>) => void] {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const settings = mergeSettings(defaults(characterId), readOptimizerSettings(storageKey).byCharacter[characterId])

  const update = useCallback((change: SettingsUpdate<T>) => {
    const saved = readOptimizerSettings(storageKey)
    const current = mergeSettings(defaults(characterId), saved.byCharacter[characterId])
    const next = { ...current, ...(typeof change === 'function' ? change(current) : change) }
    writeStorage(storageKey, JSON.stringify({ ...saved, byCharacter: { ...saved.byCharacter, [characterId]: next } }))
    refresh()
  }, [storageKey, characterId, defaults])

  return [settings, update]
}

// Remembers which character the optimizer last had open
export function rememberCharacter(storageKey: string, characterId: string) {
  const saved = readOptimizerSettings(storageKey)
  if (saved.last !== characterId) writeStorage(storageKey, JSON.stringify({ ...saved, last: characterId }))
}

// A setter for one field, taking a value or a function of the old value, like useState's
export function fieldSetter<T extends object, K extends keyof T>(update: (change: SettingsUpdate<T>) => void, key: K) {
  return (value: T[K] | ((current: T[K]) => T[K])) =>
    update((current) => ({ [key]: typeof value === 'function' ? (value as (c: T[K]) => T[K])(current[key]) : value } as unknown as Partial<T>))
}

// Changes every saved character once (e.g. a new default worth moving old saves to), and records that it ran so it never
// runs again. change gets one character's saved settings and returns them changed, or unchanged
export function migrateOptimizerSettings(
  storageKey: string,
  id: string,
  change: (characterId: string, saved: Record<string, unknown>) => Record<string, unknown>,
) {
  const saved = readOptimizerSettings(storageKey)
  if (saved.migrations?.includes(id)) return
  const byCharacter = Object.fromEntries(Object.entries(saved.byCharacter).map(([characterId, settings]) => [characterId, change(characterId, settings)]))
  writeStorage(storageKey, JSON.stringify({ ...saved, byCharacter, migrations: [...(saved.migrations ?? []), id] }))
}
