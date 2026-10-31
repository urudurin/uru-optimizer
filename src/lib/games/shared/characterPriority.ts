import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { useSyncExternalStore } from 'react'

// The order of a game's saved characters, after HSR's character priority (the numbered Characters list, the Character
// menu's Move to top / Sort by effective substats, and the optimizer's priority filter, which leaves out gear worn by
// characters ranked above). Kept in localStorage `<game>-priority` as a list of ids, best first, and carried in backups
// (shared/backup.ts). Characters not in the list yet come after it, in their saved order.

const storageKey = (game: string) => `${game}-priority`
const listeners = new Set<() => void>()
const cache = new Map<string, string[]>()

export function readPriority(game: string): string[] {
  const cached = cache.get(game)
  if (cached) return cached
  let list: string[] = []
  try {
    const parsed: unknown = JSON.parse(readStorage(storageKey(game)) ?? '[]')
    if (Array.isArray(parsed)) list = parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    // no order yet
  }
  cache.set(game, list)
  return list
}

export function writePriority(game: string, ids: string[]) {
  const list = [...new Set(ids)]
  writeStorage(storageKey(game), JSON.stringify(list))
  cache.set(game, list)
  for (const listener of listeners) listener()
}

// A backup restore writes the key directly: read it again next time
export function forgetPriority() {
  cache.clear()
  for (const listener of listeners) listener()
}

export function usePriority(game: string): string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => readPriority(game),
  )
}

// The ids in priority order: ranked ones first, then the rest as given
export function orderByPriority(ids: string[], priority: string[]): string[] {
  const rank = new Map(priority.map((id, i) => [id, i]))
  return ids
    .map((id, i) => ({ id, i, rank: rank.get(id) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((entry) => entry.id)
}

// HSR's Move character to top
export function moveToTop(ids: string[], priority: string[], id: string): string[] {
  return [id, ...orderByPriority(ids, priority).filter((x) => x !== id)]
}

// The characters ranked above this one, whose gear the priority filter leaves out
export function ranksAbove(ids: string[], priority: string[], id: string): string[] {
  const ordered = orderByPriority(ids, priority)
  const at = ordered.indexOf(id)
  return at < 0 ? [] : ordered.slice(0, at)
}
