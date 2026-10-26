import {
  IconArrowBigRightLines,
  IconAtom,
  IconBattery3,
  IconBolt,
  IconDroplet,
  IconFirstAidKit,
  IconFlame,
  IconHammer,
  IconHeart,
  IconMeteor,
  IconShield,
  IconSparkles,
  IconSword,
  IconSwords,
  IconTarget,
  IconTargetArrow,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'

// One icon per kind of stat, shared by the character pages' stat lists (like the icons on HSR's stat block)
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

const ICONS: Record<StatIconKind, (size: number) => ReactNode> = {
  hp: (size) => <IconHeart size={size} />,
  atk: (size) => <IconSword size={size} />,
  def: (size) => <IconShield size={size} />,
  critRate: (size) => <IconTarget size={size} />,
  critDmg: (size) => <IconFlame size={size} />,
  energy: (size) => <IconBattery3 size={size} />,
  mastery: (size) => <IconSparkles size={size} />,
  proficiency: (size) => <IconAtom size={size} />,
  impact: (size) => <IconHammer size={size} />,
  penRatio: (size) => <IconTargetArrow size={size} />,
  pen: (size) => <IconArrowBigRightLines size={size} />,
  elementDmg: (size) => <IconDroplet size={size} />,
  dmgBonus: (size) => <IconMeteor size={size} />,
  heal: (size) => <IconFirstAidKit size={size} />,
  sheer: (size) => <IconSwords size={size} />,
}

export function statIcon(kind: StatIconKind, size = 16): ReactNode {
  return ICONS[kind](size)
}

// Unused kinds fall back to a bolt, so a new stat never breaks a page
export function statIconOr(kind: StatIconKind | undefined, size = 16): ReactNode {
  return kind ? statIcon(kind, size) : <IconBolt size={size} />
}
