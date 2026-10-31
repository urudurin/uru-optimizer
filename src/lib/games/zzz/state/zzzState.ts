import {
  backupKindOf,
  type BackupSettings,
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
export function createZzzBackup(data: ZzzData, savedAt: string, settings?: BackupSettings): string {
  return wrapBackup(ZZZ_BACKUP_KIND, savedAt, serializeZzzData(data), settings)
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
  // Give a previous owner this agent's old disc (true) or leave their slot empty (shared/gameSettings.ts)
  swap = true,
): ZzzData {
  const loadouts: Loadouts<DiscSlot> = new Map(data.builds.map((b) => [b.agentId, { ...b.discIds }]))
  // Discs the source says someone wears without a build for them still count as theirs
  for (const disc of data.discs) {
    if (!disc.equippedBy || ownersOf(loadouts).has(disc.id)) continue
    const slots = loadouts.get(disc.equippedBy) ?? {}
    if (!slots[disc.slot]) slots[disc.slot] = disc.id
    loadouts.set(disc.equippedBy, slots)
  }
  const change = equipSlots(loadouts, agent.id, discs.map((d) => ({ slot: d.slot, id: d.id })), swap)

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

// Adds a disc by hand or replaces an edited one (same id). A worn disc that moved to another slot comes off its agent
export function saveZzzDisc(data: ZzzData, disc: Disc): ZzzData {
  const old = data.discs.find((d) => d.id === disc.id)
  if (!old) return { ...data, discs: [...data.discs, disc] }
  const moved = old.slot !== disc.slot && disc.equippedBy !== undefined
  const saved: Disc = moved ? withoutOwner(disc) : disc
  return {
    discs: data.discs.map((d) => (d.id === disc.id ? saved : d)),
    builds: moved ? data.builds.map((b) => (b.discIds[old.slot] === disc.id ? { ...b, discIds: { ...b.discIds, [old.slot]: undefined } } : b)) : data.builds,
  }
}

// Deletes discs from the save, taking them off whoever wore them
export function deleteZzzDiscs(data: ZzzData, ids: string[]): ZzzData {
  const gone = new Set(ids)
  return {
    discs: data.discs.filter((d) => !gone.has(d.id)),
    builds: data.builds.map((b) =>
      Object.values(b.discIds).some((id) => id && gone.has(id))
        ? { ...b, discIds: Object.fromEntries(Object.entries(b.discIds).filter(([, id]) => !id || !gone.has(id))) }
        : b
    ),
  }
}

function withoutOwner(disc: Disc): Disc {
  const { equippedBy: _, ...rest } = disc
  return rest
}

// Puts one disc on an agent with a saved build or, with null, takes it off whoever wears it: the gear editor's "Equipped by", after
// HSR's relic editor (lib/overlays/modals/relicModal). Taking it from someone works like the optimizer's Equip
// The Characters page's Character menu, after HSR's (Unequip character, Switch relics with, Delete character)
// ZZZ works on one saved build (an agent can have several). Takes off all of a build's discs
export function unequipZzzBuild(data: ZzzData, buildId: string): ZzzData {
  const build = data.builds.find((b) => b.id === buildId)
  if (!build) return data
  const worn = new Set(Object.values(build.discIds).filter((x): x is string => !!x))
  return {
    discs: data.discs.map((d) => (worn.has(d.id) && d.equippedBy === build.agentId ? withoutOwner(d) : d)),
    builds: data.builds.map((b) => (b.id === buildId ? { ...b, discIds: {} } : b)),
  }
}

// Swaps two builds' discs
export function switchZzzDiscs(data: ZzzData, a: string, b: string): ZzzData {
  const first = data.builds.find((x) => x.id === a)
  const second = data.builds.find((x) => x.id === b)
  if (!first || !second || a === b) return data
  const owner = new Map<string, string>()
  for (const id of Object.values(first.discIds)) if (id) owner.set(id, second.agentId)
  for (const id of Object.values(second.discIds)) if (id) owner.set(id, first.agentId)
  return {
    discs: data.discs.map((d) => (owner.has(d.id) ? { ...d, equippedBy: owner.get(d.id) } : d)),
    builds: data.builds.map((x) => {
      if (x.id === a) return { ...x, discIds: { ...second.discIds } }
      if (x.id === b) return { ...x, discIds: { ...first.discIds } }
      return x
    }),
  }
}

// Removes a build from the save; its discs stay, unequipped
export function deleteZzzBuild(data: ZzzData, buildId: string): ZzzData {
  const unequipped = unequipZzzBuild(data, buildId)
  return { ...unequipped, builds: unequipped.builds.filter((b) => b.id !== buildId) }
}

export function assignZzzDisc(data: ZzzData, discId: string, agentId: string | null, swap = true): ZzzData {
  const disc = data.discs.find((d) => d.id === discId)
  if (!disc) return data
  const wearer = data.builds.find((b) => b.discIds[disc.slot] === discId)?.agentId ?? disc.equippedBy
  if ((wearer ?? null) === agentId) return data
  if (agentId) {
    const build = data.builds.find((b) => b.agentId === agentId)
    if (!build) return data
    const agent = { id: build.agentId, name: build.name, element: build.element, specialty: build.specialty, level: build.level }
    return equipZzzDiscs(data, agent, { id: build.wEngineId ?? '', refinement: build.wEngineRefinement }, [disc], swap)
  }
  return {
    discs: data.discs.map((d) => (d.id === discId ? withoutOwner(d) : d)),
    builds: data.builds.map((b) => (b.discIds[disc.slot] === discId ? { ...b, discIds: { ...b.discIds, [disc.slot]: undefined } } : b)),
  }
}

// Who would lose discs to this agent, by agent id
export function zzzPiecesTaken(data: ZzzData, agentId: string, discs: Disc[]): string[] {
  const loadouts: Loadouts<DiscSlot> = new Map(data.builds.map((b) => [b.agentId, { ...b.discIds }]))
  for (const disc of data.discs) {
    if (disc.equippedBy && !ownersOf(loadouts).has(disc.id)) loadouts.set(disc.equippedBy, { ...loadouts.get(disc.equippedBy), [disc.slot]: disc.id })
  }
  return [...new Set(piecesTaken(loadouts, agentId, discs.map((d) => ({ slot: d.slot, id: d.id }))).map((t) => t.owner))]
}
