import type {
  Cost,
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

export type DatamineFile = {
  provenance: DataProvenance,
  bases: Record<string, CharacterBase>,
  weapons: Record<string, WeaponData>,
  echoes: Record<string, EchoDefinition>,
  sets: Record<string, SonataSet>,
}
