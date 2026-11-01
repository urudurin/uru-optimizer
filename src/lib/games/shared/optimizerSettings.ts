import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { useCallback } from 'react'
import {
  create,
  type StoreApi,
  type UseBoundStore,
} from 'zustand'

// Optimizer settings saved per character, like HSR's optimizer: going back to a character brings back their target,
// sets, main stats, minimums and so on. Kept in this browser under one key per game ('<game>-optimizer-settings'),
// with the character last opened. Saved values are only used where they match the defaults' shape, so a save from an
// older version (or a broken one) falls back to defaults instead of breaking the page.
// Like HSR's optimizer request store, a zustand store per key holds them (optimizerSettingsStore), so any component can
// read the open character and their form; storage stays the saved copy, and writes go through the store.

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

type SettingsStore = {
  saved: SavedOptimizerSettings,
  write: (next: SavedOptimizerSettings) => void,
  // Reads storage again, after something wrote it directly (a migration, a restored backup)
  reload: () => void,
}

const stores = new Map<string, UseBoundStore<StoreApi<SettingsStore>>>()

// The store for one game's settings key, made on first use
export function optimizerSettingsStore(storageKey: string): UseBoundStore<StoreApi<SettingsStore>> {
  let store = stores.get(storageKey)
  if (!store) {
    store = create<SettingsStore>()((set) => ({
      saved: readOptimizerSettings(storageKey),
      write: (next) => {
        writeStorage(storageKey, JSON.stringify(next))
        set({ saved: next })
      },
      reload: () => set({ saved: readOptimizerSettings(storageKey) }),
    }))
    stores.set(storageKey, store)
  }
  return store
}

export function reloadOptimizerSettings(storageKey: string) {
  stores.get(storageKey)?.getState().reload()
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
  const store = optimizerSettingsStore(storageKey)
  const settings = mergeSettings(defaults(characterId), store((s) => s.saved.byCharacter[characterId]))

  const update = useCallback((change: SettingsUpdate<T>) => {
    const { saved, write } = store.getState()
    const current = mergeSettings(defaults(characterId), saved.byCharacter[characterId])
    const next = { ...current, ...(typeof change === 'function' ? change(current) : change) }
    write({ ...saved, byCharacter: { ...saved.byCharacter, [characterId]: next } })
  }, [store, characterId, defaults])

  return [settings, update]
}

// The character the optimizer has open (undefined until one is picked), and a function to open another, which is saved
export function useActiveCharacter(storageKey: string): [string | undefined, (characterId: string) => void] {
  const store = optimizerSettingsStore(storageKey)
  const last = store((s) => s.saved.last)
  const open = useCallback((characterId: string) => {
    const { saved, write } = store.getState()
    if (saved.last !== characterId) write({ ...saved, last: characterId })
  }, [store])
  return [last, open]
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
  reloadOptimizerSettings(storageKey)
}
