import {
  hasStringId,
  parseVersionedSave,
} from 'lib/games/shared/storage'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import type { Disc } from 'lib/games/zzz/types'

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

// Never throws: missing, corrupted or newer-version data loads as empty
export function deserializeZzzData(text: string | null): ZzzData {
  const save = parseVersionedSave(text, ZZZ_STATE_VERSION)
  if (!save) return { discs: [], builds: [] }

  return {
    discs: Array.isArray(save.discs) ? save.discs.filter(hasStringId) as Disc[] : [],
    builds: Array.isArray(save.builds) ? save.builds.filter(hasStringId) as ImportedBuild[] : [],
  }
}
