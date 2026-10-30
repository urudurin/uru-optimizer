import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import type { AppliedEffect } from 'lib/games/genshin/damage/combatEffects'
import {
  characterHits,
  defaultRotation,
  describeMultiplier,
  type EnemyDebuffs,
  type EnemySettings,
  HIT_CATEGORY_LABELS,
  hitMultiplier,
  type Reaction,
  reactionsFor,
  type Rotation,
  type SpecialKind,
  type Talent,
  type TalentLevels,
  transformativeBase,
  transformativeLines,
} from 'lib/games/genshin/damage/damage'
import type { BuffSetting } from 'lib/games/genshin/team/buffs'
import type {
  Element,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import { formatNumber } from 'lib/games/shared/format'
import classes from 'lib/games/shared/ui/optimizer/RotationHits.module.css'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'

// The Damage row of the Genshin optimizer, like ZZZ's (zzz/damage/DamageCards.tsx): the enemy, and how many times each
// talent hit lands in a rotation, with talent levels, an infusion switch and an amplifying reaction.

const TALENT_LABELS: Record<Talent, string> = { auto: 'Normal Attack', skill: 'Skill', burst: 'Burst' }

const REACTION_LABELS: Record<Reaction, string> = { none: 'None', vaporize: 'Vaporize', melt: 'Melt', aggravate: 'Aggravate', spread: 'Spread' }

export function EnemyCard({ enemy, debuffs, onChange }: {
  enemy: EnemySettings,
  debuffs: EnemyDebuffs,
  onChange: (enemy: EnemySettings) => void,
}) {
  const set = (changes: Partial<EnemySettings>) => onChange({ ...enemy, ...changes })
  const fromTeam = [
    debuffs.defShred ? `${debuffs.defShred}% DEF shred` : '',
    ...Object.entries(debuffs.resShred).map(([element, value]) => `${value}% ${element === 'all' ? 'all' : element} RES shred`),
  ].filter(Boolean)
  return (
    <FormCard title='Enemy' size='narrow' description='Level and RES of the enemy you fight (most have 10%). The team row adds its shred on top.'>
      <Group grow gap='xs'>
        <NumberInput size='xs' label='Level' min={1} max={200} value={enemy.level} onChange={(value) => set({ level: Number(value) || 1 })} />
        <NumberInput size='xs' label='RES %' value={enemy.res} onChange={(value) => set({ res: Number(value) || 0 })} />
      </Group>
      <Text size='xs' c='dimmed'>{fromTeam.length ? `From the team: ${fromTeam.join(', ')}` : 'No shred from the team'}</Text>
    </FormCard>
  )
}

export function RotationCard({ character, rotation, talents, damage, team, onChange }: {
  character: GenshinCharacter,
  // The Lunar and Stellar kinds the team can trigger: other ones aren't offered
  team: SpecialKind[],
  rotation: Rotation,
  // The talent levels in use (the rotation's own, or the character's with constellation boosts)
  talents: TalentLevels,
  // The current build's rotation damage, when known
  damage?: number,
  onChange: (rotation: Rotation) => void,
}) {
  const hits = characterHits(character.id)
  const categories = [...new Set(hits.map((hit) => hit.category))]
  const setCount = (key: string, count: number) => {
    const counts = { ...rotation.counts }
    if (count > 0) counts[key] = count
    else delete counts[key]
    onChange({ ...rotation, counts })
  }
  const element: Element | undefined = character.element
  const reactions = reactionsFor(element)
  const triggers = transformativeLines(element, team)
  const polestar = team.includes('stellarconduct')

  if (hits.length === 0) {
    return (
      <FormCard title='Rotation' size='wide'>
        <Text size='xs' c='dimmed'>No talent data for this character yet.</Text>
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
        {(Object.keys(TALENT_LABELS) as Talent[]).map((talent) => (
          <Select
            key={talent}
            size='xs'
            w={110}
            label={TALENT_LABELS[talent]}
            allowDeselect={false}
            value={String(talents[talent])}
            onChange={(value) => onChange({ ...rotation, talents: { ...talents, [talent]: Number(value ?? 1) } })}
            data={Array.from({ length: 15 }, (_, i) => String(i + 1))}
          />
        ))}
        <Button size='xs' variant='light' onClick={() => onChange(defaultRotation(character.id))}>Default</Button>
        <Button size='xs' variant='subtle' onClick={() => onChange({ ...rotation, counts: {} })}>Clear</Button>
      </Group>
      <Text size='xs' c='dimmed'>
        {rotation.talents
          ? 'Talent levels set here. Default goes back to the character\'s, with constellation boosts.'
          : 'Talent levels are the character\'s, with constellation boosts.'}
      </Text>
      <Group gap='md' align='flex-end'>
        <Switch
          size='xs'
          label={`Normal, charged and plunging attacks deal ${element ?? 'elemental'} DMG (infusion)`}
          checked={rotation.infusion}
          onChange={(event) => onChange({ ...rotation, infusion: event.currentTarget.checked })}
        />
        {reactions.length > 0 && (
          <>
            <Select
              size='xs'
              w={120}
              label='Reaction'
              allowDeselect={false}
              value={rotation.reaction}
              onChange={(value) => onChange({ ...rotation, reaction: (value ?? 'none') as Reaction })}
              data={(['none', ...reactions] as Reaction[]).map((reaction) => ({ value: reaction, label: REACTION_LABELS[reaction] }))}
            />
            {rotation.reaction !== 'none' && (
              <NumberInput
                size='xs'
                w={150}
                label={`${element} hits that react %`}
                min={0}
                max={100}
                value={rotation.reactionShare}
                onChange={(value) => onChange({ ...rotation, reactionShare: Math.min(100, Math.max(0, Number(value) || 0)) })}
              />
            )}
          </>
        )}
        {polestar && (
          <>
            <Switch
              size='xs'
              label='In a Polestar Field (Stellar-Conduct)'
              checked={!!rotation.polestar?.active}
              onChange={(event) => onChange({ ...rotation, polestar: { hits: rotation.polestar?.hits ?? 12, active: event.currentTarget.checked } })}
            />
            {rotation.polestar?.active && (
              <NumberInput
                size='xs'
                w={130}
                label='Field hits recorded'
                min={0}
                max={12}
                value={rotation.polestar.hits}
                onChange={(value) => onChange({ ...rotation, polestar: { active: true, hits: Math.min(12, Math.max(0, Number(value) || 0)) } })}
              />
            )}
          </>
        )}
        {damage !== undefined && <Text size='xs' ml='auto'>{`${formatNumber(Math.round(damage))} damage now`}</Text>}
      </Group>
      <div className={classes.hitList}>
        {categories.map((category) => (
          <Stack key={category} gap={4}>
            <Text size='xs' fw={600}>{HIT_CATEGORY_LABELS[category] ?? category}</Text>
            {hits.filter((hit) => hit.category === category).map((hit) => (
              <div key={hit.key} className={`${classes.hitRow} ${classes.hitRowWide}`}>
                <Text
                  size='xs'
                  className={classes.hitLabel}
                  title={hit.special ? `${hit.label}: Lunar or Stellar damage, no DEF or DMG Bonus, can CRIT` : hit.label}
                >
                  {hit.physical && !rotation.infusion ? `${hit.label} (Physical)` : hit.label}
                </Text>
                <Text size='xs' c='dimmed' ta='right'>{describeMultiplier(hitMultiplier(hit, talents))}</Text>
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
        {triggers.length > 0 && (
          <Stack gap={4}>
            <Text size='xs' fw={600}>Transformative reactions</Text>
            {triggers.map((line) => (
              <div key={line.key} className={`${classes.hitRow} ${classes.hitRowWide}`}>
                <Text size='xs' className={classes.hitLabel} title={line.label}>{line.label}</Text>
                <Text size='xs' c='dimmed' ta='right' title='Before Elemental Mastery and RES'>
                  {`${formatNumber(Math.round(transformativeBase(line.reaction, character.level)))} base`}
                </Text>
                <NumberInput
                  size='xs'
                  min={0}
                  max={99}
                  hideControls
                  aria-label={`${line.label} count`}
                  placeholder='0'
                  value={rotation.counts[line.key] ?? ''}
                  onChange={(value) => setCount(line.key, Number(value) || 0)}
                />
              </div>
            ))}
            <Text size='xs' c='dimmed'>
              Triggered by {character.name}: scale with their Elemental Mastery and level, no DEF. Only Lunar-Charged and Stellar Swirl can CRIT.
            </Text>
          </Stack>
        )}
      </div>
    </FormCard>
  )
}

// The character's own combat effects (damage/combatEffects.ts): their kit and the 4-piece filter's set, with toggles
export function EffectsCard({ name, fourPieceSet, applied, onSetting }: {
  name: string,
  // The 4-piece filter's set name, when one is picked
  fourPieceSet?: string,
  applied: AppliedEffect[],
  onSetting: (id: string, value: BuffSetting) => void,
}) {
  return (
    <FormCard
      title='Own effects'
      size='wide'
      description={`What ${name}'s kit, weapon and 4-piece set do in combat, counted only in rotation damage. ${
        fourPieceSet ? `4-piece: ${fourPieceSet}.` : 'Pick a 4-piece set in the artifact filters to count its effect.'
      }`}
    >
      {applied.length === 0
        ? <Text size='xs' c='dimmed'>Nothing for this character and set yet.</Text>
        : (
          <Stack gap='sm'>
            {applied.map(({ effect, sourceName, setting, counted }) => (
              <Group key={effect.id} justify='space-between' align='flex-end' wrap='nowrap' gap='sm'>
                <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Text size='xs' c='dimmed'>{sourceName}</Text>
                  <Text size='xs' c={counted ? undefined : 'dimmed'}>{effect.label}</Text>
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
                    onChange={(value) =>
                      onSetting(effect.id, Math.min(effect.toggle?.kind === 'stacks' ? effect.toggle.max : 0, Math.max(0, Number(value) || 0)))}
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
