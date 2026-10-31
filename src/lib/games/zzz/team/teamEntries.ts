import {
  type TeamEntry,
  teamSummary,
} from 'lib/games/shared/ui/optimizer/TeamCards'
import {
  DEBUFF_LABELS,
  HIT_BONUS_LABELS,
  type HitBonusKey,
} from 'lib/games/zzz/team/buffs'
import {
  isDebuff,
  type ZzzAppliedBuff,
} from 'lib/games/zzz/team/teamBuffs'
import { ZzzStats } from 'lib/games/zzz/types'

// ZZZ team buffs as the shared Team row's entries (shared/ui/optimizer/TeamCards.tsx)

const FLAT = new Set<string>([ZzzStats.ATK, ZzzStats.HP, ZzzStats.DEF, ZzzStats.ANOMALY_PROFICIENCY, ZzzStats.PEN])

function describeValue(entry: ZzzAppliedBuff): string {
  if (isDebuff(entry.buff.stat)) return `+${Math.round(entry.value * 10) / 10}% ${DEBUFF_LABELS[entry.buff.stat]}`
  const stat = entry.buff.stat === ZzzStats.ELEMENT_DMG
    ? (entry.buff.element ? `${entry.buff.element} DMG` : 'DMG Bonus')
    : HIT_BONUS_LABELS[entry.buff.stat as HitBonusKey] ?? entry.buff.stat
  return `+${FLAT.has(entry.buff.stat) ? Math.round(entry.value) : `${Math.round(entry.value * 10) / 10}%`} ${stat}`
}

export function zzzTeamEntries(applied: ZzzAppliedBuff[]): TeamEntry[] {
  return applied.map((entry) => {
    const toggle = entry.buff.toggle
    return {
      key: entry.key,
      source: entry.sourceName,
      label: entry.buff.label,
      counted: entry.counted,
      detail: entry.counted ? describeValue(entry) : entry.reason ?? '',
      toggle: toggle?.kind === 'stacks' ? { kind: 'stacks', label: toggle.label, max: toggle.max(entry.giver) } : toggle,
      setting: entry.setting,
    }
  })
}

export const zzzTeamSummary = (names: string[], applied: ZzzAppliedBuff[]) => teamSummary(names, zzzTeamEntries(applied))
