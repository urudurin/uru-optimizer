import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
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

// Pure save and merge logic for Genshin data. Storage and zustand wiring live in genshinStore.ts.
// Genshin uses its own localStorage key so HSR's 'state' save is never read or written.

export const GENSHIN_STATE_KEY = 'genshin-state'
export const GENSHIN_STATE_VERSION = 1
export const GENSHIN_BACKUP_KIND = 'uru-genshin-backup'

export type GenshinData = {
  artifacts: Artifact[],
  characters: GenshinCharacter[],
}

export const EMPTY_GENSHIN_DATA: GenshinData = { artifacts: [], characters: [] }

// GOOD files have no final stats or weapon numbers: an incoming character without them keeps the ones an Enka import
// saved (stats are dated, so the page can say how old they are)
function keepEnkaDetails(existing: GenshinCharacter[], incoming: GenshinCharacter[]): GenshinCharacter[] {
  const byId = new Map(existing.map((c) => [c.id, c]))
  return incoming.map((character) => {
    const old = byId.get(character.id)
    if (!old) return character
    const kept = Object.keys(character.stats).length === 0 && Object.keys(old.stats).length > 0
      ? { ...character, stats: old.stats, statsDate: old.statsDate }
      : character
    const weapon = kept.weapon
    if (weapon && weapon.baseAtk === undefined && old.weapon?.id === weapon.id && old.weapon.level === weapon.level) {
      return { ...kept, weapon: { ...old.weapon, refinement: weapon.refinement } }
    }
    return kept
  })
}

export function mergeGenshinData(existing: GenshinData, received: GenshinData, mode: ImportMode): GenshinData {
  const incoming = { ...received, characters: keepEnkaDetails(existing.characters, received.characters) }
  if (mode === 'replace') return incoming
  // Artifacts a re-imported character no longer wears stay in the inventory, but not as theirs
  const reimported = new Set(incoming.characters.map((c) => c.id))
  const incomingIds = new Set(incoming.artifacts.map((a) => a.id))
  const released = existing.artifacts.map((artifact) =>
    artifact.equippedBy && reimported.has(artifact.equippedBy) && !incomingIds.has(artifact.id)
      ? { ...artifact, equippedBy: undefined }
      : artifact
  )
  return {
    artifacts: mergeById(released, incoming.artifacts, 'merge'),
    characters: mergeById(existing.characters, incoming.characters, 'merge'),
  }
}

export function serializeGenshinData(data: GenshinData): string {
  return JSON.stringify({ version: GENSHIN_STATE_VERSION, ...data })
}

// Never throws: missing, corrupted or newer-version data loads as empty
export function deserializeGenshinData(text: string | null): GenshinData {
  const save = parseVersionedSave(text, GENSHIN_STATE_VERSION)
  if (!save) return EMPTY_GENSHIN_DATA
  return {
    artifacts: Array.isArray(save.artifacts) ? save.artifacts.filter(hasStringId) as Artifact[] : [],
    characters: Array.isArray(save.characters) ? save.characters.filter(hasStringId) as GenshinCharacter[] : [],
  }
}

// A backup file of the browser save, see shared/backup.ts. savedAt is YYYY-MM-DD
export function createGenshinBackup(data: GenshinData, savedAt: string): string {
  return wrapBackup(GENSHIN_BACKUP_KIND, savedAt, serializeGenshinData(data))
}

// The data in a Genshin backup file, or undefined when the text isn't one. Never throws
export function readGenshinBackup(text: string): GenshinData | undefined {
  if (backupKindOf(text) !== GENSHIN_BACKUP_KIND) return undefined
  return deserializeGenshinData(text)
}
