import {
  assignGenshinArtifact,
  deleteGenshinArtifacts,
  deleteGenshinCharacter,
  deserializeGenshinData,
  EMPTY_GENSHIN_DATA,
  equipGenshinArtifacts,
  GENSHIN_STATE_KEY,
  type GenshinCharacterDetails,
  type GenshinData,
  mergeGenshinData,
  saveGenshinArtifact,
  saveGenshinCharacter,
  serializeGenshinData,
  switchGenshinArtifacts,
  unequipGenshinCharacter,
} from 'lib/games/genshin/state/genshinState'
import type { Artifact } from 'lib/games/genshin/types'
import { swapsOnEquip } from 'lib/games/shared/gameSettings'
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
  // Adds a character by hand or changes their level, constellation or weapon, see saveGenshinCharacter
  saveCharacter: (details: GenshinCharacterDetails) => void,
  // The Characters page's Character menu: unequipGenshinCharacter / switchGenshinArtifacts / deleteGenshinCharacter
  unequipCharacter: (id: string) => void,
  switchGear: (a: string, b: string) => void,
  deleteCharacter: (id: string) => void,
  // Adds or edits an artifact by hand, or deletes artifacts, see saveGenshinArtifact / deleteGenshinArtifacts
  // owner (the editor's Equipped by): a character id puts it on them, null takes it off, undefined leaves it
  saveArtifact: (artifact: Artifact, owner?: string | null) => void,
  deleteArtifacts: (ids: string[]) => void,
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
    const data = equipGenshinArtifacts({ artifacts: saved, characters }, characterId, artifacts, swapsOnEquip('genshin'))
    save(data)
    set(data)
  },

  unequipCharacter: (id) => {
    const { artifacts, characters } = get()
    const data = unequipGenshinCharacter({ artifacts, characters }, id)
    save(data)
    set(data)
  },

  switchGear: (a, b) => {
    const { artifacts, characters } = get()
    const data = switchGenshinArtifacts({ artifacts, characters }, a, b)
    save(data)
    set(data)
  },

  deleteCharacter: (id) => {
    const { artifacts, characters } = get()
    const data = deleteGenshinCharacter({ artifacts, characters }, id)
    save(data)
    set(data)
  },

  saveCharacter: (details) => {
    const { artifacts, characters } = get()
    const data = saveGenshinCharacter({ artifacts, characters }, details)
    save(data)
    set(data)
  },

  saveArtifact: (artifact, owner) => {
    const { artifacts, characters } = get()
    const saved = saveGenshinArtifact({ artifacts, characters }, artifact)
    const data = owner === undefined ? saved : assignGenshinArtifact(saved, artifact.id, owner, swapsOnEquip('genshin'))
    save(data)
    set(data)
  },

  deleteArtifacts: (ids) => {
    const { artifacts, characters } = get()
    const data = deleteGenshinArtifacts({ artifacts, characters }, ids)
    save(data)
    set(data)
  },

  clear: () => {
    save(EMPTY_GENSHIN_DATA)
    set({ ...EMPTY_GENSHIN_DATA, lastWarnings: [] })
  },
}))
