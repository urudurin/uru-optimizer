import {
  Badge,
  Group,
  Text,
} from '@mantine/core'
import gear from 'lib/games/shared/ui/GearCard.module.css'
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

export function DiscCard({ disc, owner }: { disc: Disc, owner?: string }) {
  return (
    <div className={gear.card}>
      <Group justify='space-between' gap={6} wrap='nowrap'>
        <Badge size='sm' variant='light' radius='sm'>{`Slot ${disc.slot}`}</Badge>
        <Text size='xs' c='dimmed'>{`${disc.rarity} · +${disc.level}`}</Text>
      </Group>
      <div className={gear.title}>{disc.setName}</div>
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
      {owner && <div className={gear.footer}>{`Worn by ${owner}`}</div>}
    </div>
  )
}
