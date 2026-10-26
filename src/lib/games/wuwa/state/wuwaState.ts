import {
  backupKindOf,
  wrapBackup,
} from 'lib/games/shared/backup'
import {
  hasStringId,
  type ImportMode,
  mergeById,
  parseVersionedSave,
} from 'lib/games/shared/storage'
import type {
  CharacterState,
  Echo,
  SavedTeam,
} from 'lib/games/wuwa/types'

// Pure save and merge logic for WuWa data. Storage and zustand wiring live in wuwaStore.ts.
// WuWa uses its own localStorage key so HSR's 'state' save is never read or written.

export const WUWA_STATE_KEY = 'wuwa-state'
export const WUWA_STATE_VERSION = 1

export type WuwaData = {
  echoes: Echo[],
  characters: CharacterState[],
  teams: SavedTeam[],
  priority: string[],
}

export const EMPTY_WUWA_DATA: WuwaData = { echoes: [], characters: [], teams: [], priority: [] }

// Characters are identified by charId, so they're merged the same way as echoes are by id
function mergeCharacters(existing: CharacterState[], incoming: CharacterState[], mode: ImportMode): CharacterState[] {
  const asItems = (list: CharacterState[]) => list.map((character) => ({ id: character.charId, character }))
  return mergeById(asItems(existing), asItems(incoming), mode).map((item) => item.character)
}

export function mergeWuwaData(existing: WuwaData, incoming: WuwaData, mode: ImportMode): WuwaData {
  return {
    echoes: mergeById(existing.echoes, incoming.echoes, mode),
    characters: mergeCharacters(existing.characters, incoming.characters, mode),
    teams: mergeById(existing.teams, incoming.teams, mode),
    priority: mode === 'replace' || incoming.priority.length > 0 ? incoming.priority : existing.priority,
  }
}

export function serializeWuwaData(data: WuwaData): string {
  return JSON.stringify({ version: WUWA_STATE_VERSION, ...data })
}

export const WUWA_BACKUP_KIND = 'uru-wuwa-backup'

// A backup file of the browser save, see shared/backup.ts. savedAt is YYYY-MM-DD.
// It's a different shape from the WuwaEchoScorer user-data file, which the "kind" marker tells apart
export function createWuwaBackup(data: WuwaData, savedAt: string): string {
  return wrapBackup(WUWA_BACKUP_KIND, savedAt, serializeWuwaData(data))
}

// The data in a WuWa backup file, or undefined when the text isn't one. Never throws
export function readWuwaBackup(text: string): WuwaData | undefined {
  if (backupKindOf(text) !== WUWA_BACKUP_KIND) return undefined
  return deserializeWuwaData(text)
}

function hasCharId(value: unknown): value is CharacterState {
  return typeof value === 'object' && value !== null && typeof (value as { charId?: unknown }).charId === 'string'
}

// Never throws: missing, corrupted or newer-version data loads as empty
export function deserializeWuwaData(text: string | null): WuwaData {
  const save = parseVersionedSave(text, WUWA_STATE_VERSION)
  if (!save) return EMPTY_WUWA_DATA

  return {
    echoes: Array.isArray(save.echoes) ? save.echoes.filter(hasStringId) as Echo[] : [],
    characters: Array.isArray(save.characters) ? save.characters.filter(hasCharId) : [],
    teams: Array.isArray(save.teams) ? save.teams.filter(hasStringId) as SavedTeam[] : [],
    priority: Array.isArray(save.priority) ? save.priority.filter((id): id is string => typeof id === 'string') : [],
  }
}
