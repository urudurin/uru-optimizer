import {
  activeExtraBuffs,
  type ExtraBuffDef,
  type ExtraBuffs,
} from 'lib/games/shared/extraBuffs'
import type { EnemyDebuffs } from 'lib/games/zzz/damage/damage'
import type { StatEffect } from 'lib/games/zzz/data/dataTypes'
import {
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// ZZZ's Extra combat buffs (shared/extraBuffs.ts): stats become always-on stat effects next to the squad's, DEF
// reduction, RES shred and DMG taken join the enemy debuffs

const STAT_BUFFS: { stat: ZzzStatsValues, label: string }[] = [
  { stat: ZzzStats.ATK_P, label: 'ATK %' },
  { stat: ZzzStats.ATK, label: 'ATK' },
  { stat: ZzzStats.HP_P, label: 'HP %' },
  { stat: ZzzStats.HP, label: 'HP' },
  { stat: ZzzStats.DEF_P, label: 'DEF %' },
  { stat: ZzzStats.DEF, label: 'DEF' },
  { stat: ZzzStats.CRIT_RATE, label: 'CRIT Rate %' },
  { stat: ZzzStats.CRIT_DMG, label: 'CRIT DMG %' },
  { stat: ZzzStats.ELEMENT_DMG, label: 'DMG Bonus %' },
  { stat: ZzzStats.PEN_RATIO, label: 'PEN Ratio %' },
  { stat: ZzzStats.PEN, label: 'PEN' },
  { stat: ZzzStats.ANOMALY_PROFICIENCY, label: 'Anomaly Proficiency' },
]

const DEBUFF_KEYS = ['defShred', 'resShred', 'dmgTaken'] as const

export const ZZZ_EXTRA_BUFFS: ExtraBuffDef[] = [
  ...STAT_BUFFS.map(({ stat, label }) => ({ key: stat, label })),
  { key: 'defShred', label: 'DEF reduction %' },
  { key: 'resShred', label: 'RES shred %' },
  { key: 'dmgTaken', label: 'DMG taken %' },
]

export function zzzExtraEffects(buffs: ExtraBuffs | undefined): StatEffect[] {
  const stats = new Set<string>(STAT_BUFFS.map((b) => b.stat))
  return activeExtraBuffs(ZZZ_EXTRA_BUFFS, buffs)
    .filter(({ def }) => stats.has(def.key))
    .map(({ def, value }) => ({ stat: def.key as ZzzStatsValues, value, source: 'Extra combat buffs', confidence: 'unverified' }))
}

export function withZzzExtraDebuffs(debuffs: EnemyDebuffs, buffs: ExtraBuffs | undefined): EnemyDebuffs {
  const next = { ...debuffs }
  for (const key of DEBUFF_KEYS) next[key] += buffs?.[key] ?? 0
  return next
}
