import {
  IconArrowBigRightLines,
  IconAtom,
  IconBolt,
  IconDroplet,
  IconHammer,
  IconMeteor,
  IconSparkles,
  IconSwords,
  IconTargetArrow,
} from '@tabler/icons-react'
import { Stats } from 'lib/constants/constants'
import { Assets } from 'lib/rendering/assets'
import type { ReactNode } from 'react'

// One icon per kind of stat, shared by the character pages' stat lists (the icons on HSR's stat block)
export type StatIconKind =
  | 'hp'
  | 'atk'
  | 'def'
  | 'critRate'
  | 'critDmg'
  | 'energy'
  | 'mastery'
  | 'proficiency'
  | 'impact'
  | 'penRatio'
  | 'pen'
  | 'elementDmg'
  | 'dmgBonus'
  | 'heal'
  | 'sheer'

// HSR's in-game stat icons (rendering/assets.ts Assets.getStatIcon) for stats every game shares; tabler icons for the
// rest, which HSR has no icon for
const hsrIcon = (stat: string) => (size: number) => <img src={Assets.getStatIcon(stat)} alt='' width={size} height={size} draggable={false} />

const ICONS: Record<StatIconKind, (size: number) => ReactNode> = {
  hp: hsrIcon(Stats.HP),
  atk: hsrIcon(Stats.ATK),
  def: hsrIcon(Stats.DEF),
  critRate: hsrIcon(Stats.CR),
  critDmg: hsrIcon(Stats.CD),
  energy: hsrIcon(Stats.ERR),
  mastery: (size) => <IconSparkles size={size} />,
  proficiency: (size) => <IconAtom size={size} />,
  impact: (size) => <IconHammer size={size} />,
  penRatio: (size) => <IconTargetArrow size={size} />,
  pen: (size) => <IconArrowBigRightLines size={size} />,
  elementDmg: (size) => <IconDroplet size={size} />,
  dmgBonus: (size) => <IconMeteor size={size} />,
  heal: hsrIcon(Stats.OHB),
  sheer: (size) => <IconSwords size={size} />,
}

export function statIcon(kind: StatIconKind, size = 16): ReactNode {
  return ICONS[kind](size)
}

// Unused kinds fall back to a bolt, so a new stat never breaks a page
export function statIconOr(kind: StatIconKind | undefined, size = 16): ReactNode {
  return kind ? statIcon(kind, size) : <IconBolt size={size} />
}
