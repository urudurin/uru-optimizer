// Backup files of a game's own browser save, shared by the non-HSR games. A backup is the game's save object plus a
// "kind" marker and the date it was saved, so the Import box can recognize it and restore it directly.

export type BackupKind = 'uru-zzz-backup' | 'uru-wuwa-backup' | 'uru-genshin-backup'

// Adds the marker and date to a serialized save. Pretty-printed so the file is readable if opened
export function wrapBackup(kind: BackupKind, savedAt: string, saveText: string): string {
  return `${JSON.stringify({ kind, savedAt, ...JSON.parse(saveText) as object }, null, 2)}\n`
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
