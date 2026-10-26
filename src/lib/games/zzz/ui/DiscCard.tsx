import {
  Badge,
  Group,
  Text,
} from '@mantine/core'
import type { GearScore } from 'lib/games/shared/gearScore'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import { GearScoreLine } from 'lib/games/shared/ui/GearScoreLine'
import { getSubstatValue } from 'lib/games/zzz/discStats'
import type { Disc } from 'lib/games/zzz/types'

// Mantine colors for ZZZ attributes, used for agent badges
const ELEMENT_COLORS: Record<string, string> = {
  Physical: 'yellow',
  Fire: 'red',
  Ice: 'cyan',
  Electric: 'blue',
  Ether: 'grape',
  Wind: 'teal',
}

export function elementColor(element: string): string {
  return ELEMENT_COLORS[element] ?? 'gray'
}

function RollDots({ rolls }: { rolls: number }) {
  // An S-rank substat can hold up to 6 rolls (1 initial + 5 upgrades)
  return (
    <span className={gear.dots} title={`${rolls} roll${rolls === 1 ? '' : 's'}`}>
      {Array.from({ length: Math.min(rolls, 6) }, (_, i) => <span key={i} className={gear.dot} />)}
    </span>
  )
}

// icon: the set's art (data/images.ts), when it has loaded; score: for the agent shown (stats/discScore.ts)
export function DiscCard({ disc, owner, icon, score }: { disc: Disc, owner?: string, icon?: string, score?: GearScore }) {
  return (
    <div className={gear.card}>
      <Group justify='space-between' gap={6} wrap='nowrap'>
        <Badge size='sm' variant='light' radius='sm'>{`Slot ${disc.slot}`}</Badge>
        <Text size='xs' c='dimmed'>{`${disc.rarity} · +${disc.level}`}</Text>
      </Group>
      <Group gap={8} wrap='nowrap'>
        {icon && <img src={icon} alt='' width={30} height={30} style={{ objectFit: 'contain', flexShrink: 0 }} />}
        <div className={gear.title}>{disc.setName}</div>
      </Group>
      <div className={gear.main}>
        <span>{disc.main.stat}</span>
        <span>{disc.main.value}</span>
      </div>
      <div className={gear.subs}>
        {disc.substats.map((substat) => {
          const value = getSubstatValue(disc.rarity, substat.stat, substat.rolls)
          return (
            <div key={substat.stat} className={gear.sub}>
              <span>{substat.stat}</span>
              <RollDots rolls={substat.rolls} />
              <span className={gear.subValue}>{value === undefined ? `x${substat.rolls}` : `+${value}`}</span>
            </div>
          )
        })}
      </div>
      <GearScoreLine score={score} />
      {owner && <div className={gear.footer}>{`Worn by ${owner}`}</div>}
    </div>
  )
}
