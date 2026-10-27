import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { formatNumber } from 'lib/games/shared/format'
import classes from 'lib/games/shared/ui/optimizer/RotationHits.module.css'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'
import {
  characterHits,
  defaultRotation,
  describeHit,
  type EnemySettings,
  hitMultiplier,
  MAX_SKILL_LEVEL,
  type Rotation,
} from 'lib/games/wuwa/damage/damage'

// The Damage row of the WuWa optimizer, like ZZZ's and Genshin's: the enemy, and how many times each skill's damage
// lines land in a rotation.

const SECTION_LABELS: Record<string, string> = {
  normal: 'Normal Attack',
  skill: 'Resonance Skill',
  liberation: 'Resonance Liberation',
  intro: 'Intro Skill',
  forte: 'Forte Circuit',
  outro: 'Outro Skill',
}

export function EnemyCard({ enemy, onChange }: { enemy: EnemySettings, onChange: (enemy: EnemySettings) => void }) {
  const set = (changes: Partial<EnemySettings>) => onChange({ ...enemy, ...changes })
  const number = (value: string | number) => Number(value) || 0
  return (
    <FormCard
      title='Enemy'
      size='narrow'
      description='Level and RES of the enemy you fight. Teammates&apos; DEF ignore, RES shred and DMG Amplified aren&apos;t worked out yet: add them here.'
    >
      <Group grow gap='xs'>
        <NumberInput size='xs' label='Level' min={1} max={150} value={enemy.level} onChange={(value) => set({ level: number(value) || 1 })} />
        <NumberInput size='xs' label='RES %' value={enemy.res} onChange={(value) => set({ res: number(value) })} />
      </Group>
      <Group grow gap='xs'>
        <NumberInput size='xs' label='DEF ignore %' min={0} max={100} value={enemy.defIgnore} onChange={(value) => set({ defIgnore: number(value) })} />
        <NumberInput size='xs' label='RES shred %' value={enemy.resShred} onChange={(value) => set({ resShred: number(value) })} />
      </Group>
      <NumberInput size='xs' label='DMG Amplified %' min={0} value={enemy.amplify} onChange={(value) => set({ amplify: number(value) })} />
      <Text size='xs' c='dimmed'>DMG Amplified is the same for every loadout: it changes the damage shown, never the ranking.</Text>
    </FormCard>
  )
}

export function RotationCard({ charId, rotation, damage, onChange }: {
  charId: string,
  rotation: Rotation,
  // The current loadout's rotation damage, when known
  damage?: number,
  onChange: (rotation: Rotation) => void,
}) {
  const hits = characterHits(charId)
  const sections = [...new Set(hits.map((hit) => hit.section))]
  const setCount = (key: string, count: number) => {
    const counts = { ...rotation.counts }
    if (count > 0) counts[key] = count
    else delete counts[key]
    onChange({ ...rotation, counts })
  }
  const total = hits.reduce((sum, hit) => sum + (rotation.counts[hit.key] ?? 0) * hitMultiplier(hit, rotation.skillLevel), 0)

  if (hits.length === 0) {
    return (
      <FormCard title='Rotation' size='wide'>
        <Text size='xs' c='dimmed'>No skill data for this Resonator yet.</Text>
      </FormCard>
    )
  }

  return (
    <FormCard
      title='Rotation'
      size='wide'
      description='How many times each damage line lands. Each line takes the DMG bonus of what the game counts it as (hover a line to see).'
    >
      <Group gap='xs' align='flex-end'>
        <Select
          size='xs'
          w={120}
          label='Skill level'
          allowDeselect={false}
          value={String(rotation.skillLevel)}
          onChange={(value) => onChange({ ...rotation, skillLevel: Number(value ?? MAX_SKILL_LEVEL) })}
          data={Array.from({ length: MAX_SKILL_LEVEL }, (_, i) => String(i + 1))}
        />
        <Button size='xs' variant='light' onClick={() => onChange(defaultRotation(charId))}>Default</Button>
        <Button size='xs' variant='subtle' onClick={() => onChange({ ...rotation, counts: {} })}>Clear</Button>
        <Text size='xs' ml='auto'>
          {`${formatNumber(Math.round(total))}% in total${damage !== undefined ? ` · ${formatNumber(Math.round(damage))} damage now` : ''}`}
        </Text>
      </Group>
      <div className={classes.hitList}>
        {sections.map((section) => (
          <Stack key={section} gap={4}>
            <Text size='xs' fw={600}>{SECTION_LABELS[section] ?? section}</Text>
            {hits.filter((hit) => hit.section === section).map((hit) => (
              <div key={hit.key} className={classes.hitRow}>
                <Text size='xs' className={classes.hitLabel} title={`${hit.label} (${describeHit(hit)})`}>{hit.label}</Text>
                <Text size='xs' c='dimmed' ta='right'>{`${hitMultiplier(hit, rotation.skillLevel).toFixed(1)}%`}</Text>
                <NumberInput
                  size='xs'
                  min={0}
                  max={99}
                  hideControls
                  aria-label={`${hit.label} count`}
                  placeholder='0'
                  value={rotation.counts[hit.key] ?? ''}
                  onChange={(value) => setCount(hit.key, Number(value) || 0)}
                />
              </div>
            ))}
          </Stack>
        ))}
      </div>
    </FormCard>
  )
}
