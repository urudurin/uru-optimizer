import type { MainStatSlot } from 'lib/games/genshin/optimizer/artifactOptimizer'
import type { GenshinStatKey } from 'lib/games/genshin/types'

// The main stats each artifact slot can roll (flower and plume are fixed)
export const MAIN_STAT_OPTIONS: Record<MainStatSlot, GenshinStatKey[]> = {
  sands: ['atkPct', 'hpPct', 'defPct', 'elementalMastery', 'energyRecharge'],
  goblet: ['atkPct', 'hpPct', 'defPct', 'elementalMastery', 'pyroDmg', 'hydroDmg', 'anemoDmg', 'electroDmg', 'dendroDmg', 'cryoDmg', 'geoDmg', 'physicalDmg'],
  circlet: ['critRate', 'critDmg', 'atkPct', 'hpPct', 'defPct', 'elementalMastery', 'healingBonus'],
}

export const MAIN_STAT_SLOTS = Object.keys(MAIN_STAT_OPTIONS) as MainStatSlot[]

// A 5-star artifact's main stat at +20 (the game's fixed values), for the DPS score's benchmark main stats
export const MAX_MAIN_VALUE: Partial<Record<GenshinStatKey, number>> = {
  hp: 4780,
  atk: 311,
  atkPct: 46.6,
  hpPct: 46.6,
  defPct: 58.3,
  elementalMastery: 186.5,
  energyRecharge: 51.8,
  pyroDmg: 46.6,
  hydroDmg: 46.6,
  anemoDmg: 46.6,
  electroDmg: 46.6,
  dendroDmg: 46.6,
  cryoDmg: 46.6,
  geoDmg: 46.6,
  physicalDmg: 58.3,
  critRate: 31.1,
  critDmg: 62.2,
  healingBonus: 35.9,
}
