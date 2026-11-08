import type { ImportMode } from 'lib/games/shared/storage'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'

// What an import brings in, after HSR's import step 2 (relics only / relics and characters / only characters you
// already have): every game's Import page has the choice, saved in <game>-import-choice, and each import from a file or
// Enka applies it (shared/gearStore.ts importParsed's choice). Backups and sample data always bring in everything.

export type ImportChoice = 'all' | 'gear' | 'existing'

export const IMPORT_CHOICES: ImportChoice[] = ['all', 'gear', 'existing']

const key = (game: string) => `${game}-import-choice`

export function readImportChoice(game: string): ImportChoice {
  const value = readStorage(key(game))
  return IMPORT_CHOICES.includes(value as ImportChoice) ? value as ImportChoice : 'all'
}

export function writeImportChoice(game: string, choice: ImportChoice) {
  writeStorage(key(game), choice)
}

// The imported characters to keep. Gear only: none (a replacing import keeps the saved ones as they are); only existing:
// the imported ones already saved (a replacing import also keeps the saved ones it doesn't have)
export function restrictOwners<Owner>(saved: Owner[], imported: Owner[], idOf: (owner: Owner) => string, choice: ImportChoice, mode: ImportMode): Owner[] {
  if (choice === 'all') return imported
  if (choice === 'gear') return mode === 'replace' ? saved : []
  const savedIds = new Set(saved.map(idOf))
  const kept = imported.filter((owner) => savedIds.has(idOf(owner)))
  if (mode !== 'replace') return kept
  const keptIds = new Set(kept.map(idOf))
  return [...kept, ...saved.filter((owner) => !keptIds.has(idOf(owner)))]
}
