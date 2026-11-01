import { createGearStore } from 'lib/games/shared/gearStore'
import { mergeById } from 'lib/games/shared/storage'
import type {
  ImportedBuild,
  ParsedZzzExport,
  ParseWarning,
} from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  assignZzzDisc,
  deleteZzzBuild,
  deleteZzzDiscs,
  deserializeZzzData,
  equipZzzDiscs,
  saveZzzBuild,
  saveZzzDisc,
  serializeZzzData,
  switchZzzDiscs,
  unequipZzzBuild,
  ZZZ_STATE_KEY,
  type ZzzData,
} from 'lib/games/zzz/state/zzzState'
import type { Disc } from 'lib/games/zzz/types'

// The ZZZ save in this browser (zzz-state) on the shared gear store (shared/gearStore.ts): saveGear / deleteGear are
// discs, unequipOwner / switchGear / deleteOwner take a build id (the Agents page's Character menu)
export const useZzzStore = createGearStore<ZzzData, Disc, ParsedZzzExport, ParseWarning, {
  // Makes these the agent's discs in this browser's save, see equipZzzDiscs (which adds a build for an agent without one)
  equip: (agent: Parameters<typeof equipZzzDiscs>[1], wEngine: Parameters<typeof equipZzzDiscs>[2], discs: Disc[]) => void,
  // Adds an agent by hand or changes a saved build's Mindscape and W-Engine, see saveZzzBuild
  saveBuild: (build: ImportedBuild) => void,
}>(
  {
    game: 'zzz',
    storageKey: ZZZ_STATE_KEY,
    empty: { discs: [], builds: [] },
    serialize: serializeZzzData,
    deserialize: deserializeZzzData,
    isEmptyImport: (parsed) => parsed.discs.length === 0 && parsed.builds.length === 0,
    merge: (data, parsed, mode) => ({ discs: mergeById(data.discs, parsed.discs, mode), builds: mergeById(data.builds, parsed.builds, mode) }),
    saveGear: saveZzzDisc,
    deleteGear: deleteZzzDiscs,
    assignGear: assignZzzDisc,
    unequipOwner: unequipZzzBuild,
    switchGear: switchZzzDiscs,
    deleteOwner: deleteZzzBuild,
    itemId: (disc) => disc.id,
  },
  (apply) => ({
    equip: (agent, wEngine, discs) => apply((data, swap) => equipZzzDiscs(data, agent, wEngine, discs, swap)),
    saveBuild: (build) => apply((data) => saveZzzBuild(data, build)),
  }),
)
