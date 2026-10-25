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
  deserializeZzzData,
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

  clear: () => {
    save([], [])
    set({ discs: [], builds: [], lastWarnings: [] })
  },
}))
