import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'

// Rotations a user saved by name, per game and character, so a character can switch between a quick burst and a full
// cycle without counting hits again. Kept in localStorage `<game>-saved-rotations` as { [characterId]: SavedRotation[] };
// the rotation itself is whatever the game's Rotation card works with.

export type SavedRotation<R> = { name: string, rotation: R }

export const MAX_SAVED_ROTATIONS = 12

function storageKey(game: string): string {
  return `${game}-saved-rotations`
}

function readAll(game: string): Record<string, SavedRotation<unknown>[]> {
  try {
    const parsed: unknown = JSON.parse(readStorage(storageKey(game)) ?? '{}')
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, SavedRotation<unknown>[]> : {}
  } catch {
    return {}
  }
}

// Saved rotations of one character, skipping anything that isn't a named rotation
export function savedRotations<R>(game: string, characterId: string): SavedRotation<R>[] {
  const list = readAll(game)[characterId]
  if (!Array.isArray(list)) return []
  return list.filter((entry): entry is SavedRotation<R> =>
    typeof entry === 'object' && entry !== null && typeof entry.name === 'string' && typeof entry.rotation === 'object' && entry.rotation !== null
  )
}

// Saves under a name; the same name replaces the old one. Keeps the newest MAX_SAVED_ROTATIONS
export function saveRotation<R>(game: string, characterId: string, name: string, rotation: R): SavedRotation<R>[] {
  const all = readAll(game)
  const list = [{ name, rotation }, ...savedRotations<R>(game, characterId).filter((entry) => entry.name !== name)].slice(0, MAX_SAVED_ROTATIONS)
  writeStorage(storageKey(game), JSON.stringify({ ...all, [characterId]: list }))
  return list
}

export function deleteRotation<R>(game: string, characterId: string, name: string): SavedRotation<R>[] {
  const all = readAll(game)
  const list = savedRotations<R>(game, characterId).filter((entry) => entry.name !== name)
  writeStorage(storageKey(game), JSON.stringify({ ...all, [characterId]: list }))
  return list
}
