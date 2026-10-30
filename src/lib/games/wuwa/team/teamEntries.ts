import {
  type TeamEntry,
  teamSummary,
} from 'lib/games/shared/ui/optimizer/TeamCards'
import type { WuwaAppliedBuff } from 'lib/games/wuwa/team/teamBuffs'
import { statLabel } from 'lib/games/wuwa/types'

// WuWa team buffs as the shared Team row's entries (shared/ui/optimizer/TeamCards.tsx)

const AMPLIFY_LABELS: Record<string, string> = {
  all: 'DMG Amplified',
  basic: 'Basic Attack DMG Amplified',
  heavy: 'Heavy Attack DMG Amplified',
  skill: 'Resonance Skill DMG Amplified',
  liberation: 'Resonance Liberation DMG Amplified',
  intro: 'Intro Skill DMG Amplified',
  outro: 'Outro Skill DMG Amplified',
  echo: 'Echo Skill DMG Amplified',
}

function buffStatLabel(stat: string): string {
  if (stat.startsWith('amplify:')) return AMPLIFY_LABELS[stat.slice(8)] ?? stat
  if (stat === 'defIgnore') return 'enemy DEF ignored'
  if (stat === 'resShred') return 'enemy RES shred'
  return statLabel(stat)
}

export function wuwaTeamEntries(applied: WuwaAppliedBuff[]): TeamEntry[] {
  return applied.map((entry) => ({
    key: entry.key,
    source: entry.sourceName,
    label: entry.buff.label,
    counted: entry.counted,
    detail: entry.counted ? `+${Math.round(entry.value * 10) / 10}% ${buffStatLabel(entry.buff.stat)}` : entry.reason ?? '',
    toggle: entry.buff.toggle,
    setting: entry.setting,
  }))
}

export const wuwaTeamSummary = (names: string[], applied: WuwaAppliedBuff[]) => teamSummary(names, wuwaTeamEntries(applied))
