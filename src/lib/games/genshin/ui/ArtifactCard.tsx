import {
  Badge,
  Group,
  Text,
} from '@mantine/core'
import {
  type Artifact,
  type Element,
  formatStatValue,
  SLOT_LABELS,
  statLabel,
} from 'lib/games/genshin/types'
import type { GearScore } from 'lib/games/shared/gearScore'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import { GearScoreLine } from 'lib/games/shared/ui/GearScoreLine'

// Mantine colors for Genshin elements, used for character badges
const ELEMENT_COLORS: Record<Element, string> = {
  Pyro: 'red',
  Hydro: 'blue',
  Anemo: 'teal',
  Electro: 'violet',
  Dendro: 'green',
  Cryo: 'cyan',
  Geo: 'yellow',
}

export function elementColor(element: Element | undefined): string {
  return element ? ELEMENT_COLORS[element] : 'gray'
}

function RollDots({ rolls }: { rolls: number }) {
  // A 5-star substat can roll up to 6 times (1 initial + 5 upgrades)
  return (
    <span className={gear.dots} title={`${rolls} roll${rolls === 1 ? '' : 's'}`}>
      {Array.from({ length: Math.min(rolls, 6) }, (_, i) => <span key={i} className={gear.dot} />)}
    </span>
  )
}

// score: for the character shown (stats/artifactScore.ts)
export function ArtifactCard({ artifact, owner, score }: { artifact: Artifact, owner?: string, score?: GearScore }) {
  return (
    <div className={gear.card}>
      <Group justify='space-between' gap={6} wrap='nowrap'>
        <Badge size='sm' variant='light' radius='sm'>{SLOT_LABELS[artifact.slot]}</Badge>
        <Text size='xs' c='dimmed'>{`${artifact.rarity}★ · +${artifact.level}`}</Text>
      </Group>
      <div className={gear.title}>{artifact.setName}</div>
      <div className={gear.main}>
        <span>{statLabel(artifact.main.stat)}</span>
        <span>{formatStatValue(artifact.main.stat, artifact.main.value)}</span>
      </div>
      <div className={gear.subs}>
        {artifact.substats.map((substat) => (
          <div key={substat.stat} className={gear.sub}>
            <span>{statLabel(substat.stat)}</span>
            <RollDots rolls={substat.rolls} />
            <span className={gear.subValue}>{formatStatValue(substat.stat, substat.value)}</span>
          </div>
        ))}
      </div>
      <GearScoreLine score={score} />
      {owner && <div className={gear.footer}>{`Worn by ${owner}`}</div>}
    </div>
  )
}
