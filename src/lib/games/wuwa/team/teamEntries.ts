import {
  type TeamEntry,
  teamSummary,
} from 'lib/games/shared/ui/optimizer/TeamCards'
import type { WuwaAppliedBuff } from 'lib/games/wuwa/team/teamBuffs'
import { statLabel } from 'lib/games/wuwa/types'

// WuWa team buffs as the shared Team row's entries (shared/ui/optimizer/TeamCards.tsx)

export function wuwaTeamEntries(applied: WuwaAppliedBuff[]): TeamEntry[] {
  return applied.map((entry) => ({
    key: entry.key,
    source: entry.sourceName,
    label: entry.buff.label,
    counted: entry.counted,
    detail: entry.counted ? `+${Math.round(entry.value * 10) / 10}% ${statLabel(entry.buff.stat)}` : entry.reason ?? '',
    toggle: entry.buff.toggle,
    setting: entry.setting,
  }))
}

export const wuwaTeamSummary = (names: string[], applied: WuwaAppliedBuff[]) => teamSummary(names, wuwaTeamEntries(applied))
