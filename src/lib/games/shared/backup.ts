import { forgetPriority } from 'lib/games/shared/characterPriority'
import { forgetGameSettings } from 'lib/games/shared/gameSettings'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'

// Backup files of a game's own browser save, shared by the non-HSR games. A backup is the game's save object plus a
// "kind" marker and the date it was saved, so the Import box can recognize it and restore it directly.

// Reminders: each game remembers when its last backup was saved (<game>-last-backup) and until when the reminder was
// put off (<game>-backup-snooze), both as YYYY-MM-DD dates
export const BACKUP_REMIND_DAYS = 14
export const BACKUP_SNOOZE_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

function readDate(key: string): number | undefined {
  const text = readStorage(key)
  const time = text ? Date.parse(text) : NaN
  return Number.isNaN(time) ? undefined : time
}

export function recordBackup(game: string, savedAt: string) {
  writeStorage(`${game}-last-backup`, savedAt)
}

export function snoozeBackupReminder(game: string, now: Date) {
  writeStorage(`${game}-backup-snooze`, new Date(now.getTime() + BACKUP_SNOOZE_DAYS * DAY_MS).toISOString().slice(0, 10))
}

// Whether to remind about a backup: there is data, no backup in the last two weeks, and the reminder isn't put off.
// daysSince is undefined when there was never a backup
export function backupReminder(game: string, hasData: boolean, now: Date): { due: boolean, daysSince?: number } {
  const last = readDate(`${game}-last-backup`)
  const daysSince = last === undefined ? undefined : Math.floor((now.getTime() - last) / DAY_MS)
  const snoozedUntil = readDate(`${game}-backup-snooze`)
  const snoozed = snoozedUntil !== undefined && now.getTime() < snoozedUntil
  const due = hasData && !snoozed && (daysSince === undefined || daysSince >= BACKUP_REMIND_DAYS)
  return { due, daysSince }
}

export type BackupKind = 'uru-zzz-backup' | 'uru-wuwa-backup' | 'uru-genshin-backup'

// Adds the marker and date to a serialized save, and the game's browser settings (backupSettings) when given.
// Pretty-printed so the file is readable if opened
export function wrapBackup(kind: BackupKind, savedAt: string, saveText: string, settings?: BackupSettings): string {
  return `${JSON.stringify({ kind, savedAt, ...JSON.parse(saveText) as object, ...(settings ? { settings } : {}) }, null, 2)}\n`
}

// The browser settings a backup carries next to the save, by storage key, like HSR's save file keeps each character's
// optimizer form: per-character optimizer settings (teams, rotations, filters), saved rotations and saved builds. Imported presets
// stay out (third-party guide data, see CLAUDE.md)
export type BackupSettings = Record<string, unknown>

const settingsKeys = (
  game: string,
) => [`${game}-optimizer-settings`, `${game}-saved-rotations`, `${game}-saved-builds`, `${game}-settings`, `${game}-score-weights`, `${game}-priority`]

export function backupSettings(game: string): BackupSettings {
  const settings: BackupSettings = {}
  for (const key of settingsKeys(game)) {
    const text = readStorage(key)
    if (!text) continue
    try {
      settings[key] = JSON.parse(text)
    } catch {
      // A corrupted setting stays out of the backup
    }
  }
  return settings
}

// Puts a backup's settings back in the browser; returns how many were restored. Only this game's keys, never throws
export function restoreBackupSettings(game: string, text: string): number {
  let settings: unknown
  try {
    settings = (JSON.parse(text) as { settings?: unknown }).settings
  } catch {
    return 0
  }
  if (typeof settings !== 'object' || settings === null) return 0
  let restored = 0
  for (const key of settingsKeys(game)) {
    const value = (settings as Record<string, unknown>)[key]
    if (value !== undefined && writeStorage(key, JSON.stringify(value))) restored++
  }
  // The game settings and priority order are cached once read
  forgetGameSettings()
  forgetPriority()
  return restored
}

// The kind of a backup file, or undefined for anything else. Never throws
export function backupKindOf(text: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
    const kind = (parsed as { kind?: unknown }).kind
    return typeof kind === 'string' ? kind : undefined
  } catch {
    return undefined
  }
}

export function backupFileName(game: string, savedAt: string): string {
  return `${game}-backup-${savedAt}.json`
}

// Hands the user a file to save, browser only
export function downloadTextFile(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Give the browser a moment to start the download before the URL goes away
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
