import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { formatNumber } from 'lib/games/shared/format'
import classes from 'lib/games/shared/ui/optimizer/RotationHits.module.css'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'
import type { WuwaAppliedEffect } from 'lib/games/wuwa/damage/combatEffects'
import {
  characterHits,
  defaultRotation,
  describeHit,
  echoSkillHits,
  echoSkillText,
  type EnemySettings,
  hasEchoSkill,
  hitMultiplier,
  mainEchoBonus,
  MAX_SKILL_LEVEL,
  type Rotation,
} from 'lib/games/wuwa/damage/damage'
import { ECHO_DEFINITIONS } from 'lib/games/wuwa/data/gameData'
import { statLabel } from 'lib/games/wuwa/types'

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

// Echoes with Echo Skill damage, for the main echo picker
const ECHO_OPTIONS = Object.values(ECHO_DEFINITIONS as Record<string, { id: string, name: string }>)
  .filter((echo) => hasEchoSkill(echo.id))
  .map((echo) => ({ value: echo.id, label: echo.name }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function RotationCard({ charId, rotation, mainEcho, damage, onChange }: {
  charId: string,
  rotation: Rotation,
  // The echo in the Resonator's main slot now, picked when the rotation hasn't chosen one
  mainEcho?: string,
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
        <EchoSkillLines rotation={rotation} mainEcho={mainEcho} onChange={onChange} />
      </div>
    </FormCard>
  )
}

// The main echo's Echo Skill hits: assumes the picked echo is the one in the main slot of every loadout searched
function EchoSkillLines({ rotation, mainEcho, onChange }: { rotation: Rotation, mainEcho?: string, onChange: (rotation: Rotation) => void }) {
  const echoId = rotation.echo?.id ?? (mainEcho && hasEchoSkill(mainEcho) ? mainEcho : undefined)
  const counts = rotation.echo?.counts ?? {}
  const hits = echoId ? echoSkillHits(echoId) : []
  const text = echoId ? echoSkillText(echoId) : ''
  // What this echo gives in the main slot, counted when ranking by rotation damage
  const main = mainEchoBonus(echoId)
  const mainSlot = [
    ...Object.entries(main.stats).map(([stat, value]) => `+${value}% ${statLabel(stat)}`),
    ...(main.echoDmg ? [`+${main.echoDmg}% Echo Skill DMG`] : []),
  ].join(', ')
  const setCount = (key: string, count: number) => {
    if (!echoId) return
    const next = { ...counts }
    if (count > 0) next[key] = count
    else delete next[key]
    onChange({ ...rotation, echo: { id: echoId, counts: next } })
  }
  return (
    <Stack gap={4}>
      <Text size='xs' fw={600}>Echo Skill</Text>
      <Select
        size='xs'
        searchable
        placeholder='Main echo'
        value={echoId ?? null}
        onChange={(id) => onChange({ ...rotation, echo: id ? { id, counts: {} } : undefined })}
        data={ECHO_OPTIONS}
      />
      {hits.map((hit, i) => (
        <div key={hit.key} className={classes.hitRow}>
          <Text size='xs' className={classes.hitLabel} title={text}>{`Hit ${i + 1} (${hit.stat.toUpperCase()}${hit.element ? `, ${hit.element}` : ''})`}</Text>
          <Text size='xs' c='dimmed' ta='right'>{`${hit.multiplier.toFixed(1)}%`}</Text>
          <NumberInput
            size='xs'
            min={0}
            max={99}
            hideControls
            aria-label={`Echo Skill hit ${i + 1} count`}
            placeholder='0'
            value={counts[hit.key] ?? ''}
            onChange={(value) => setCount(hit.key, Number(value) || 0)}
          />
        </div>
      ))}
      {echoId && <Text size='xs' c='dimmed' title={text}>Highest rank. Assumes this echo is in the main slot; hover a hit for the skill text.</Text>}
      {mainSlot && <Text size='xs' c='dimmed'>{`Main slot: ${mainSlot}`}</Text>}
    </Stack>
  )
}

// The Resonator's own kit effects (damage/combatEffects.ts), with toggles; they count only in rotation damage
export function KitEffectsCard({ name, applied, onSetting }: {
  name: string,
  applied: WuwaAppliedEffect[],
  onSetting: (id: string, value: boolean | number) => void,
}) {
  return (
    <FormCard title='Own effects' size='wide' description={`What ${name}'s kit does in combat, counted only when ranking by rotation damage.`}>
      {applied.length === 0
        ? <Text size='xs' c='dimmed'>No kit effects for this Resonator yet.</Text>
        : (
          <Stack gap='sm'>
            {applied.map(({ effect, setting, counted, reason }) => (
              <Group key={effect.id} justify='space-between' align='flex-end' wrap='nowrap' gap='sm'>
                <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Text size='xs' c={counted ? undefined : 'dimmed'}>{effect.label}</Text>
                  {!counted && reason && <Text size='xs' c='dimmed'>{reason}</Text>}
                </Stack>
                {effect.toggle?.kind === 'switch' && (
                  <Switch
                    size='xs'
                    label={effect.toggle.label}
                    checked={setting !== false}
                    onChange={(event) => onSetting(effect.id, event.currentTarget.checked)}
                  />
                )}
                {effect.toggle?.kind === 'stacks' && (
                  <NumberInput
                    size='xs'
                    w={150}
                    label={effect.toggle.label}
                    min={0}
                    max={effect.toggle.max}
                    value={typeof setting === 'number' ? setting : 0}
                    onChange={(value) => onSetting(effect.id, Math.max(0, Number(value) || 0))}
                  />
                )}
                {!effect.toggle && <Text size='xs' c='dimmed'>Always on</Text>}
              </Group>
            ))}
          </Stack>
        )}
    </FormCard>
  )
}
