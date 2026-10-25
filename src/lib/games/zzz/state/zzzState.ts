import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import type { Disc } from 'lib/games/zzz/types'

// Pure save/merge logic for ZZZ data. Storage and zustand wiring live in zzzStore.ts.
// ZZZ uses its own localStorage key so HSR's 'state' save is never read or written.

export const ZZZ_STATE_KEY = 'zzz-state'
export const ZZZ_STATE_VERSION = 1

export type ImportMode = 'replace' | 'merge'

export type ZzzData = {
  discs: Disc[],
  builds: ImportedBuild[],
}

type ZzzSaveFormat = ZzzData & {
  version: number,
}

// 'merge' keeps what's already stored and lets incoming entries win on the same id
export function mergeById<T extends { id: string }>(existing: T[], incoming: T[], mode: ImportMode): T[] {
  if (mode === 'replace') return incoming

  const byId = new Map(existing.map((item) => [item.id, item]))
  for (const item of incoming) {
    byId.set(item.id, item)
  }
  return [...byId.values()]
}

export function serializeZzzData(data: ZzzData): string {
  const save: ZzzSaveFormat = { version: ZZZ_STATE_VERSION, discs: data.discs, builds: data.builds }
  return JSON.stringify(save)
}

function hasStringId(value: unknown): value is { id: string } {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string'
}

// Never throws: missing, corrupted or newer-version data loads as empty
export function deserializeZzzData(text: string | null): ZzzData {
  const empty: ZzzData = { discs: [], builds: [] }
  if (!text) return empty

  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) return empty

    const { version, discs, builds } = parsed as Partial<Record<keyof ZzzSaveFormat, unknown>>
    if (version !== ZZZ_STATE_VERSION) return empty

    return {
      discs: Array.isArray(discs) ? discs.filter(hasStringId) as Disc[] : [],
      builds: Array.isArray(builds) ? builds.filter(hasStringId) as ImportedBuild[] : [],
    }
  } catch {
    return empty
  }
}
