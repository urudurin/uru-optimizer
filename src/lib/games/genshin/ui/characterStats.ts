import {
  type Element,
  ELEMENT_DMG_STAT,
  formatStatValue,
  type GenshinCharacter,
  type GenshinStatKey,
  statLabel,
} from 'lib/games/genshin/types'
import type { StatListRow } from 'lib/games/shared/ui/Showcase'
import {
  statIcon,
  type StatIconKind,
} from 'lib/games/shared/ui/statIcons'

// A character's stat screen as a showcase stat list (shared/ui/Showcase.tsx), for the Characters page and the
// optimizer's build preview

const MAIN_STATS: GenshinStatKey[] = ['hp', 'atk', 'def', 'elementalMastery', 'critRate', 'critDmg', 'energyRecharge']
const HIGHLIGHTED = new Set<GenshinStatKey>(['atk', 'critRate', 'critDmg'])

const STAT_ICON_KINDS: Partial<Record<GenshinStatKey, StatIconKind>> = {
  hp: 'hp',
  atk: 'atk',
  def: 'def',
  elementalMastery: 'mastery',
  critRate: 'critRate',
  critDmg: 'critDmg',
  energyRecharge: 'energy',
  healingBonus: 'heal',
  physicalDmg: 'dmgBonus',
  allDmg: 'dmgBonus',
}

// Element accents for the showcase card, CSS colors
export const ELEMENT_ACCENTS: Record<Element, string> = {
  Pyro: '#e2604a',
  Hydro: '#3e8fe0',
  Anemo: '#4ec2a4',
  Electro: '#a46be0',
  Dendro: '#7cbf3a',
  Cryo: '#7fd0e6',
  Geo: '#d9a93a',
}

// The character screen's main stats, then the DMG bonuses the character actually has
export function genshinStatRows(character: GenshinCharacter, stats: GenshinCharacter['stats']): StatListRow[] {
  if (Object.keys(stats).length === 0) return []
  const elementStat = character.element ? ELEMENT_DMG_STAT[character.element] : undefined
  const bonuses = (Object.keys(stats) as GenshinStatKey[])
    .filter((stat) => !MAIN_STATS.includes(stat) && (stat === elementStat || (stats[stat] ?? 0) > 0))
  return [...MAIN_STATS, ...bonuses].map((stat) => ({
    key: stat,
    icon: statIcon(STAT_ICON_KINDS[stat] ?? 'elementDmg'),
    label: statLabel(stat),
    value: formatStatValue(stat, stats[stat] ?? 0),
    highlight: HIGHLIGHTED.has(stat) || stat === elementStat,
  }))
}
