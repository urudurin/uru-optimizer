import {
  backupKindOf,
  wrapBackup,
} from 'lib/games/shared/backup'
import {
  equipSlots,
  type Loadouts,
  ownersOf,
  piecesTaken,
} from 'lib/games/shared/equip'
import {
  hasStringId,
  parseVersionedSave,
} from 'lib/games/shared/storage'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import type {
  Disc,
  DiscSlot,
} from 'lib/games/zzz/types'

// Pure save logic for ZZZ data. Storage and zustand wiring live in zzzStore.ts.
// ZZZ uses its own localStorage key so HSR's 'state' save is never read or written.

export const ZZZ_STATE_KEY = 'zzz-state'
export const ZZZ_STATE_VERSION = 1

export type ZzzData = {
  discs: Disc[],
  builds: ImportedBuild[],
}

type ZzzSaveFormat = ZzzData & {
  version: number,
}

export function serializeZzzData(data: ZzzData): string {
  const save: ZzzSaveFormat = { version: ZZZ_STATE_VERSION, discs: data.discs, builds: data.builds }
  return JSON.stringify(save)
}

export const ZZZ_BACKUP_KIND = 'uru-zzz-backup'

// A backup file of the browser save, see shared/backup.ts. savedAt is YYYY-MM-DD
export function createZzzBackup(data: ZzzData, savedAt: string): string {
  return wrapBackup(ZZZ_BACKUP_KIND, savedAt, serializeZzzData(data))
}

// The data in a ZZZ backup file, or undefined when the text isn't one. Never throws
export function readZzzBackup(text: string): ZzzData | undefined {
  if (backupKindOf(text) !== ZZZ_BACKUP_KIND) return undefined
  return deserializeZzzData(text)
}

// Never throws: missing, corrupted or newer-version data loads as empty
export function deserializeZzzData(text: string | null): ZzzData {
  const save = parseVersionedSave(text, ZZZ_STATE_VERSION)
  if (!save) return { discs: [], builds: [] }

  return {
    discs: Array.isArray(save.discs) ? save.discs.filter(hasStringId) as Disc[] : [],
    builds: Array.isArray(save.builds) ? save.builds.filter(hasStringId) as ImportedBuild[] : [],
  }
}

// Makes these discs the agent's current ones in the browser save, swapping with whoever wore them (see
// shared/equip.ts). An agent without a saved build gets one, with the W-Engine the optimizer used
export function equipZzzDiscs(
  data: ZzzData,
  agent: { id: string, name: string, element: string, specialty: string, level: number },
  wEngine: { id: string, refinement: number },
  discs: Disc[],
): ZzzData {
  const loadouts: Loadouts<DiscSlot> = new Map(data.builds.map((b) => [b.agentId, { ...b.discIds }]))
  // Discs the source says someone wears without a build for them still count as theirs
  for (const disc of data.discs) {
    if (!disc.equippedBy || ownersOf(loadouts).has(disc.id)) continue
    const slots = loadouts.get(disc.equippedBy) ?? {}
    if (!slots[disc.slot]) slots[disc.slot] = disc.id
    loadouts.set(disc.equippedBy, slots)
  }
  const change = equipSlots(loadouts, agent.id, discs.map((d) => ({ slot: d.slot, id: d.id })))

  const builds = data.builds.map((build) => change.changedOwners.has(build.agentId) ? { ...build, discIds: loadouts.get(build.agentId) ?? {} } : build)
  if (!builds.some((b) => b.agentId === agent.id)) {
    builds.push({
      id: `uru-${agent.id}`,
      agentId: agent.id,
      name: agent.name,
      element: agent.element,
      specialty: agent.specialty,
      level: agent.level,
      mindscapeLevel: 0,
      wEngineId: wEngine.id,
      wEngineRefinement: wEngine.refinement,
      discIds: loadouts.get(agent.id) ?? {},
    })
  }
  return {
    builds,
    discs: data.discs.map((disc) => {
      if (!change.owners.has(disc.id)) return disc
      const owner = change.owners.get(disc.id)
      const { equippedBy: _, ...rest } = disc
      return owner ? { ...rest, equippedBy: owner } : rest
    }),
  }
}

// Adds a build by hand (an agent the save didn't have) or changes a saved one, matched by id. Its discs stay as they are
export function saveZzzBuild(data: ZzzData, build: ImportedBuild): ZzzData {
  const exists = data.builds.some((b) => b.id === build.id)
  return { ...data, builds: exists ? data.builds.map((b) => (b.id === build.id ? build : b)) : [...data.builds, build] }
}

// Who would lose discs to this agent, by agent id
export function zzzPiecesTaken(data: ZzzData, agentId: string, discs: Disc[]): string[] {
  const loadouts: Loadouts<DiscSlot> = new Map(data.builds.map((b) => [b.agentId, { ...b.discIds }]))
  for (const disc of data.discs) {
    if (disc.equippedBy && !ownersOf(loadouts).has(disc.id)) loadouts.set(disc.equippedBy, { ...loadouts.get(disc.equippedBy), [disc.slot]: disc.id })
  }
  return [...new Set(piecesTaken(loadouts, agentId, discs.map((d) => ({ slot: d.slot, id: d.id }))).map((t) => t.owner))]
}
