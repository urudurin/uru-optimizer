import type {
  ElementDmgKey,
  StatKey,
} from 'lib/games/wuwa/types'

// Per-character facts the datamine copy doesn't have: element and minor forte bonuses. Entered by hand from the
// user's in-game screens, never copied from guide sites. See games/DATA-SOURCES.md.

export type CharacterInfo = {
  id: string,
  element: ElementDmgKey,
  // Bonuses from the minor forte nodes, counted when the character has them unlocked
  minorFortes: Partial<Record<StatKey, number>>,
  // Where each value came from, in plain words
  source: string,
  confidence: 'confirmed' | 'sourced' | 'unverified',
}

export const CHARACTER_INFO: Record<string, CharacterInfo> = {
  hsin: {
    id: 'hsin',
    element: 'electroDmg',
    // Crit Rate +8 is what the stat screen needs on top of weapon and echoes (88.1 shown). ATK% +12 is the usual
    // minor forte value and lands within 3 ATK of the screen, see the stat calculator test
    minorFortes: { critRate: 8, atkPct: 12 },
    source: 'User\'s stat screen screenshot (element shown, Crit Rate worked out from it), ATK% is the standard value',
    confidence: 'unverified',
  },
}
