import type { GameId } from 'lib/games/games'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'

// Build recommendations the user imports from a file of their own, for example notes taken from a guide site or a
// community spreadsheet. The file lives only in this browser's storage: it's never committed to the repo, and nothing
// here fetches or scrapes anything.
//
// File format, shared by every game (the shape of each preset entry is up to the game):
// {
//   "version": 1,
//   "game": "zzz",
//   "source": "Where these came from, shown next to each preset",
//   "updated": "2026-10-25",
//   "presets": [ { "character": "Miyabi", ... }, ... ]
// }

export const PRESET_FILE_VERSION = 1

export type PresetFile = {
  source: string,
  // YYYY-MM-DD the recommendations were last updated, when the file says
  updated?: string,
  entries: unknown[],
}

export type StoredPresetImport = {
  text: string,
  // YYYY-MM-DD the file was imported, the review date when the file has no "updated"
  importedAt: string,
}

export function presetStorageKey(game: GameId): string {
  return `${game}-imported-presets`
}

export function todayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

// Never throws: anything wrong with the file comes back as a warning
export function parsePresetFile(text: string, game: GameId): { file?: PresetFile, warnings: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { warnings: ['The file isn\'t valid JSON'] }
  }
  if (!isRecord(parsed)) return { warnings: ['Expected an object with "version", "game", "source" and "presets"'] }
  if (parsed.version !== PRESET_FILE_VERSION) return { warnings: [`Expected "version": ${PRESET_FILE_VERSION}`] }
  if (parsed.game !== game) return { warnings: [`This file is for "${String(parsed.game)}", not "${game}"`] }
  if (!Array.isArray(parsed.presets)) return { warnings: ['Expected a "presets" list'] }

  const warnings: string[] = []
  const source = typeof parsed.source === 'string' && parsed.source.trim() ? parsed.source.trim() : 'Imported file'
  let updated: string | undefined
  if (parsed.updated !== undefined) {
    if (isDateString(parsed.updated)) updated = parsed.updated
    else warnings.push('"updated" should be a date like 2026-10-25, the import date is used instead')
  }
  return { file: { source, updated, entries: parsed.presets }, warnings }
}

// Never throws: missing or unreadable storage loads as nothing imported
export function readPresetImport(game: GameId): StoredPresetImport | undefined {
  const raw = readStorage(presetStorageKey(game))
  if (!raw) return undefined
  try {
    const stored: unknown = JSON.parse(raw)
    if (isRecord(stored) && typeof stored.text === 'string' && isDateString(stored.importedAt)) {
      return { text: stored.text, importedAt: stored.importedAt }
    }
  } catch {
    // Fall through
  }
  return undefined
}

export function writePresetImport(game: GameId, stored: StoredPresetImport | undefined): boolean {
  return writeStorage(presetStorageKey(game), stored ? JSON.stringify(stored) : '')
}
