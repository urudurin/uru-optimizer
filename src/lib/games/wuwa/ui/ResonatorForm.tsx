import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
} from '@mantine/core'
import { WEAPONS } from 'lib/games/wuwa/data/gameData'
import type { CharacterState } from 'lib/games/wuwa/types'
import { useState } from 'react'

// The datamine's weapon types
export const WEAPON_TYPES: Record<number, string> = { 1: 'Broadblade', 2: 'Sword', 3: 'Pistols', 4: 'Gauntlets', 5: 'Rectifier' }

// Every weapon, grouped by type. The datamine doesn't say which type a Resonator uses, so all of them are offered
const WEAPON_OPTIONS = Object.entries(WEAPON_TYPES).map(([type, group]) => ({
  group,
  items: Object.values(WEAPONS)
    .filter((weapon) => weapon.weaponType === Number(type))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((weapon) => ({ value: weapon.id, label: weapon.name })),
}))

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i))

export type ResonatorDetails = Omit<CharacterState, 'echoIds'>

// Level, sequence and weapon for a Resonator added by hand (or one already saved, to change them)
export function ResonatorForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: ResonatorDetails,
  submitLabel: string,
  onSubmit: (details: ResonatorDetails) => void,
  onCancel?: () => void,
}) {
  const [details, setDetails] = useState(initial)
  const update = (changes: Partial<ResonatorDetails>) => setDetails((prev) => ({ ...prev, ...changes }))

  return (
    <Stack gap={8}>
      <Group grow gap={8}>
        <NumberInput size='xs' label='Level' min={1} max={90} value={details.level} onChange={(value) => update({ level: Number(value) || 1 })} />
        <Select
          size='xs'
          label='Sequence'
          allowDeselect={false}
          value={String(details.sequence)}
          onChange={(value) => update({ sequence: Number(value ?? 0) })}
          data={range(0, 6).map((value) => ({ value, label: `S${value}` }))}
        />
      </Group>
      <Select
        size='xs'
        label='Weapon'
        placeholder='No weapon'
        searchable
        clearable
        value={details.weaponId ?? null}
        onChange={(value) => update({ weaponId: value ?? undefined })}
        data={WEAPON_OPTIONS}
      />
      <Group grow gap={8}>
        <NumberInput
          size='xs'
          label='Weapon level'
          min={1}
          max={90}
          disabled={!details.weaponId}
          value={details.weaponLevel}
          onChange={(value) => update({ weaponLevel: Number(value) || 1 })}
        />
        <Select
          size='xs'
          label='Rank'
          allowDeselect={false}
          disabled={!details.weaponId}
          value={String(details.refinement)}
          onChange={(value) => update({ refinement: Number(value ?? 1) })}
          data={range(1, 5).map((value) => ({ value, label: `R${value}` }))}
        />
      </Group>
      <Switch
        size='xs'
        label='Minor fortes unlocked'
        checked={details.minorFortes}
        onChange={(event) => update({ minorFortes: event.currentTarget.checked })}
      />
      <Group gap={8}>
        <Button size='xs' onClick={() => onSubmit(details)}>{submitLabel}</Button>
        {onCancel && <Button size='xs' variant='subtle' onClick={onCancel}>Cancel</Button>}
      </Group>
    </Stack>
  )
}
