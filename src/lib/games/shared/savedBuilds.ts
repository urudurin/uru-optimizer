import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'

// Builds a user saved by name from the optimizer, after HSR's sidebar Builds group (Save / Load, SaveBuildModal and
// BuildsModal): which pieces, per game and character, to look at or equip again later. Kept in localStorage
// `<game>-saved-builds` as { [characterId]: SavedBuild[] }, newest first, and carried in backups (shared/backup.ts).

export type SavedBuild = { name: string, pieceIds: string[], savedAt: string }

export const MAX_SAVED_BUILDS = 20

function storageKey(game: string): string {
  return `${game}-saved-builds`
}

function readAll(game: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readStorage(storageKey(game)) ?? '{}')
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

// One character's saved builds, skipping anything that isn't one
export function savedBuilds(game: string, characterId: string): SavedBuild[] {
  const list = readAll(game)[characterId]
  if (!Array.isArray(list)) return []
  return list.filter((entry): entry is SavedBuild =>
    typeof entry === 'object' && entry !== null && typeof entry.name === 'string' && Array.isArray(entry.pieceIds)
    && entry.pieceIds.every((id: unknown) => typeof id === 'string') && typeof entry.savedAt === 'string'
  )
}

// Saves under a name; the same name replaces the old one. Keeps the newest MAX_SAVED_BUILDS
export function saveBuild(game: string, characterId: string, name: string, pieceIds: string[], savedAt: string): SavedBuild[] {
  const list = [{ name, pieceIds, savedAt }, ...savedBuilds(game, characterId).filter((b) => b.name !== name)].slice(0, MAX_SAVED_BUILDS)
  writeStorage(storageKey(game), JSON.stringify({ ...readAll(game), [characterId]: list }))
  return list
}

export function deleteSavedBuild(game: string, characterId: string, name: string): SavedBuild[] {
  const list = savedBuilds(game, characterId).filter((b) => b.name !== name)
  writeStorage(storageKey(game), JSON.stringify({ ...readAll(game), [characterId]: list }))
  return list
}
