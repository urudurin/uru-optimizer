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
import {
  type CharacterState,
  type Echo,
  MAX_LOADOUT_ECHOES,
  type SavedTeam,
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

// Makes these echoes the Resonator's current ones in the browser save, 4-cost first as the main echo. Echoes another
// Resonator wore are taken off them (WuWa has no fixed slots to swap). Changes the browser save only, never the game
export function equipWuwaEchoes(data: WuwaData, charId: string, echoes: Echo[]): WuwaData {
  const ids = new Set(echoes.map((e) => e.id))
  const ordered = [...echoes].sort((a, b) => b.cost - a.cost).map((e) => e.id)
  const echoIds = Array.from({ length: MAX_LOADOUT_ECHOES }, (_, i) => ordered[i] ?? null)
  return {
    ...data,
    characters: data.characters.map((character) => {
      if (character.charId === charId) return { ...character, echoIds }
      if (!character.echoIds.some((id) => id && ids.has(id))) return character
      return { ...character, echoIds: character.echoIds.map((id) => (id && ids.has(id) ? null : id)) }
    }),
  }
}

// Adds a Resonator by hand, or updates the details of one already saved. Their echoes stay as they are
export function saveWuwaCharacter(data: WuwaData, details: Omit<CharacterState, 'echoIds'>): WuwaData {
  const existing = data.characters.find((c) => c.charId === details.charId)
  if (existing) return { ...data, characters: data.characters.map((c) => (c === existing ? { ...existing, ...details } : c)) }
  const added: CharacterState = { ...details, echoIds: Array.from({ length: MAX_LOADOUT_ECHOES }, () => null) }
  return { ...data, characters: [...data.characters, added] }
}

// Adds an echo by hand or replaces an edited one (same id). A worn echo whose cost changed comes off its Resonator,
// since their loadout's cost no longer adds up the same
export function saveWuwaEcho(data: WuwaData, echo: Echo): WuwaData {
  const old = data.echoes.find((e) => e.id === echo.id)
  if (!old) return { ...data, echoes: [...data.echoes, echo] }
  const echoes = data.echoes.map((e) => (e.id === echo.id ? echo : e))
  if (old.cost === echo.cost) return { ...data, echoes }
  return { ...data, echoes, characters: data.characters.map((c) => withoutEchoes(c, new Set([echo.id]))) }
}

// Deletes echoes from the save, taking them off whoever wore them
export function deleteWuwaEchoes(data: WuwaData, ids: string[]): WuwaData {
  const gone = new Set(ids)
  return { ...data, echoes: data.echoes.filter((e) => !gone.has(e.id)), characters: data.characters.map((c) => withoutEchoes(c, gone)) }
}

function withoutEchoes(character: CharacterState, ids: Set<string>): CharacterState {
  if (!character.echoIds.some((id) => id && ids.has(id))) return character
  return { ...character, echoIds: character.echoIds.map((id) => (id && ids.has(id) ? null : id)) }
}

// Who would lose echoes to this Resonator, by charId
export function wuwaPiecesTaken(data: WuwaData, charId: string, echoes: Echo[]): string[] {
  const ids = new Set(echoes.map((e) => e.id))
  return data.characters.filter((c) => c.charId !== charId && c.echoIds.some((id) => id && ids.has(id))).map((c) => c.charId)
}
