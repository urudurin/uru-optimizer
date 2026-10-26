import type {
  Element,
  GenshinStatKey,
} from 'lib/games/genshin/types'

// Genshin ids follow GOOD (Genshin Open Object Description), the community export format used by scanners and
// optimizers. Characters, sets and weapons are keyed by their English name in PascalCase ("Raiden Shogun" ->
// "RaidenShogun", "Gladiator's Finale" -> "GladiatorsFinale"), so data from Enka and from GOOD files lines up.

export function toGoodKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’"]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

// "CrimsonWitchOfFlames" -> "Crimson Witch Of Flames", for keys no store file names
export function nameFromGoodKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

// The Traveler has one GOOD key per element
export function travelerKey(element: Element | undefined): string {
  return `Traveler${element ?? ''}`
}

// GOOD stat keys
export const GOOD_STATS: Record<string, GenshinStatKey> = {
  hp: 'hp',
  hp_: 'hpPct',
  atk: 'atk',
  atk_: 'atkPct',
  def: 'def',
  def_: 'defPct',
  eleMas: 'elementalMastery',
  enerRech_: 'energyRecharge',
  heal_: 'healingBonus',
  critRate_: 'critRate',
  critDMG_: 'critDmg',
  physical_dmg_: 'physicalDmg',
  pyro_dmg_: 'pyroDmg',
  hydro_dmg_: 'hydroDmg',
  anemo_dmg_: 'anemoDmg',
  electro_dmg_: 'electroDmg',
  dendro_dmg_: 'dendroDmg',
  cryo_dmg_: 'cryoDmg',
  geo_dmg_: 'geoDmg',
}

// The game's numeric property ids, used by Enka's relic_levels.json main stat table
export const NUMERIC_STAT_IDS: Partial<Record<GenshinStatKey, number>> = {
  hp: 2,
  hpPct: 3,
  atk: 5,
  atkPct: 6,
  def: 8,
  defPct: 9,
  critRate: 20,
  critDmg: 22,
  energyRecharge: 23,
  healingBonus: 26,
  elementalMastery: 28,
  physicalDmg: 30,
  pyroDmg: 40,
  electroDmg: 41,
  hydroDmg: 42,
  dendroDmg: 43,
  anemoDmg: 44,
  geoDmg: 45,
  cryoDmg: 46,
}

// The highest single roll of each 5-star substat. Every roll is 70-100% of it
const MAX_5_STAR_ROLL: Partial<Record<GenshinStatKey, number>> = {
  hp: 298.75,
  atk: 19.45,
  def: 23.15,
  hpPct: 5.83,
  atkPct: 5.83,
  defPct: 7.29,
  elementalMastery: 23.31,
  energyRecharge: 6.48,
  critRate: 3.89,
  critDmg: 7.77,
}

// Every stat a 5-star substat can be
export const SUBSTAT_STATS = Object.keys(MAX_5_STAR_ROLL) as GenshinStatKey[]

// The highest single 5-star roll of a substat (0 for stats that can't be substats)
export function maxRoll(stat: GenshinStatKey): number {
  return MAX_5_STAR_ROLL[stat] ?? 0
}

// One average 5-star roll: rolls are 70, 80, 90 or 100% of the highest, equally likely
export function averageRoll(stat: GenshinStatKey): number {
  return (MAX_5_STAR_ROLL[stat] ?? 0) * 0.85
}

// How many times a substat rolled, from its total: the fewest rolls that can reach it. GOOD files only have totals
export function estimateRolls(stat: GenshinStatKey, value: number, rarity: number): number {
  const max = MAX_5_STAR_ROLL[stat]
  if (!max || rarity !== 5) return 1
  return Math.max(1, Math.ceil(value / max - 0.01))
}
