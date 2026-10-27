import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
} from '@mantine/core'
import stats from 'lib/games/genshin/data/generated/stats.json'
import type {
  GenshinImages,
  WeaponType,
} from 'lib/games/genshin/data/images'
import {
  nameFromGoodKey,
  travelerKey,
} from 'lib/games/genshin/goodKeys'
import type { GenshinCharacterDetails } from 'lib/games/genshin/state/genshinState'
import type { Element } from 'lib/games/genshin/types'
import { useState } from 'react'

const ELEMENTS: Element[] = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo']
export const WEAPON_RARITY: Record<string, number> = Object.fromEntries(Object.entries(stats.weapons).map(([id, weapon]) => [id, weapon.rarity]))

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i))

// Every weapon with stat data, best rarity first, grouped by type; only the character's type when it's known
export function weaponOptions(weaponInfo: GenshinImages['weaponInfo'], weaponType: WeaponType | undefined) {
  const groups = new Map<string, { value: string, label: string, rarity: number }[]>()
  for (const id of Object.keys(WEAPON_RARITY)) {
    const info = weaponInfo[id]
    if (weaponType && info?.weaponType && info.weaponType !== weaponType) continue
    const group = info?.weaponType ?? 'Other'
    const items = groups.get(group) ?? []
    items.push({ value: id, label: `${info?.name ?? nameFromGoodKey(id)} (${WEAPON_RARITY[id]}★)`, rarity: WEAPON_RARITY[id] })
    groups.set(group, items)
  }
  return [...groups].map(([group, items]) => ({
    group,
    items: items.sort((a, b) => b.rarity - a.rarity || a.label.localeCompare(b.label)).map(({ value, label }) => ({ value, label })),
  }))
}

// Level, constellation and weapon for a character added by hand (or a saved one, to change them). The Traveler also
// picks an element, which decides their GOOD key
export function CharacterForm({ initial, weaponInfo, weaponType, isTraveler, submitLabel, onSubmit, onCancel }: {
  initial: GenshinCharacterDetails,
  weaponInfo: GenshinImages['weaponInfo'],
  weaponType?: WeaponType,
  isTraveler?: boolean,
  submitLabel: string,
  onSubmit: (details: GenshinCharacterDetails) => void,
  onCancel?: () => void,
}) {
  const [details, setDetails] = useState(initial)
  const update = (changes: Partial<GenshinCharacterDetails>) => setDetails((prev) => ({ ...prev, ...changes }))
  const weapon = details.weapon
  const setWeapon = (changes: Partial<NonNullable<GenshinCharacterDetails['weapon']>>) => weapon && update({ weapon: { ...weapon, ...changes } })

  return (
    <Stack gap={8}>
      {isTraveler && (
        <Select
          size='xs'
          label='Element'
          allowDeselect={false}
          value={details.element ?? null}
          onChange={(value) => {
            const element = (value ?? undefined) as Element | undefined
            update({ element, id: travelerKey(element), name: `Traveler${element ? ` (${element})` : ''}` })
          }}
          data={ELEMENTS}
        />
      )}
      <Group grow gap={8}>
        <NumberInput size='xs' label='Level' min={1} max={100} value={details.level} onChange={(value) => update({ level: Number(value) || 1 })} />
        <Select
          size='xs'
          label='Constellation'
          allowDeselect={false}
          value={String(details.constellation)}
          onChange={(value) => update({ constellation: Number(value ?? 0) })}
          data={range(0, 6).map((value) => ({ value, label: `C${value}` }))}
        />
      </Group>
      <Select
        size='xs'
        label='Weapon'
        placeholder='No weapon'
        searchable
        clearable
        value={weapon?.id ?? null}
        onChange={(id) =>
          update({
            weapon: id
              ? {
                id,
                name: weaponInfo[id]?.name ?? nameFromGoodKey(id),
                rarity: WEAPON_RARITY[id] ?? 5,
                level: weapon?.level ?? 90,
                refinement: weapon?.refinement ?? 1,
              }
              : undefined,
          })}
        data={weaponOptions(weaponInfo, weaponType)}
      />
      <Group grow gap={8}>
        <NumberInput
          size='xs'
          label='Weapon level'
          min={1}
          max={90}
          disabled={!weapon}
          value={weapon?.level ?? 90}
          onChange={(value) => setWeapon({ level: Number(value) || 1, ascension: undefined })}
        />
        <Select
          size='xs'
          label='Refinement'
          allowDeselect={false}
          disabled={!weapon}
          value={String(weapon?.refinement ?? 1)}
          onChange={(value) => setWeapon({ refinement: Number(value ?? 1) })}
          data={range(1, 5).map((value) => ({ value, label: `R${value}` }))}
        />
      </Group>
      <Group gap={8}>
        <Button size='xs' disabled={isTraveler && !details.element} onClick={() => onSubmit(details)}>{submitLabel}</Button>
        {onCancel && <Button size='xs' variant='subtle' onClick={onCancel}>Cancel</Button>}
      </Group>
    </Stack>
  )
}
