// Stat keys match the WuwaEchoScorer project's save format (user-data.json version 1), so it imports without mapping

export type SubstatKey =
  | 'critRate'
  | 'critDmg'
  | 'atkPct'
  | 'hpPct'
  | 'defPct'
  | 'energyRegen'
  | 'basicDmg'
  | 'heavyDmg'
  | 'skillDmg'
  | 'libDmg'
  | 'atkFlat'
  | 'defFlat'
  | 'hpFlat'

export type ElementDmgKey =
  | 'glacioDmg'
  | 'fusionDmg'
  | 'electroDmg'
  | 'aeroDmg'
  | 'spectroDmg'
  | 'havocDmg'

export type StatKey = SubstatKey | ElementDmgKey | 'healingBonus'

export const ELEMENT_DMG_KEYS: readonly ElementDmgKey[] = ['glacioDmg', 'fusionDmg', 'electroDmg', 'aeroDmg', 'spectroDmg', 'havocDmg']

export const STAT_LABELS: Record<StatKey, string> = {
  critRate: 'Crit Rate',
  critDmg: 'Crit DMG',
  atkPct: 'ATK%',
  hpPct: 'HP%',
  defPct: 'DEF%',
  energyRegen: 'Energy Regen',
  basicDmg: 'Basic DMG%',
  heavyDmg: 'Heavy DMG%',
  skillDmg: 'Skill DMG%',
  libDmg: 'Liberation DMG%',
  atkFlat: 'ATK',
  defFlat: 'DEF',
  hpFlat: 'HP',
  healingBonus: 'Healing Bonus',
  glacioDmg: 'Glacio DMG',
  fusionDmg: 'Fusion DMG',
  electroDmg: 'Electro DMG',
  aeroDmg: 'Aero DMG',
  spectroDmg: 'Spectro DMG',
  havocDmg: 'Havoc DMG',
}

// Display name for a stat key, falling back to the raw key for unknown (e.g. imported) values
export function statLabel(stat: string): string {
  return STAT_LABELS[stat as StatKey] ?? stat
}

export type Cost = 1 | 3 | 4

export const MAX_ECHO_LEVEL = 25
export const MAX_LOADOUT_COST = 12
export const MAX_LOADOUT_ECHOES = 5

export type Substat = {
  stat: SubstatKey,
  // The rolled value as shown in game, one of the tiers in echoStats.ts
  value: number,
}

// A character the user owns and how they're built, same shape as the WuwaEchoScorer save
export type CharacterState = {
  charId: string,
  level: number,
  // Resonance chain, 0-6
  sequence: number,
  weaponId?: string,
  weaponLevel: number,
  refinement: number,
  // Whether the minor forte nodes are unlocked
  minorFortes: boolean,
  // 5 slots, slot 0 is the main echo. null is an empty slot
  echoIds: (string | null)[],
}

export type SavedTeam = {
  id: string,
  name: string,
  members: [string, string, string],
}

export type Echo = {
  id: string,
  // Which echo (monster) it is, decides the cost and which sonata sets it can drop in
  defId: string,
  cost: Cost,
  setId: string,
  mainStat: StatKey,
  level: number,
  substats: Substat[],
}
