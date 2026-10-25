import {
  readPresetImport,
  type StoredPresetImport,
  todayString,
  writePresetImport,
} from 'lib/games/shared/importedPresets'
import { create } from 'zustand'

// The user's imported preset file, kept as raw text in this browser only (key 'zzz-imported-presets'). It's parsed
// where it's used, so presets for agents added later start working without a re-import.

type PresetImportStore = {
  stored: StoredPresetImport | undefined,
  importText: (text: string) => void,
  clear: () => void,
}

export const usePresetImportStore = create<PresetImportStore>()((set) => ({
  stored: readPresetImport('zzz'),

  importText: (text) => {
    const stored = { text, importedAt: todayString(new Date()) }
    if (!writePresetImport('zzz', stored)) console.error('Failed to save imported ZZZ presets (storage blocked or quota exceeded?)')
    set({ stored })
  },

  clear: () => {
    writePresetImport('zzz', undefined)
    set({ stored: undefined })
  },
}))
