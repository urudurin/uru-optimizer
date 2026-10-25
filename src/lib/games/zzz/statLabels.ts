import { formatNumber } from 'lib/games/shared/format'
import type { Condition } from 'lib/games/zzz/data/dataTypes'
import { getSubstatValue } from 'lib/games/zzz/discStats'
import type { FinalStats } from 'lib/games/zzz/stats/computeStats'
import type {
  Disc,
  DiscSubstat,
} from 'lib/games/zzz/types'

// Labels shared by the stats panel and the disc optimizer

export const CONDITION_LABELS: Record<Condition, string> = {
  onField: 'Agent is on the field (combat)',
  inEtherVeil: 'Inside an Ether Veil',
  veilTriggered: 'Ether Veil just activated',
}

export const CORE_SKILL_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F'].map((label, i) => ({ value: String(i + 1), label: `Core Skill ${label}` }))

export type StatRow = { key: keyof FinalStats, label: string, suffix?: string, ruptureOnly?: boolean }

export const STAT_ROWS: StatRow[] = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
  { key: 'impact', label: 'Impact' },
  { key: 'critRate', label: 'CRIT Rate', suffix: '%' },
  { key: 'critDmg', label: 'CRIT DMG', suffix: '%' },
  { key: 'anomalyMastery', label: 'Anomaly Mastery' },
  { key: 'anomalyProficiency', label: 'Anomaly Proficiency' },
  { key: 'penRatio', label: 'PEN Ratio', suffix: '%' },
  { key: 'pen', label: 'PEN' },
  { key: 'energyRegen', label: 'Energy Regen' },
  { key: 'elementDmg', label: 'Element DMG bonus (stats and sets)', suffix: '%' },
  { key: 'sheerForce', label: 'Sheer Force', ruptureOnly: true },
]

export function formatStat(row: StatRow, value: number): string {
  return formatNumber(value, row.suffix)
}

export function formatSubstat(disc: Disc, substat: DiscSubstat): string {
  const value = getSubstatValue(disc.rarity, substat.stat, substat.rolls)
  return value === undefined ? `${substat.stat} x${substat.rolls}` : `${substat.stat} +${value}`
}
