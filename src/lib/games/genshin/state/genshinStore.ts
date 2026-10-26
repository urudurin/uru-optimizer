import {
  deserializeGenshinData,
  EMPTY_GENSHIN_DATA,
  equipGenshinArtifacts,
  GENSHIN_STATE_KEY,
  type GenshinData,
  mergeGenshinData,
  serializeGenshinData,
} from 'lib/games/genshin/state/genshinState'
import type { Artifact } from 'lib/games/genshin/types'
import {
  type ImportMode,
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { create } from 'zustand'

function save(data: GenshinData) {
  if (!writeStorage(GENSHIN_STATE_KEY, serializeGenshinData(data))) {
    console.error('Failed to save Genshin data (storage blocked or quota exceeded?)')
  }
}

type GenshinStore = GenshinData & {
  // Warnings from the most recent import, not persisted
  lastWarnings: string[],
  importParsed: (parsed: GenshinData & { warnings: string[] }, mode: ImportMode) => void,
  // Makes these the character's artifacts in this browser's save, see equipGenshinArtifacts
  equip: (characterId: string, artifacts: Artifact[]) => void,
  clear: () => void,
}

export const useGenshinStore = create<GenshinStore>()((set, get) => ({
  ...deserializeGenshinData(readStorage(GENSHIN_STATE_KEY)),
  lastWarnings: [],

  importParsed: (parsed, mode) => {
    // An import that found nothing never wipes existing data, even in replace mode
    if (parsed.artifacts.length === 0 && parsed.characters.length === 0) {
      set({ lastWarnings: parsed.warnings })
      return
    }
    const { artifacts, characters } = get()
    const data = mergeGenshinData({ artifacts, characters }, parsed, mode)
    save(data)
    set({ ...data, lastWarnings: parsed.warnings })
  },

  equip: (characterId, artifacts) => {
    const { artifacts: saved, characters } = get()
    const data = equipGenshinArtifacts({ artifacts: saved, characters }, characterId, artifacts)
    save(data)
    set(data)
  },

  clear: () => {
    save(EMPTY_GENSHIN_DATA)
    set({ ...EMPTY_GENSHIN_DATA, lastWarnings: [] })
  },
}))
