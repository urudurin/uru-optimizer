import {
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import {
  type BuffSetting,
  type BuffStat,
  debuffLabel,
  isDebuff,
  isSpecialStat,
} from 'lib/games/genshin/team/buffs'
import type {
  AppliedBuff,
  TeamBuffResult,
  TeamSetup,
} from 'lib/games/genshin/team/teamBuffs'
import {
  formatStatValue,
  type GenshinCharacter,
  type GenshinStatKey,
  statLabel,
} from 'lib/games/genshin/types'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'

// The Team row of the Genshin optimizer, after HSR's teammates row and Genshin Optimizer's team setup: who the
// teammates are, whether this character is on the field, and every buff the team gives them with its toggle.

const REACTION_NAMES: Record<string, string> = {
  lunarcharged: 'Lunar-Charged',
  lunarbloom: 'Lunar-Bloom',
  lunarcrystallize: 'Lunar-Crystallize',
  stellarconduct: 'Stellar-Conduct',
  stellarswirl: 'Stellar Swirl',
}

function describeStat(stat: BuffStat, value: number): string {
  if (isDebuff(stat)) return `${value}% ${debuffLabel(stat)}`
  if (stat === 'lunarBonus') return `+${value.toFixed(1)}% Lunar Reaction DMG`
  if (isSpecialStat(stat)) {
    const [field, kind] = stat.split(':')
    const name = REACTION_NAMES[kind] ?? kind
    if (field === 'specialFlat') return `+${Math.round(value)} ${name} DMG per hit`
    if (field === 'specialCritRate') return `+${value.toFixed(1)}% ${name} CRIT Rate`
    if (field === 'specialCritDmg') return `+${value.toFixed(1)}% ${name} CRIT DMG`
    return `+${value.toFixed(1)}% ${name} DMG`
  }
  return `+${formatStatValue(stat, value)} ${statLabel(stat)}`
}

function describeValue(entry: AppliedBuff): string {
  return entry.stat ? describeStat(entry.stat, entry.value) : ''
}

function BuffControl({ entry, onChange }: { entry: AppliedBuff, onChange: (value: BuffSetting) => void }) {
  const toggle = entry.buff.toggle
  if (!toggle) return <Text size='xs' c='dimmed'>Always on</Text>
  if (toggle.kind === 'switch') {
    return <Switch size='xs' label={toggle.label} checked={entry.setting !== false} onChange={(event) => onChange(event.currentTarget.checked)} />
  }
  if (toggle.kind === 'stacks') {
    const max = entry.giver ? toggle.max(entry.giver) : 0
    return (
      <NumberInput
        size='xs'
        w={150}
        label={toggle.label}
        min={0}
        max={max}
        step={toggle.step}
        value={typeof entry.setting === 'number' ? entry.setting : max}
        onChange={(value) => onChange(typeof value === 'number' ? Math.min(max, Math.max(0, value)) : 0)}
      />
    )
  }
  return (
    <Select
      size='xs'
      w={150}
      label={toggle.label}
      allowDeselect={false}
      value={typeof entry.setting === 'string' ? entry.setting : null}
      onChange={(value) => value && onChange(value)}
      data={toggle.options}
    />
  )
}

export function teamSummary(team: TeamSetup, result: TeamBuffResult, characters: GenshinCharacter[]): string {
  const names = team.teammates.map((id) => characters.find((c) => c.id === id)?.name ?? id)
  const counted = result.applied.filter((a) => a.counted).length
  return names.length > 0 ? `${names.join(', ')} · ${counted} buff${counted === 1 ? '' : 's'} counted` : 'No teammates, stat screen only'
}

export function GenshinTeamCards({ character, characters, team, result, onTeammates, onField, onSetting }: {
  character: GenshinCharacter,
  characters: GenshinCharacter[],
  team: TeamSetup,
  result: TeamBuffResult,
  onTeammates: (ids: string[]) => void,
  onField: (onField: boolean) => void,
  onSetting: (key: string, value: BuffSetting) => void,
}) {
  const totals: [BuffStat, number][] = [
    ...Object.entries(result.premod) as [GenshinStatKey, number][],
    ...Object.entries(result.total) as [GenshinStatKey, number][],
    ...(result.debuffs.defShred ? [['defShred', result.debuffs.defShred] as [BuffStat, number]] : []),
    ...Object.entries(result.debuffs.resShred).map(([element, value]) => [`resShred:${element}`, value] as [BuffStat, number]),
    ...(result.lunarBonus ? [['lunarBonus', result.lunarBonus] as [BuffStat, number]] : []),
  ]
  return (
    <>
      <FormCard
        title='Teammates'
        size='narrow'
        description='Their kits, weapons and 4-piece sets buff this character. Teammates use the artifacts they wear now.'
      >
        <MultiSelect
          aria-label='Teammates'
          placeholder={team.teammates.length ? undefined : 'Pick up to 3'}
          searchable
          maxValues={3}
          value={team.teammates}
          onChange={onTeammates}
          data={characters.filter((c) => c.id !== character.id).map((c) => ({ value: c.id, label: c.name }))}
        />
        <Switch label={`${character.name} is on the field`} checked={team.onField} onChange={(event) => onField(event.currentTarget.checked)} />
        <Text size='xs' c='dimmed'>
          {result.resonance.length > 0
            ? `Resonance: ${result.resonance.join(', ')}`
            : 'No elemental resonance (needs a team of 4 with 2 of one element)'}
        </Text>
      </FormCard>

      <FormCard title='Team buffs' size='wide' description={`What the team gives ${character.name}, counted in the scores below.`}>
        {result.applied.length === 0
          ? (
            <Text size='xs' c='dimmed'>
              Pick teammates to see what they give. Phase 1 covers Bennett, Kazuha, Sucrose, Furina, Nahida, Zhongli, Lisa, team 4-pieces (Viridescent Venerer
              shred too), Millennial Movement weapons, Thrilling Tales and resonance.
            </Text>
          )
          : (
            <Stack gap='sm'>
              {result.applied.map((entry) => (
                <Group key={`${entry.key}`} justify='space-between' align='flex-end' wrap='nowrap' gap='sm'>
                  <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                    <Text size='xs' c='dimmed'>{entry.sourceName}</Text>
                    <Text size='xs'>{entry.buff.label}</Text>
                    <Text size='xs' c={entry.counted ? 'teal' : 'dimmed'}>{entry.counted ? describeValue(entry) : entry.reason}</Text>
                  </Stack>
                  <BuffControl entry={entry} onChange={(value) => onSetting(entry.key, value)} />
                </Group>
              ))}
              {(result.moonsign > 0 || Object.keys(result.baseBonus).length > 0) && (
                <Text size='xs' c='dimmed'>
                  {[
                    result.moonsign > 0 ? `Moonsign: ${result.moonsign >= 2 ? 'Ascendant Gleam' : 'Nascent Gleam'} (${result.moonsign})` : '',
                    ...Object.entries(result.baseBonus).map(([kind, value]) => `${REACTION_NAMES[kind] ?? kind} Base DMG +${value.toFixed(1)}%`),
                  ].filter(Boolean).join(' · ')}
                </Text>
              )}
              <Text size='xs' fw={600}>
                {totals.length > 0
                  ? `In total: ${totals.map(([stat, value]) => describeStat(stat, value)).join(', ')}`
                  : 'Nothing counted right now'}
              </Text>
              <Text size='xs' c='dimmed'>
                A character's own kit effects are on the Own effects card. Enemy shred only counts when ranking by rotation damage.
              </Text>
            </Stack>
          )}
      </FormCard>
    </>
  )
}
