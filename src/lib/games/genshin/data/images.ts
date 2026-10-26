import { toGoodKey } from 'lib/games/genshin/goodKeys'
import { ELEMENTS } from 'lib/games/genshin/importer/enkaParser'
import type {
  ArtifactSlot,
  Element,
} from 'lib/games/genshin/types'
import {
  ENKA_ORIGIN_URL,
  enkaStoreLoader,
} from 'lib/games/shared/enka'
import {
  useEffect,
  useState,
} from 'react'

// Character, weapon and artifact art from Enka.Network, like zzz/data/images.ts, plus every character's and weapon's
// name, element and weapon type from the same store files (for the Characters page roster and its add form). Enka's Genshin store files name each
// image and enka.network serves it as /ui/<name>.png (API docs: "Icons and Images"). Loaded when the page is viewed,
// never copied into this repo. Personal, non-commercial use; the art belongs to HoYoverse.

export type CharacterArt = {
  // Wish splash art, around 1.3 MB: only the showcase card loads it
  portrait: string,
  // Square face icon, around 40 KB: roster banners and round icons
  icon: string,
}

export type WeaponType = 'Sword' | 'Claymore' | 'Bow' | 'Polearm' | 'Catalyst'

export type GenshinImages = {
  // By GOOD key; every Traveler element shares one Traveler's art
  characters: Record<string, CharacterArt>,
  weapons: Record<string, string>,
  // By GOOD set key, then slot
  artifacts: Record<string, Partial<Record<ArtifactSlot, string>>>,
  // By GOOD key: names, elements and weapon types (the Traveler under 'Traveler')
  characterInfo: Record<string, { name: string, element?: Element, weaponType?: WeaponType }>,
  weaponInfo: Record<string, { name: string, weaponType?: WeaponType }>,
}

type AvatarEntry = { NameTextMapHash?: number | string, SideIconName?: string, Element?: string, WeaponType?: string }
type WeaponEntry = { NameTextMapHash?: number | string, Icon?: string, WeaponType?: number }

const AVATAR_WEAPON_TYPES: Record<string, WeaponType> = {
  WEAPON_SWORD_ONE_HAND: 'Sword',
  WEAPON_CLAYMORE: 'Claymore',
  WEAPON_BOW: 'Bow',
  WEAPON_POLE: 'Polearm',
  WEAPON_CATALYST: 'Catalyst',
}
const WEAPON_TYPES: Record<number, WeaponType> = { 1: 'Sword', 2: 'Claymore', 3: 'Bow', 4: 'Polearm', 5: 'Catalyst' }
type RelicItem = { EquipType?: number, Icon?: string, SetId?: number }
type RelicSet = { Name?: number | string }

// relics.json EquipType order
const EQUIP_SLOTS: ArtifactSlot[] = ['flower', 'plume', 'sands', 'goblet', 'circlet']

const TRAVELER_AVATAR_ID = '10000007'

const url = (path: string) => `${ENKA_ORIGIN_URL}${path}`

// "/ui/UI_AvatarIcon_Side_Ayaka.png" -> "Ayaka"
function iconBase(sideIcon: string): string | undefined {
  return /UI_AvatarIcon_Side_(.+)\.png$/.exec(sideIcon)?.[1]
}

export const loadGenshinImages = enkaStoreLoader(
  ['gi/avatars.json', 'gi/weapons.json', 'gi/relics.json', 'gi/locs.json'],
  ([avatars, weapons, relics, locs]): GenshinImages => {
    const names = (locs as Record<string, Record<string, string>>).en ?? {}
    const characters: Record<string, CharacterArt> = {}
    const characterInfo: GenshinImages['characterInfo'] = {}
    let traveler: CharacterArt | undefined
    for (const [id, entry] of Object.entries(avatars as Record<string, AvatarEntry>)) {
      if (id.includes('-')) continue
      const weaponType = entry.WeaponType ? AVATAR_WEAPON_TYPES[entry.WeaponType] : undefined
      if (id === TRAVELER_AVATAR_ID) characterInfo.Traveler = { name: 'Traveler', weaponType }
      const base = entry.SideIconName ? iconBase(entry.SideIconName) : undefined
      if (!base) continue
      const art = { portrait: url(`/ui/UI_Gacha_AvatarImg_${base}.png`), icon: url(`/ui/UI_AvatarIcon_${base}.png`) }
      if (id === TRAVELER_AVATAR_ID) traveler = art
      const name = entry.NameTextMapHash !== undefined ? names[String(entry.NameTextMapHash)] : undefined
      if (name && id !== TRAVELER_AVATAR_ID && id !== '10000005') {
        characters[toGoodKey(name)] = art
        characterInfo[toGoodKey(name)] = { name, element: entry.Element ? ELEMENTS[entry.Element] : undefined, weaponType }
      }
    }
    if (traveler) {
      for (const element of ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo', '']) characters[`Traveler${element}`] = traveler
    }

    const weaponArt: Record<string, string> = {}
    const weaponInfo: GenshinImages['weaponInfo'] = {}
    for (const entry of Object.values(weapons as Record<string, WeaponEntry>)) {
      const name = entry.NameTextMapHash !== undefined ? names[String(entry.NameTextMapHash)] : undefined
      if (name && entry.Icon) weaponArt[toGoodKey(name)] = url(entry.Icon)
      if (name) weaponInfo[toGoodKey(name)] = { name, weaponType: entry.WeaponType ? WEAPON_TYPES[entry.WeaponType] : undefined }
    }

    const { Items = {}, Sets = {} } = relics as { Items?: Record<string, RelicItem>, Sets?: Record<string, RelicSet> }
    const artifacts: GenshinImages['artifacts'] = {}
    for (const item of Object.values(Items)) {
      const set = item.SetId ? Sets[String(item.SetId)] : undefined
      const name = set?.Name !== undefined ? names[String(set.Name)] : undefined
      const slot = item.EquipType !== undefined ? EQUIP_SLOTS[item.EquipType] : undefined
      if (!name || !slot || !item.Icon) continue
      const pieces = artifacts[toGoodKey(name)] ??= {}
      pieces[slot] ??= url(item.Icon)
    }
    return { characters, weapons: weaponArt, artifacts, characterInfo, weaponInfo }
  },
)

const EMPTY: GenshinImages = { characters: {}, weapons: {}, artifacts: {}, characterInfo: {}, weaponInfo: {} }

// The images once loaded; empty maps until then, or when Enka can't be reached (pages show initials instead)
export function useGenshinImages(): GenshinImages {
  const [images, setImages] = useState<GenshinImages>(EMPTY)
  useEffect(() => {
    let live = true
    void loadGenshinImages().then((result) => {
      if (live && result.ok) setImages(result.data)
    })
    return () => {
      live = false
    }
  }, [])
  return images
}
