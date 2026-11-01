import type { EnemyDebuffs } from 'lib/games/genshin/damage/damage'
import type { TeamBuffTotals } from 'lib/games/genshin/stats/computeStats'
import type { GenshinStatKey } from 'lib/games/genshin/types'
import {
  addExtraStats,
  type ExtraBuffDef,
  type ExtraBuffs,
} from 'lib/games/shared/extraBuffs'

// Genshin's Extra combat buffs (shared/extraBuffs.ts): stats join the team's premod buffs (with the other bonuses),
// DEF reduction and RES shred join the enemy debuffs

const STAT_KEYS = [
  'atkPct',
  'atk',
  'hpPct',
  'hp',
  'defPct',
  'def',
  'elementalMastery',
  'energyRecharge',
  'critRate',
  'critDmg',
  'allDmg',
] as const satisfies readonly GenshinStatKey[]

export const GENSHIN_EXTRA_BUFFS: ExtraBuffDef[] = [
  { key: 'atkPct', label: 'ATK %' },
  { key: 'atk', label: 'ATK' },
  { key: 'hpPct', label: 'HP %' },
  { key: 'hp', label: 'HP' },
  { key: 'defPct', label: 'DEF %' },
  { key: 'def', label: 'DEF' },
  { key: 'elementalMastery', label: 'Elemental Mastery' },
  { key: 'energyRecharge', label: 'Energy Recharge %' },
  { key: 'critRate', label: 'CRIT Rate %' },
  { key: 'critDmg', label: 'CRIT DMG %' },
  { key: 'allDmg', label: 'DMG Bonus %' },
  { key: 'defShred', label: 'DEF reduction %' },
  { key: 'resShred', label: 'RES shred %' },
]

export function withGenshinExtraBuffs(team: TeamBuffTotals, buffs: ExtraBuffs | undefined): TeamBuffTotals {
  return { premod: addExtraStats(team.premod, buffs, STAT_KEYS), total: team.total }
}

export function withGenshinExtraDebuffs(debuffs: EnemyDebuffs, buffs: ExtraBuffs | undefined): EnemyDebuffs {
  const defShred = buffs?.defShred ?? 0
  const resShred = buffs?.resShred ?? 0
  return {
    defShred: debuffs.defShred + defShred,
    resShred: resShred ? { ...debuffs.resShred, all: (debuffs.resShred.all ?? 0) + resShred } : debuffs.resShred,
  }
}
