import { CHARACTERS } from 'lib/games/wuwa/data/gameData'
import type {
  ElementDmgKey,
  StatKey,
} from 'lib/games/wuwa/types'

// Per-character element and minor forte bonuses, from the datamine's role and skill tree tables
// (generated/datamine.json "characters", written by src/scripts/wuwa/extractCharacters.mjs).
// Hsin's values also match her in-game stat screen.

export type CharacterInfo = {
  id: string,
  element: ElementDmgKey,
  // Bonuses from the minor forte nodes, counted when the character has them unlocked
  minorFortes: Partial<Record<StatKey, number>>,
}

export const CHARACTER_INFO: Record<string, CharacterInfo> = Object.fromEntries(
  Object.values(CHARACTERS).flatMap((character) =>
    character.element ? [[character.id, { id: character.id, element: character.element, minorFortes: character.minorFortes }]] : []
  ),
)
