import type { MantineSize } from '@mantine/core'
import stats from 'lib/games/genshin/data/generated/stats.json'
import type {
  GenshinImages,
  WeaponType,
} from 'lib/games/genshin/data/images'
import { nameFromGoodKey } from 'lib/games/genshin/goodKeys'
import type { GenshinCharacter } from 'lib/games/genshin/types'
import {
  type CardOption,
  CardSelect,
  rarityFilter,
  tagFilter,
} from 'lib/games/shared/ui/CardSelect'
import { useMemo } from 'react'

// Genshin character and weapon pickers on HSR's card-grid window (shared/ui/CardSelect.tsx)

const WEAPON_RARITY: Record<string, number> = Object.fromEntries(Object.entries(stats.weapons).map(([id, weapon]) => [id, weapon.rarity]))

const ELEMENT_ORDER = ['Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo']
const WEAPON_ORDER = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst']

// Enka keys every Traveler as one character
const baseId = (id: string) => (id.startsWith('Traveler') ? 'Traveler' : id)

export function GenshinCharacterSelect({ characters, images, value, onChange, label }: {
  characters: GenshinCharacter[],
  images: GenshinImages,
  value: string,
  onChange: (id: string) => void,
  label?: string,
}) {
  const options = useMemo<CardOption[]>(() =>
    characters.map((c) => {
      const info = images.characterInfo[baseId(c.id)] ?? images.characterInfo[c.id]
      return {
        id: c.id,
        label: c.name,
        rarity: info?.rarity ?? 4,
        image: images.characters[baseId(c.id)]?.icon ?? images.characters[c.id]?.icon,
        tags: { element: c.element ?? info?.element ?? '', weaponType: info?.weaponType ?? '' },
      }
    }), [characters, images])
  const filters = useMemo(
    () => [tagFilter('element', options, ELEMENT_ORDER), tagFilter('weaponType', options, WEAPON_ORDER), rarityFilter([5, 4])],
    [options],
  )
  return (
    <CardSelect
      wide
      label={label}
      title='Select a character'
      value={value}
      options={options}
      filters={filters}
      onChange={(id) => id && onChange(id)}
    />
  )
}

// Weapons of one type (all of them while the type isn't known); clearing it leaves the character with no weapon
export function GenshinWeaponSelect({ images, weaponType, value, onChange, label = 'Weapon', size }: {
  images: GenshinImages,
  weaponType: WeaponType | undefined,
  value: string | null,
  onChange: (id: string | null) => void,
  label?: string,
  size?: MantineSize,
}) {
  const options = useMemo<CardOption[]>(() =>
    Object.keys(WEAPON_RARITY)
      .filter((id) => !weaponType || !images.weaponInfo[id]?.weaponType || images.weaponInfo[id]?.weaponType === weaponType)
      .map((id) => ({
        id,
        label: images.weaponInfo[id]?.name ?? nameFromGoodKey(id),
        rarity: WEAPON_RARITY[id],
        image: images.weapons[id],
        tags: { weaponType: images.weaponInfo[id]?.weaponType ?? '' },
      }))
      .sort((a, b) => a.label.localeCompare(b.label)), [images, weaponType])
  const filters = useMemo(
    () => [...(weaponType ? [] : [tagFilter('weaponType', options, WEAPON_ORDER)]), rarityFilter()],
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
