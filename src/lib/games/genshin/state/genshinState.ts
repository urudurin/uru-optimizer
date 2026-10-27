import type {
  Artifact,
  ArtifactSlot,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import {
  backupKindOf,
  wrapBackup,
} from 'lib/games/shared/backup'
import {
  equipSlots,
  type Loadouts,
  piecesTaken,
} from 'lib/games/shared/equip'
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

// Makes these artifacts the character's current ones in the browser save, swapping with whoever wore them (see
// shared/equip.ts). Characters whose artifacts changed lose their Enka stats, which no longer match; the Characters
// page then shows calculated ones
export function equipGenshinArtifacts(data: GenshinData, characterId: string, artifacts: Artifact[]): GenshinData {
  const loadouts: Loadouts<ArtifactSlot> = new Map(data.characters.map((c) => [c.id, { ...c.artifactIds }]))
  const change = equipSlots(loadouts, characterId, artifacts.map((a) => ({ slot: a.slot, id: a.id })))
  return {
    artifacts: data.artifacts.map((artifact) => {
      if (!change.owners.has(artifact.id)) return artifact
      const owner = change.owners.get(artifact.id)
      const { equippedBy: _, ...rest } = artifact
      return owner ? { ...rest, equippedBy: owner } : rest
    }),
    characters: data.characters.map((character) =>
      change.changedOwners.has(character.id) ? { ...character, artifactIds: loadouts.get(character.id) ?? {}, stats: {} } : character
    ),
  }
}

// What a character added by hand has (or what can be changed on a saved one)
export type GenshinCharacterDetails = Pick<GenshinCharacter, 'id' | 'name' | 'element' | 'level' | 'constellation' | 'weapon'>

// Adds a character by hand, or changes a saved one's level, constellation or weapon. A change clears their Enka stats,
// which no longer match; the Characters page then shows calculated ones. Their artifacts stay as they are
export function saveGenshinCharacter(data: GenshinData, details: GenshinCharacterDetails): GenshinData {
  const existing = data.characters.find((c) => c.id === details.id)
  if (!existing) {
    const added: GenshinCharacter = { ...details, artifactIds: {}, stats: {}, statsDate: '' }
    return { ...data, characters: [...data.characters, added] }
  }
  const same = (a?: GenshinCharacter['weapon'], b?: GenshinCharacter['weapon']) => a?.id === b?.id && a?.level === b?.level && a?.refinement === b?.refinement
  const changed = existing.level !== details.level || existing.constellation !== details.constellation || !same(existing.weapon, details.weapon)
  const updated: GenshinCharacter = { ...existing, ...details, ...(changed ? { stats: {}, ascension: undefined } : {}) }
  return { ...data, characters: data.characters.map((c) => (c === existing ? updated : c)) }
}

// Adds an artifact by hand or replaces an edited one (same id). A worn artifact that moved to another slot comes off
// its character; whoever wears a changed artifact loses their Enka stats, which no longer match
export function saveGenshinArtifact(data: GenshinData, artifact: Artifact): GenshinData {
  const old = data.artifacts.find((a) => a.id === artifact.id)
  if (!old) return { ...data, artifacts: [...data.artifacts, artifact] }
  const owner = artifact.equippedBy
  const moved = owner !== undefined && old.slot !== artifact.slot
  const saved: Artifact = moved ? withoutOwner(artifact) : artifact
  return {
    artifacts: data.artifacts.map((a) => (a.id === artifact.id ? saved : a)),
    characters: data.characters.map((c) => {
      if (c.id !== owner) return c
      const artifactIds = moved ? Object.fromEntries(Object.entries(c.artifactIds).filter(([, id]) => id !== artifact.id)) : c.artifactIds
      return { ...c, artifactIds, stats: {} }
    }),
  }
}

// Deletes artifacts from the save, taking them off whoever wore them (who lose their Enka stats)
export function deleteGenshinArtifacts(data: GenshinData, ids: string[]): GenshinData {
  const gone = new Set(ids)
  return {
    artifacts: data.artifacts.filter((a) => !gone.has(a.id)),
    characters: data.characters.map((c) =>
      Object.values(c.artifactIds).some((id) => id && gone.has(id))
        ? { ...c, artifactIds: Object.fromEntries(Object.entries(c.artifactIds).filter(([, id]) => !id || !gone.has(id))), stats: {} }
        : c
    ),
  }
}

function withoutOwner(artifact: Artifact): Artifact {
  const { equippedBy: _, ...rest } = artifact
  return rest
}

// Who would lose artifacts to this character, by character id
export function genshinPiecesTaken(data: GenshinData, characterId: string, artifacts: Artifact[]): string[] {
  const loadouts: Loadouts<ArtifactSlot> = new Map(data.characters.map((c) => [c.id, c.artifactIds]))
  return [...new Set(piecesTaken(loadouts, characterId, artifacts.map((a) => ({ slot: a.slot, id: a.id }))).map((t) => t.owner))]
}
