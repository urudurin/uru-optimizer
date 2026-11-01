import {
  Badge,
  Button,
  type ComboboxData,
  Group,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import {
  NO_SET,
  resolveTeammate,
  setOverride,
  type TeammateOverrides,
  type TeammateRoster,
} from 'lib/games/shared/teammateOverrides'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'

// Each teammate's rank, weapon and 4-piece set for the team buffs, after HSR's teammate cards; Sync from roster drops
// every change (shared/teammateOverrides.ts). Used by all three optimizers' Teammates rows.

export type OverrideMember = {
  id: string,
  name: string,
  roster: TeammateRoster,
  weapons: ComboboxData,
  // 4-piece sets with team buffs; left out for games without set team buffs (WuWa)
  sets?: { value: string, label: string }[],
}

const RANKS = [0, 1, 2, 3, 4, 5, 6]
const REFINEMENTS = [1, 2, 3, 4, 5]

export function TeammateOverrideCard({ members, overrides, rankPrefix, weaponLabel, refinementPrefix, onChange }: {
  members: OverrideMember[],
  overrides: TeammateOverrides,
  // 'C' (Constellation), 'M' (Mindscape), 'S' (Sequence)
  rankPrefix: string,
  // 'Weapon', 'W-Engine'
  weaponLabel: string,
  // 'R'
  refinementPrefix: string,
  onChange: (overrides: TeammateOverrides) => void,
}) {
  if (members.length === 0) return null
  const edited = members.some((member) => overrides[member.id])
  return (
    <FormCard title='Teammate overrides' size='normal' description='Change a teammate for the team buffs only; their saved character stays as it is.'>
      <Stack gap='sm'>
        {members.map((member) => {
          const shown = resolveTeammate(member.roster, overrides[member.id])
          const update = <K extends 'rank' | 'weaponId' | 'refinement' | 'fourPiece'>(field: K, value: TeammateRoster[K]) =>
            onChange(setOverride(overrides, member.id, field, value, member.roster))
          return (
            <Stack key={member.id} gap={4}>
              <Group gap={6}>
                <Text size='xs' fw={600}>{member.name}</Text>
                {overrides[member.id] && <Badge size='xs' variant='light'>Changed</Badge>}
              </Group>
              <Group gap='xs' wrap='nowrap'>
                <Select
                  size='xs'
                  w={70}
                  aria-label={`${member.name} rank`}
                  allowDeselect={false}
                  value={String(shown.rank)}
                  onChange={(value) => value !== null && update('rank', Number(value))}
                  data={RANKS.map((rank) => ({ value: String(rank), label: `${rankPrefix}${rank}` }))}
                />
                <Select
                  size='xs'
                  style={{ flex: 1, minWidth: 0 }}
                  aria-label={`${member.name} ${weaponLabel}`}
                  placeholder={`No ${weaponLabel}`}
                  searchable
                  allowDeselect={false}
                  value={shown.weaponId ?? null}
                  onChange={(value) => value !== null && update('weaponId', value)}
                  data={member.weapons}
                />
                <Select
                  size='xs'
                  w={64}
                  aria-label={`${member.name} ${refinementPrefix === 'R' ? 'refinement' : 'rank'}`}
                  allowDeselect={false}
                  disabled={!shown.weaponId}
                  value={String(shown.refinement)}
                  onChange={(value) => value !== null && update('refinement', Number(value))}
                  data={REFINEMENTS.map((r) => ({ value: String(r), label: `${refinementPrefix}${r}` }))}
                />
              </Group>
              {member.sets && (
                <Select
                  size='xs'
                  aria-label={`${member.name} 4-piece set`}
                  searchable
                  allowDeselect={false}
                  value={shown.fourPiece ?? NO_SET}
                  onChange={(value) => value !== null && update('fourPiece', value)}
                  data={[{ value: NO_SET, label: 'No 4-piece set' }, ...member.sets]}
                />
              )}
            </Stack>
          )
        })}
        <Group justify='flex-end'>
          <Button size='xs' variant='default' leftSection={<IconRefresh size={14} />} disabled={!edited} onClick={() => onChange({})}>
            Sync from roster
          </Button>
        </Group>
      </Stack>
    </FormCard>
  )
}
