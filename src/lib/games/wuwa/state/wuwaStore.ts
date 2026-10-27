import {
  type ImportMode,
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import type { ParsedWuwaData } from 'lib/games/wuwa/importer/userDataParser'
import {
  deleteWuwaEchoes,
  deserializeWuwaData,
  EMPTY_WUWA_DATA,
  equipWuwaEchoes,
  mergeWuwaData,
  saveWuwaCharacter,
  saveWuwaEcho,
  serializeWuwaData,
  WUWA_STATE_KEY,
  type WuwaData,
} from 'lib/games/wuwa/state/wuwaState'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'
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
  // Adds a Resonator by hand or changes their level, sequence and weapon, see saveWuwaCharacter
  saveCharacter: (details: Omit<CharacterState, 'echoIds'>) => void,
  // Adds or edits an echo by hand, or deletes echoes, see saveWuwaEcho / deleteWuwaEchoes
  saveEcho: (echo: Echo) => void,
  deleteEchoes: (ids: string[]) => void,
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

  saveCharacter: (details) => {
    const { echoes, characters, teams, priority } = get()
    const data = saveWuwaCharacter({ echoes, characters, teams, priority }, details)
    save(data)
    set(data)
  },

  saveEcho: (echo) => {
    const { echoes, characters, teams, priority } = get()
    const data = saveWuwaEcho({ echoes, characters, teams, priority }, echo)
    save(data)
    set(data)
  },

  deleteEchoes: (ids) => {
    const { echoes, characters, teams, priority } = get()
    const data = deleteWuwaEchoes({ echoes, characters, teams, priority }, ids)
    save(data)
    set(data)
  },

  clear: () => {
    save(EMPTY_WUWA_DATA)
    set({ ...EMPTY_WUWA_DATA, lastWarnings: [] })
  },
}))
