import type { StatListRow } from 'lib/games/shared/ui/Showcase'
import {
  statIcon,
  type StatIconKind,
} from 'lib/games/shared/ui/statIcons'
import {
  formatStat,
  STAT_ROWS,
} from 'lib/games/zzz/statLabels'
import type { FinalStats } from 'lib/games/zzz/stats/computeStats'

// An agent's stat screen as a showcase stat list (shared/ui/Showcase.tsx), for the Agents page and the optimizer's
// build preview

const HIGHLIGHTED = new Set<keyof FinalStats>(['atk', 'critRate', 'critDmg', 'sheerForce'])

const STAT_ICON_KINDS: Record<keyof FinalStats, StatIconKind> = {
  hp: 'hp',
  atk: 'atk',
  def: 'def',
  impact: 'impact',
  anomalyMastery: 'mastery',
  anomalyProficiency: 'proficiency',
  critRate: 'critRate',
  critDmg: 'critDmg',
  penRatio: 'penRatio',
  pen: 'pen',
  energyRegen: 'energy',
  elementDmg: 'elementDmg',
  sheerForce: 'sheer',
}

// display: the stats as the screen shows them (computeStats toDisplayStats)
export function zzzStatRows(display: FinalStats, specialty: string): StatListRow[] {
  return STAT_ROWS
    .filter((row) => !row.ruptureOnly || specialty === 'Rupture')
    .map((row) => ({
      key: row.key,
      icon: statIcon(STAT_ICON_KINDS[row.key]),
      label: row.label,
      value: formatStat(row, display[row.key]),
      highlight: HIGHLIGHTED.has(row.key),
    }))
}
