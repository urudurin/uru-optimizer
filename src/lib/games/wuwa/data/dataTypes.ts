import type {
  Cost,
  ElementDmgKey,
  StatKey,
} from 'lib/games/wuwa/types'

// Shapes of the WuWa game data in generated/datamine.json. Where each table came from is recorded in that file's
// "provenance" block and in data/README.md.

export type DataProvenance = {
  source: string,
  sourceUrl: string,
  branch: string,
  extractedBy: string,
  copiedIntoUru: string,
  included: string[],
  // How the characters table was made, it's read straight from the datamine rather than the old pipeline
  characters: string,
  weaponPassives: string,
  excluded: string,
  confidence: 'confirmed' | 'sourced' | 'unverified',
}

// HP, ATK and DEF by character level (1-90), before weapons, echoes and fortes
export type CharacterBase = {
  id: string,
  baseByLevel: Record<string, { hp: number, atk: number, def: number }>,
}

export type WeaponData = {
  id: string,
  name: string,
  // Datamine weapon type id
  weaponType: number,
  baseAtkByLevel: Record<string, number>,
  secondary: { stat: StatKey, byLevel: Record<string, number> },
  // Always-on passive bonuses by refinement (1-5), only for passives without a trigger
  passiveStats?: Record<string, Partial<Record<StatKey, number>>>,
}

// Only the bonuses that always apply, the ones the stat screen shows
export type SonataSet = {
  id: string,
  name: string,
  bonuses: { pieces: number, stats: Partial<Record<StatKey, number>> }[],
  // Pieces for the full set bonus, 5, or 3 for three-piece sets. bonuses can stop short of it
  fullPieces?: number,
}

export type EchoDefinition = {
  id: string,
  name: string,
  cost: Cost,
  // The sonata sets this echo can drop in
  setIds: string[],
}

// Element and minor forte stat nodes, from the role and skill tree tables
export type CharacterData = {
  id: string,
  name: string,
  element: ElementDmgKey | null,
  minorFortes: Partial<Record<StatKey, number>>,
}

export type DatamineFile = {
  provenance: DataProvenance,
  characters: Record<string, CharacterData>,
  bases: Record<string, CharacterBase>,
  weapons: Record<string, WeaponData>,
  echoes: Record<string, EchoDefinition>,
  sets: Record<string, SonataSet>,
}
