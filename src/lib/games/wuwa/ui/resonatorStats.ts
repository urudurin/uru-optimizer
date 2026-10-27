import { formatNumber } from 'lib/games/shared/format'
import type { StatListRow } from 'lib/games/shared/ui/Showcase'
import { statIcon } from 'lib/games/shared/ui/statIcons'
import type { toDisplayStats } from 'lib/games/wuwa/stats/computeStats'
import {
  type ElementDmgKey,
  statLabel,
} from 'lib/games/wuwa/types'

// A Resonator's overview screen as a showcase stat list (shared/ui/Showcase.tsx), for the Resonators page and the
// optimizer's build preview. shown: the stats as the screen rounds them (computeStats toDisplayStats)
export function wuwaStatRows(shown: ReturnType<typeof toDisplayStats>, element: ElementDmgKey | undefined): StatListRow[] {
  return [
    { key: 'hp', icon: statIcon('hp'), label: 'HP', value: formatNumber(shown.hp) },
    { key: 'atk', icon: statIcon('atk'), label: 'ATK', value: formatNumber(shown.atk), highlight: true },
    { key: 'def', icon: statIcon('def'), label: 'DEF', value: formatNumber(shown.def) },
    { key: 'er', icon: statIcon('energy'), label: 'Energy Regen', value: `${shown.energyRegen}%` },
    { key: 'cr', icon: statIcon('critRate'), label: 'Crit Rate', value: `${shown.critRate}%`, highlight: true },
    { key: 'cd', icon: statIcon('critDmg'), label: 'Crit DMG', value: `${shown.critDmg}%`, highlight: true },
    ...(element ? [{ key: 'element', icon: statIcon('elementDmg'), label: statLabel(element), value: `${shown.elementDmg}%`, highlight: true }] : []),
    { key: 'skill', icon: statIcon('dmgBonus'), label: 'Resonance Skill DMG', value: `${shown.skillDmg}%` },
    { key: 'lib', icon: statIcon('dmgBonus'), label: 'Liberation DMG', value: `${shown.libDmg}%` },
    { key: 'basic', icon: statIcon('dmgBonus'), label: 'Basic Attack DMG', value: `${shown.basicDmg}%` },
    ...(shown.healingBonus > 0 ? [{ key: 'heal', icon: statIcon('heal'), label: 'Healing Bonus', value: `${shown.healingBonus}%` }] : []),
  ]
}
