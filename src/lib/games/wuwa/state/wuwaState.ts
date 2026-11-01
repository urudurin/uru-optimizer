import {
  backupKindOf,
  type BackupSettings,
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
  MAX_LOADOUT_COST,
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
export function createWuwaBackup(data: WuwaData, savedAt: string, settings?: BackupSettings): string {
  return wrapBackup(WUWA_BACKUP_KIND, savedAt, serializeWuwaData(data), settings)
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
// swap (shared/gameSettings.ts): someone losing an echo gets one of this Resonator's dropped echoes of the same cost
// instead, which keeps their cost the same; without one, or without swap, their slot empties
export function equipWuwaEchoes(data: WuwaData, charId: string, echoes: Echo[], swap = false): WuwaData {
  const ids = new Set(echoes.map((e) => e.id))
  const ordered = [...echoes].sort((a, b) => b.cost - a.cost).map((e) => e.id)
  const echoIds = Array.from({ length: MAX_LOADOUT_ECHOES }, (_, i) => ordered[i] ?? null)
  const byId = new Map(data.echoes.map((e) => [e.id, e]))
  const dropped = swap
    ? (data.characters.find((c) => c.charId === charId)?.echoIds ?? []).flatMap((id) => (id && !ids.has(id) && byId.has(id) ? [byId.get(id)!] : []))
    : []
  const giveFor = (takenId: string): string | null => {
    const cost = byId.get(takenId)?.cost
    const index = dropped.findIndex((e) => e.cost === cost)
    return index < 0 ? null : dropped.splice(index, 1)[0].id
  }
  return {
    ...data,
    characters: data.characters.map((character) => {
      if (character.charId === charId) return { ...character, echoIds }
      if (!character.echoIds.some((id) => id && ids.has(id))) return character
      return { ...character, echoIds: character.echoIds.map((id) => (id && ids.has(id) ? giveFor(id) : id)) }
    }),
  }
}

// Puts one echo on a Resonator or, with null, takes it off whoever wears it: the gear editor's "Equipped by", after
// HSR's relic editor (lib/overlays/modals/relicModal). Taking it from someone works like the optimizer's Equip
// WuWa has no slots, so room is made under the 5-echo, 12-cost limits: an echo of the same cost comes off first, then
// the costliest ones
// The Characters page's Character menu, after HSR's (Unequip character, Switch relics with, Delete character)
// Takes off all of a Resonator's echoes
export function unequipWuwaCharacter(data: WuwaData, charId: string): WuwaData {
  return {
    ...data,
    characters: data.characters.map((c) => (c.charId === charId ? { ...c, echoIds: Array.from({ length: MAX_LOADOUT_ECHOES }, () => null) } : c)),
  }
}

// Swaps two Resonators' echoes
export function switchWuwaEchoes(data: WuwaData, a: string, b: string): WuwaData {
  const first = data.characters.find((c) => c.charId === a)
  const second = data.characters.find((c) => c.charId === b)
  if (!first || !second || a === b) return data
  return {
    ...data,
    characters: data.characters.map((c) => {
      if (c.charId === a) return { ...c, echoIds: [...second.echoIds] }
      if (c.charId === b) return { ...c, echoIds: [...first.echoIds] }
      return c
    }),
  }
}

// Removes a Resonator from the save (and the priority list); their echoes stay, unequipped
export function deleteWuwaCharacter(data: WuwaData, charId: string): WuwaData {
  return { ...data, characters: data.characters.filter((c) => c.charId !== charId), priority: data.priority.filter((id) => id !== charId) }
}

export function assignWuwaEcho(data: WuwaData, echoId: string, charId: string | null, swap = false): WuwaData {
  const echo = data.echoes.find((e) => e.id === echoId)
  if (!echo) return data
  const wearer = data.characters.find((c) => c.echoIds.includes(echoId))?.charId ?? null
  if (wearer === charId) return data
  if (!charId) {
    return {
      ...data,
      characters: data.characters.map((c) => (c.charId === wearer ? { ...c, echoIds: c.echoIds.map((id) => (id === echoId ? null : id)) } : c)),
    }
  }
  const character = data.characters.find((c) => c.charId === charId)
  if (!character) return data
  const byId = new Map(data.echoes.map((e) => [e.id, e]))
  let worn = character.echoIds.flatMap((id) => (id && byId.has(id) ? [byId.get(id)!] : []))
  const fits = (list: Echo[]) => list.length < MAX_LOADOUT_ECHOES && list.reduce((sum, e) => sum + e.cost, 0) + echo.cost <= MAX_LOADOUT_COST
  if (!fits(worn)) {
    const same = worn.findIndex((e) => e.cost === echo.cost)
    if (same >= 0) worn = worn.filter((_, i) => i !== same)
  }
  while (!fits(worn) && worn.length > 0) {
    const costliest = worn.reduce((a, b) => (b.cost > a.cost ? b : a))
    worn = worn.filter((e) => e !== costliest)
  }
  return equipWuwaEchoes(data, charId, [...worn, echo], swap)
}

// Adds a Resonator by hand, or updates the details of one already saved. Their echoes stay as they are
// Adds a Resonator the save doesn't have yet (a default one from state/roster.ts), so their echoes can be changed
export function withWuwaCharacter(data: WuwaData, character: CharacterState): WuwaData {
  return data.characters.some((c) => c.charId === character.charId) ? data : { ...data, characters: [...data.characters, character] }
}

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
