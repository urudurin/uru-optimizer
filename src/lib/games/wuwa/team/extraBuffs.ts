import {
  addExtraStats,
  type ExtraBuffDef,
  type ExtraBuffs,
} from 'lib/games/shared/extraBuffs'
import type { Bonus } from 'lib/games/wuwa/stats/computeStats'
import type {
  ElementDmgKey,
  SubstatKey,
} from 'lib/games/wuwa/types'

// WuWa's Extra combat buffs (shared/extraBuffs.ts): stats join the team's bonus (DMG Bonus goes to the Resonator's
// element), DMG Amplified, DEF ignore and RES shred join the damage setup and enemy

const STAT_KEYS = [
  'atkPct',
  'atkFlat',
  'hpPct',
  'hpFlat',
  'defPct',
  'defFlat',
  'critRate',
  'critDmg',
  'energyRegen',
  'basicDmg',
  'heavyDmg',
  'skillDmg',
  'libDmg',
] as const satisfies readonly SubstatKey[]

export const WUWA_EXTRA_BUFFS: ExtraBuffDef[] = [
  { key: 'atkPct', label: 'ATK %' },
  { key: 'atkFlat', label: 'ATK' },
  { key: 'hpPct', label: 'HP %' },
  { key: 'hpFlat', label: 'HP' },
  { key: 'defPct', label: 'DEF %' },
  { key: 'defFlat', label: 'DEF' },
  { key: 'critRate', label: 'CRIT Rate %' },
  { key: 'critDmg', label: 'CRIT DMG %' },
  { key: 'energyRegen', label: 'Energy Regen %' },
  { key: 'elementDmg', label: 'Element DMG Bonus %' },
  { key: 'basicDmg', label: 'Basic Attack DMG %' },
  { key: 'heavyDmg', label: 'Heavy Attack DMG %' },
  { key: 'skillDmg', label: 'Resonance Skill DMG %' },
  { key: 'libDmg', label: 'Liberation DMG %' },
  { key: 'amplify', label: 'DMG Amplified %' },
  { key: 'defIgnore', label: 'DEF ignore %' },
  { key: 'resShred', label: 'RES shred %' },
]

export function withWuwaExtraBuffs(bonus: Bonus, buffs: ExtraBuffs | undefined, element: ElementDmgKey | undefined): Bonus {
  const total: Bonus = addExtraStats(bonus, buffs, STAT_KEYS)
  const elementDmg = buffs?.elementDmg ?? 0
  if (element && elementDmg) total[element] = (total[element] ?? 0) + elementDmg
  return total
}

export function wuwaExtraEnemy(buffs: ExtraBuffs | undefined): { amplify: number, defIgnore: number, resShred: number } {
  return { amplify: buffs?.amplify ?? 0, defIgnore: buffs?.defIgnore ?? 0, resShred: buffs?.resShred ?? 0 }
}
