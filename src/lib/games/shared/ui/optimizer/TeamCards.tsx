import {
  Group,
  MultiSelect,
  NumberInput,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'

// The Team row of the ZZZ and WuWa optimizers, after HSR's teammates row (genshin/GenshinTeamCards.tsx is the Genshin
// one, with resonance and on-field): pick teammates, then every buff they give with its toggle or stack count. Each
// game turns its own team result into these entries.

export type TeamSetting = boolean | number

export type TeamEntry = {
  key: string,
  source: string,
  label: string,
  counted: boolean,
  // '+20% ATK' when counted, otherwise why not
  detail: string,
  toggle?: { kind: 'switch', label: string } | { kind: 'stacks', label: string, max: number },
  setting: TeamSetting,
}

function EntryControl({ entry, onChange }: { entry: TeamEntry, onChange: (value: TeamSetting) => void }) {
  const toggle = entry.toggle
  if (!toggle) return <Text size='xs' c='dimmed'>Always on</Text>
  if (toggle.kind === 'switch') {
    return <Switch size='xs' label={toggle.label} checked={entry.setting !== false} onChange={(event) => onChange(event.currentTarget.checked)} />
  }
  return (
    <NumberInput
      size='xs'
      w={170}
      label={toggle.label}
      min={0}
      max={toggle.max}
      value={typeof entry.setting === 'number' ? entry.setting : toggle.max}
      onChange={(value) => onChange(typeof value === 'number' ? Math.min(toggle.max, Math.max(0, value)) : 0)}
    />
  )
}

export function teamSummary(names: string[], entries: TeamEntry[]): string {
  const counted = entries.filter((e) => e.counted).length
  return names.length > 0 ? `${names.join(', ')} · ${counted} buff${counted === 1 ? '' : 's'} counted` : 'No teammates'
}

export function TeamCards({ name, options, teammates, maxTeammates, entries, notice, emptyText, footnote, description, onTeammates, onSetting }: {
  // Who receives the buffs
  name: string,
  options: { value: string, label: string }[],
  teammates: string[],
  maxTeammates: number,
  entries: TeamEntry[],
  // e.g. teammates without a saved build
  notice?: string,
  emptyText: string,
  footnote: string,
  description: string,
  onTeammates: (ids: string[]) => void,
  onSetting: (key: string, value: TeamSetting) => void,
}) {
  return (
    <>
      <FormCard title='Teammates' size='narrow' description={description}>
        <MultiSelect
          aria-label='Teammates'
          placeholder={teammates.length ? undefined : `Pick up to ${maxTeammates}`}
          searchable
          maxValues={maxTeammates}
          value={teammates}
          onChange={onTeammates}
          data={options}
        />
        {notice && <Text size='xs' c='yellow'>{notice}</Text>}
      </FormCard>
      <FormCard title='Team buffs' size='wide' description={`What the team gives ${name}, counted in the scores below.`}>
        {entries.length === 0
          ? <Text size='xs' c='dimmed'>{emptyText}</Text>
          : (
            <Stack gap='sm'>
              {entries.map((entry) => (
                <Group key={entry.key} justify='space-between' align='flex-end' wrap='nowrap' gap='sm'>
                  <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                    <Text size='xs' c='dimmed'>{entry.source}</Text>
                    <Text size='xs'>{entry.label}</Text>
                    <Text size='xs' c={entry.counted ? 'teal' : 'dimmed'}>{entry.detail}</Text>
                  </Stack>
                  <EntryControl entry={entry} onChange={(value) => onSetting(entry.key, value)} />
                </Group>
              ))}
              <Text size='xs' c='dimmed'>{footnote}</Text>
            </Stack>
          )}
      </FormCard>
    </>
  )
}
