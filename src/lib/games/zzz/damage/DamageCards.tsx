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
import type { ZzzAppliedEffect } from 'lib/games/zzz/damage/combatEffects'
import {
  agentHits,
  anomalyHits,
  anomalyMultiplier,
  defaultRotation,
  type EnemyDebuffs,
  type EnemySettings,
  hitKey,
  hitMultiplier,
  type Rotation,
  rotationAnomalyMultiplier,
  rotationMultiplier,
} from 'lib/games/zzz/damage/damage'

// The Damage row of the ZZZ optimizer, after HSR's enemy settings and combo drawer: who the enemy is, and how many times
// each skill hit lands in a rotation. The optimizer can then rank builds by the rotation's damage (damage/damage.ts).

const CATEGORY_LABELS: Record<string, string> = {
  basic: 'Basic Attack',
  dodge: 'Dodge',
  special: 'Special Attack',
  chain: 'Chain Attack & Ultimate',
  assist: 'Assist',
}

export function EnemyCard({ enemy, debuffs, teamElements = [], onChange }: {
  enemy: EnemySettings,
  debuffs: EnemyDebuffs,
  // The squad's attributes: Windswept needs a Wind agent, Frostbite an Ice agent
  teamElements?: string[],
  onChange: (enemy: EnemySettings) => void,
}) {
  const set = (changes: Partial<EnemySettings>) => onChange({ ...enemy, ...changes })
  const fromTeam = [
    debuffs.defShred ? `${debuffs.defShred}% DEF shred` : '',
    debuffs.resShred ? `${debuffs.resShred}% RES shred` : '',
    debuffs.dmgTaken ? `${debuffs.dmgTaken}% more DMG taken` : '',
  ].filter(Boolean)
  return (
    <FormCard title='Enemy' size='narrow' description='DEF and RES of the enemy you fight. The team row adds its shred on top.'>
      <Group grow gap='xs'>
        <NumberInput size='xs' label='DEF' min={0} value={enemy.def} onChange={(value) => set({ def: Number(value) || 0 })} />
        <NumberInput size='xs' label='RES %' value={enemy.res} onChange={(value) => set({ res: Number(value) || 0 })} />
      </Group>
      <Switch size='xs' label='Stunned' checked={enemy.stunned} onChange={(event) => set({ stunned: event.currentTarget.checked })} />
      {enemy.stunned && (
        <NumberInput
          size='xs'
          label='Stun DMG multiplier %'
          min={100}
          value={enemy.stunMultiplier}
          onChange={(value) => set({ stunMultiplier: Number(value) || 100 })}
        />
      )}
      {teamElements.includes('Wind') && (
        <Switch
          size='xs'
          label='Windswept (direct DMG +10%)'
          checked={!!enemy.windswept}
          onChange={(event) => set({ windswept: event.currentTarget.checked })}
        />
      )}
      {teamElements.includes('Ice') && (
        <Switch
          size='xs'
          label='Frostbite (CRIT DMG +10%)'
          checked={!!enemy.frostbite}
          onChange={(event) => set({ frostbite: event.currentTarget.checked })}
        />
      )}
      <Text size='xs' c='dimmed'>{fromTeam.length ? `From the team: ${fromTeam.join(', ')}` : 'No shred from the team'}</Text>
    </FormCard>
  )
}

export function RotationCard({ agentId, element, teamElements = [], scaling = 'ATK', rotation, damage, onChange }: {
  agentId: string,
  // The agent's attribute, for the anomaly it triggers
  element: string,
  // The squad's attributes: a Wind agent lets the others set off Vortex
  teamElements?: string[],
  // What skill hits scale on: ATK, or Sheer Force for Rupture agents
  scaling?: string,
  rotation: Rotation,
  // The current build's rotation damage, when known
  damage?: number,
  onChange: (rotation: Rotation) => void,
}) {
  const hits = agentHits(agentId)
  const categories = [...new Set(hits.map((hit) => hit.category))]
  const setCount = (key: string, count: number) => {
    const counts = { ...rotation.counts }
    if (count > 0) counts[key] = count
    else delete counts[key]
    onChange({ ...rotation, counts })
  }
  const total = rotationMultiplier(agentId, rotation)
  const anomalies = anomalyHits(agentId, element, teamElements)
  const anomalyTotal = rotationAnomalyMultiplier(agentId, element, rotation, teamElements)
  const hasVortex = anomalies.some((hit) => hit.kind === 'vortex')

  if (hits.length === 0) {
    return (
      <FormCard title='Rotation' size='wide'>
        <Text size='xs' c='dimmed'>No skill data for this agent yet.</Text>
      </FormCard>
    )
  }

  return (
    <FormCard
      title='Rotation'
      size='wide'
      description='How many times each hit lands. Damage is the average of the whole rotation, crits counted at their rate.'
    >
      <Group gap='xs' align='flex-end'>
        <Select
          size='xs'
          w={120}
          label='Skill level'
          allowDeselect={false}
          value={String(rotation.skillLevel)}
          onChange={(value) => onChange({ ...rotation, skillLevel: Number(value ?? 12) })}
          data={Array.from({ length: 16 }, (_, i) => String(i + 1))}
        />
        <Button size='xs' variant='light' onClick={() => onChange(defaultRotation(agentId))}>Default</Button>
        <Button size='xs' variant='subtle' onClick={() => onChange({ ...rotation, counts: {} })}>Clear</Button>
        <Text size='xs' ml='auto'>
          {`${formatNumber(Math.round(total))}% of ${scaling}${anomalyTotal ? ` + ${formatNumber(Math.round(anomalyTotal))}% anomaly` : ''} in total${
            damage !== undefined ? ` · ${formatNumber(Math.round(damage))} damage now` : ''
          }`}
        </Text>
      </Group>
      <div className={classes.hitList}>
        {categories.map((category) => (
          <Stack key={category} gap={4}>
            <Text size='xs' fw={600}>{CATEGORY_LABELS[category] ?? category}</Text>
            {hits.filter((hit) => hit.category === category).map((hit) => (
              <div key={hitKey(hit)} className={classes.hitRow}>
                <Text size='xs' className={classes.hitLabel} title={hit.label}>{hit.aftershock ? `${hit.label} (Aftershock)` : hit.label}</Text>
                <Text size='xs' c='dimmed' ta='right'>{`${hitMultiplier(hit, rotation.skillLevel).toFixed(1)}%`}</Text>
                <NumberInput
                  size='xs'
                  min={0}
                  max={99}
                  hideControls
                  aria-label={`${hit.label} count`}
                  placeholder='0'
                  value={rotation.counts[hitKey(hit)] ?? ''}
                  onChange={(value) => setCount(hitKey(hit), Number(value) || 0)}
                />
              </div>
            ))}
          </Stack>
        ))}
        {anomalies.length > 0 && (
          <Stack gap={4}>
            <Text size='xs' fw={600}>Attribute Anomaly</Text>
            {anomalies.map((hit) => (
              <div key={hit.key} className={classes.hitRow}>
                <Text size='xs' className={classes.hitLabel} title={hit.label}>{hit.label}</Text>
                <Text size='xs' c='dimmed' ta='right'>
                  {`${anomalyMultiplier(agentId, element, hit.kind, rotation.disorderAfter, hit.attribute).toFixed(1)}%`}
                </Text>
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
            <NumberInput
              size='xs'
              label={hasVortex ? 'Disorder / Vortex after (seconds of the anomaly)' : 'Disorder after (seconds of the anomaly)'}
              min={0}
              max={hasVortex ? 30 : 20}
              step={0.5}
              value={rotation.disorderAfter ?? 0}
              onChange={(value) => onChange({ ...rotation, disorderAfter: Math.max(0, Number(value) || 0) })}
            />
            <Text size='xs' c='dimmed'>No CRIT unless a kit says so; scales with Anomaly Proficiency and agent level.</Text>
          </Stack>
        )}
      </div>
    </FormCard>
  )
}

// The agent's own kit effects (damage/combatEffects.ts), with toggles; they count only in rotation damage
export function KitEffectsCard({ name, applied, onSetting }: {
  name: string,
  applied: ZzzAppliedEffect[],
  onSetting: (id: string, value: boolean | number) => void,
}) {
  return (
    <FormCard
      title='Own effects'
      size='wide'
      description={`What ${name}'s kit, W-Engine and the set filter's sets do in combat, counted only when ranking by rotation damage.`}
    >
      {applied.length === 0
        ? <Text size='xs' c='dimmed'>No kit or gear effects for this agent yet.</Text>
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
                    value={typeof setting === 'number' ? setting : effect.toggle.max}
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
