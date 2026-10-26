import {
  type ImportMode,
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import type { ParsedWuwaData } from 'lib/games/wuwa/importer/userDataParser'
import {
  deserializeWuwaData,
  EMPTY_WUWA_DATA,
  equipWuwaEchoes,
  mergeWuwaData,
  serializeWuwaData,
  WUWA_STATE_KEY,
  type WuwaData,
} from 'lib/games/wuwa/state/wuwaState'
import type { Echo } from 'lib/games/wuwa/types'
import { create } from 'zustand'

function save(data: WuwaData) {
  if (!writeStorage(WUWA_STATE_KEY, serializeWuwaData(data))) {
    console.error('Failed to save WuWa data (storage blocked or quota exceeded?)')
  }
}

type WuwaStore = WuwaData & {
  // Warnings from the most recent import, not persisted
  lastWarnings: string[],
  importParsed: (parsed: ParsedWuwaData, mode: ImportMode) => void,
  // Makes these the Resonator's echoes in this browser's save, see equipWuwaEchoes
  equip: (charId: string, echoes: Echo[]) => void,
  clear: () => void,
}

export const useWuwaStore = create<WuwaStore>()((set, get) => ({
  ...deserializeWuwaData(readStorage(WUWA_STATE_KEY)),
  lastWarnings: [],

  importParsed: (parsed, mode) => {
    // An import that found nothing never wipes existing data, even in replace mode
    if (parsed.echoes.length === 0 && parsed.characters.length === 0) {
      set({ lastWarnings: parsed.warnings })
      return
    }
    const { echoes, characters, teams, priority } = get()
    const data = mergeWuwaData({ echoes, characters, teams, priority }, parsed, mode)
    save(data)
    set({ ...data, lastWarnings: parsed.warnings })
  },

  equip: (charId, echoes) => {
    const { echoes: saved, characters, teams, priority } = get()
    const data = equipWuwaEchoes({ echoes: saved, characters, teams, priority }, charId, echoes)
    save(data)
    set(data)
  },

  clear: () => {
    save(EMPTY_WUWA_DATA)
    set({ ...EMPTY_WUWA_DATA, lastWarnings: [] })
  },
}))
