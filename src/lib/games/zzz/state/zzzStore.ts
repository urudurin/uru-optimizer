import {
  type ImportMode,
  mergeById,
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import type {
  ImportedBuild,
  ParsedZzzExport,
  ParseWarning,
} from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  deleteZzzDiscs,
  deserializeZzzData,
  equipZzzDiscs,
  saveZzzBuild,
  saveZzzDisc,
  serializeZzzData,
  ZZZ_STATE_KEY,
} from 'lib/games/zzz/state/zzzState'
import type { Disc } from 'lib/games/zzz/types'
import { create } from 'zustand'

function save(discs: Disc[], builds: ImportedBuild[]) {
  if (!writeStorage(ZZZ_STATE_KEY, serializeZzzData({ discs, builds }))) {
    console.error('Failed to save ZZZ data (storage blocked or quota exceeded?)')
  }
}

type ZzzStore = {
  discs: Disc[],
  builds: ImportedBuild[],
  // Warnings from the most recent import, not persisted
  lastWarnings: ParseWarning[],
  importParsed: (parsed: ParsedZzzExport, mode: ImportMode) => void,
  // Makes these the agent's discs in this browser's save, see equipZzzDiscs
  equip: (...args: Parameters<typeof equipZzzDiscs> extends [unknown, ...infer Rest] ? Rest : never) => void,
  // Adds an agent by hand or changes a saved build's Mindscape and W-Engine, see saveZzzBuild
  saveBuild: (build: ImportedBuild) => void,
  // Adds or edits a disc by hand, or deletes discs, see saveZzzDisc / deleteZzzDiscs
  saveDisc: (disc: Disc) => void,
  deleteDiscs: (ids: string[]) => void,
  clear: () => void,
}

const initial = deserializeZzzData(readStorage(ZZZ_STATE_KEY))

export const useZzzStore = create<ZzzStore>()((set, get) => ({
  discs: initial.discs,
  builds: initial.builds,
  lastWarnings: [],

  importParsed: (parsed, mode) => {
    // An import that found nothing never wipes existing data, even in replace mode
    if (parsed.discs.length === 0 && parsed.builds.length === 0) {
      set({ lastWarnings: parsed.warnings })
      return
    }

    const state = get()
    const discs = mergeById(state.discs, parsed.discs, mode)
    const builds = mergeById(state.builds, parsed.builds, mode)
    save(discs, builds)
    set({ discs, builds, lastWarnings: parsed.warnings })
  },

  equip: (agent, wEngine, discs) => {
    const state = get()
    const data = equipZzzDiscs({ discs: state.discs, builds: state.builds }, agent, wEngine, discs)
    save(data.discs, data.builds)
    set(data)
  },

  saveBuild: (build) => {
    const state = get()
    const data = saveZzzBuild({ discs: state.discs, builds: state.builds }, build)
    save(data.discs, data.builds)
    set(data)
  },

  saveDisc: (disc) => {
    const state = get()
    const data = saveZzzDisc({ discs: state.discs, builds: state.builds }, disc)
    save(data.discs, data.builds)
    set(data)
  },

  deleteDiscs: (ids) => {
    const state = get()
    const data = deleteZzzDiscs({ discs: state.discs, builds: state.builds }, ids)
    save(data.discs, data.builds)
    set(data)
  },

  clear: () => {
    save([], [])
    set({ discs: [], builds: [], lastWarnings: [] })
  },
}))
