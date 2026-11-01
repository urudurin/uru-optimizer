import type { MantineSize } from '@mantine/core'
import {
  type CardOption,
  CardSelect,
  rarityFilter,
  tagFilter,
} from 'lib/games/shared/ui/CardSelect'
import {
  characterName,
  CHARACTERS,
  WEAPON_TYPES,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import type { ResonatorArt } from 'lib/games/wuwa/data/userArt'
import type { CharacterState } from 'lib/games/wuwa/types'
import { elementName } from 'lib/games/wuwa/ui/EchoCard'
import { useMemo } from 'react'

// WuWa Resonator and weapon pickers on HSR's card-grid window (shared/ui/CardSelect.tsx). Resonator art is whatever the
// user saved (data/userArt.ts); weapons have none, so their cards show names only

const WEAPON_ORDER = Object.values(WEAPON_TYPES)

export function WuwaCharacterSelect({ characters, art, value, onChange, label }: {
  characters: CharacterState[],
  art: Record<string, ResonatorArt>,
  value: string,
  onChange: (charId: string) => void,
  label?: string,
}) {
  const options = useMemo<CardOption[]>(() =>
    characters.map((c) => {
      const data = CHARACTERS[c.charId]
      return {
        id: c.charId,
        label: characterName(c.charId),
        rarity: data?.rarity ?? 4,
        image: art[c.charId]?.icon ?? art[c.charId]?.portrait,
        tags: { element: data?.element ? elementName(data.element) : '', weaponType: WEAPON_TYPES[data?.weaponType ?? 0] ?? '' },
      }
    }), [characters, art])
  const filters = useMemo(() => [tagFilter('element', options), tagFilter('weaponType', options, WEAPON_ORDER), rarityFilter([5, 4])], [options])
  return (
    <CardSelect
      wide
      label={label}
      title='Select a Resonator'
      value={value}
      options={options}
      filters={filters}
      onChange={(id) => id && onChange(id)}
    />
  )
}

// Weapons of the Resonator's type (all of them when it isn't known); clearing it leaves them with no weapon
export function WuwaWeaponSelect({ weaponType, value, onChange, label = 'Weapon', size }: {
  weaponType: number | null | undefined,
  value: string | null,
  onChange: (id: string | null) => void,
  label?: string,
  size?: MantineSize,
}) {
  const options = useMemo<CardOption[]>(() =>
    Object.values(WEAPONS)
      .filter((w) => weaponType == null || w.weaponType === weaponType)
      .map((w) => ({ id: w.id, label: w.name, rarity: w.rarity ?? 0, tags: { weaponType: WEAPON_TYPES[w.weaponType] ?? '' } }))
      .sort((a, b) => a.label.localeCompare(b.label)), [weaponType])
  const filters = useMemo(
    () => [...(weaponType == null ? [tagFilter('weaponType', options, WEAPON_ORDER)] : []), rarityFilter()],
    [options, weaponType],
  )
  return (
    <CardSelect
      size={size}
      label={label}
      title='Select a weapon'
      placeholder='No weapon'
      clearable
      value={value}
      options={options}
      filters={filters}
      onChange={onChange}
    />
  )
}
