import stats from 'lib/games/genshin/data/generated/stats.json'
import {
  CHARACTER_SCREEN_PASSIVES,
  type ScreenStats,
  WEAPON_SCREEN_PASSIVES,
} from 'lib/games/genshin/data/screenPassives'
import { SET_2PC_BONUSES } from 'lib/games/genshin/data/setBonuses'
import type {
  Artifact,
  GenshinCharacter,
  GenshinStatKey,
  GenshinWeapon,
} from 'lib/games/genshin/types'

// The Genshin character screen, worked out from base stats, weapon and artifacts:
//   HP/ATK/DEF = base x (1 + percent bonuses) + flat bonuses, where base ATK includes the weapon's base ATK
//   everything else adds up, on top of 5% CRIT Rate, 50% CRIT DMG and 100% Energy Recharge.
// Bonuses that show on the screen: character ascension stat, weapon second stat, always-on weapon refinement bonuses,
// artifact main stats and substats, set 2-piece bonuses, then the always-on passives in data/screenPassives.ts.
// Conditional effects (4-pieces, most weapon passives) don't show.
// Base stats and curves come from genshin-optimizer (data/generated/stats.json, see its provenance block).

type CurveStat = { base: number, curve: string }
type CharacterStats = {
  rarity: number,
  hp: CurveStat,
  atk: CurveStat,
  def: CurveStat,
  ascension: Partial<Record<GenshinStatKey, number[]>>,
  base: Partial<Record<GenshinStatKey, number>>,
}
type WeaponStats = {
  rarity: number,
  atk: CurveStat,
  sub?: CurveStat & { stat: GenshinStatKey },
  ascensionAtk: number[],
  refinement: Partial<Record<GenshinStatKey, number[]>>,
}
type StatsFile = { curves: Record<string, number[]>, characters: Record<string, CharacterStats>, weapons: Record<string, WeaponStats> }

const DATA = stats as unknown as StatsFile

export type ComputedStats = {
  stats: Partial<Record<GenshinStatKey, number>>,
  // What couldn't be counted, e.g. a character or weapon missing from the data
  missing: string[],
}

// The ascension a character or weapon at this level most likely has, when the source doesn't say: the lowest one that
// allows the level (a level-80 character counts as not yet ascended to 6)
const ASCENSION_CAPS = [20, 40, 50, 60, 70, 80, 90]
export function inferAscension(level: number): number {
  const index = ASCENSION_CAPS.findIndex((cap) => level <= cap)
  return index === -1 ? 6 : index
}

function atLevel(stat: CurveStat, level: number): number {
  const curve = DATA.curves[stat.curve]
  return stat.base * (curve?.[level] ?? 1)
}

// genshin-optimizer keys the Traveler once for all elements
function characterData(id: string): CharacterStats | undefined {
  return DATA.characters[id.startsWith('Traveler') ? 'Traveler' : id]
}

export function hasStatData(character: GenshinCharacter): boolean {
  return characterData(character.id) !== undefined
}

function addTo(bonus: Partial<Record<GenshinStatKey, number>>, stat: GenshinStatKey, value: number) {
  bonus[stat] = (bonus[stat] ?? 0) + value
}

function weaponBase(weapon: GenshinWeapon, bonus: Partial<Record<GenshinStatKey, number>>, missing: string[]): number {
  const data = DATA.weapons[weapon.id]
  if (!data) {
    missing.push(`${weapon.name} (weapon) isn't in the stat data`)
    return 0
  }
  const ascension = weapon.ascension ?? inferAscension(weapon.level)
  if (data.sub) addTo(bonus, data.sub.stat, atLevel(data.sub, weapon.level))
  for (const [stat, values] of Object.entries(data.refinement) as [GenshinStatKey, number[]][]) {
    addTo(bonus, stat, values[weapon.refinement] ?? 0)
  }
  return atLevel(data.atk, weapon.level) + (data.ascensionAtk[ascension] ?? 0)
}

// Everything that doesn't depend on artifacts, worked out once per character
export type PreparedCharacter = {
  character: GenshinCharacter,
  baseHp: number,
  baseAtk: number,
  baseDef: number,
  // Character and weapon bonuses, including the 5% CRIT Rate, 50% CRIT DMG and 100% Energy Recharge everyone has
  bonus: Partial<Record<GenshinStatKey, number>>,
  missing: string[],
}

export function prepareCharacter(character: GenshinCharacter): PreparedCharacter | undefined {
  const missing: string[] = []
  const data = characterData(character.id)
  if (!data) return undefined

  const ascension = character.ascension ?? inferAscension(character.level)
  const bonus: Partial<Record<GenshinStatKey, number>> = { critRate: 5, critDmg: 50, energyRecharge: 100 }
  for (const [stat, value] of Object.entries(data.base) as [GenshinStatKey, number][]) addTo(bonus, stat, value)
  for (const [stat, values] of Object.entries(data.ascension) as [GenshinStatKey, number[]][]) {
    if (stat === 'hp' || stat === 'atk' || stat === 'def') continue
    addTo(bonus, stat, values[ascension] ?? 0)
  }

  const ascended = (stat: 'hp' | 'atk' | 'def') => data.ascension[stat]?.[ascension] ?? 0
  const baseHp = atLevel(data.hp, character.level) + ascended('hp')
  const baseDef = atLevel(data.def, character.level) + ascended('def')
  let baseAtk = atLevel(data.atk, character.level) + ascended('atk')
  if (character.weapon) baseAtk += weaponBase(character.weapon, bonus, missing)
  return { character, baseHp, baseAtk, baseDef, bonus, missing }
}

// The character screen from the prepared character plus artifact and set bonuses (added into bonus by the caller)
export function finalizeStats(prepared: PreparedCharacter, bonus: Partial<Record<GenshinStatKey, number>>): Partial<Record<GenshinStatKey, number>> {
  const { character, baseHp, baseAtk, baseDef } = prepared
  const { hp = 0, hpPct = 0, atk = 0, atkPct = 0, def = 0, defPct = 0, ...rest } = bonus
  const screen: ScreenStats = {
    ...rest,
    baseAtk,
    hp: baseHp * (1 + hpPct / 100) + hp,
    atk: baseAtk * (1 + atkPct / 100) + atk,
    def: baseDef * (1 + defPct / 100) + def,
  }
  // Passives that read the stats so far (Energy Recharge, Max HP) see them before any passive adds to them
  const passives = [
    CHARACTER_SCREEN_PASSIVES[character.id]?.apply(screen, 1),
    character.weapon && WEAPON_SCREEN_PASSIVES[character.weapon.id]?.apply(screen, character.weapon.refinement),
  ]
  const { baseAtk: _, ...result } = screen
  for (const passive of passives) {
    for (const [stat, value] of Object.entries(passive || {}) as [GenshinStatKey, number][]) addTo(result, stat, value)
  }
  return result
}

// Bonuses from the artifacts' stats and 2-piece sets
export function artifactBonus(artifacts: Artifact[]): Partial<Record<GenshinStatKey, number>> {
  const bonus: Partial<Record<GenshinStatKey, number>> = {}
  const setCounts = new Map<string, number>()
  for (const artifact of artifacts) {
    addTo(bonus, artifact.main.stat, artifact.main.value)
    for (const sub of artifact.substats) addTo(bonus, sub.stat, sub.value)
    setCounts.set(artifact.setId, (setCounts.get(artifact.setId) ?? 0) + 1)
  }
  for (const [setId, count] of setCounts) {
    if (count < 2) continue
    for (const [stat, value] of Object.entries(SET_2PC_BONUSES[setId] ?? {}) as [GenshinStatKey, number][]) addTo(bonus, stat, value)
  }
  return bonus
}

// extra: stat points to add on top, e.g. one more substat roll for the build analysis
export function computeGenshinStats(character: GenshinCharacter, artifacts: Artifact[], extra: Partial<Record<GenshinStatKey, number>> = {}): ComputedStats {
  const prepared = prepareCharacter(character)
  if (!prepared) return { stats: {}, missing: [`${character.name} isn't in the stat data yet`] }
  const bonus = { ...prepared.bonus }
  for (const [stat, value] of Object.entries(artifactBonus(artifacts)) as [GenshinStatKey, number][]) addTo(bonus, stat, value)
  for (const [stat, value] of Object.entries(extra) as [GenshinStatKey, number][]) addTo(bonus, stat, value)
  return { stats: finalizeStats(prepared, bonus), missing: prepared.missing }
}
