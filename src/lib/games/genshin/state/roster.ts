import stats from 'lib/games/genshin/data/generated/stats.json'
import type {
  GenshinImages,
  WeaponType,
} from 'lib/games/genshin/data/images'
import {
  nameFromGoodKey,
  travelerKey,
} from 'lib/games/genshin/goodKeys'
import { weaponBaseAtk } from 'lib/games/genshin/stats/computeStats'
import type {
  Element,
  GenshinCharacter,
  GenshinWeapon,
} from 'lib/games/genshin/types'

// Every character is available without adding them first, like HSR: characters not in the save get a default build
// (level 90, C0, the best weapon of their type at R1). Changing one (weapon, constellation, Equip...) saves them as usual.

const TRAVELER_ELEMENTS: Element[] = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo']

// Every character with stat data; the Traveler once per element, like HSR's Trailblazer paths
export const GENSHIN_ROSTER_IDS: string[] = [
  ...Object.keys(stats.characters).filter((id) => id !== 'Traveler'),
  ...TRAVELER_ELEMENTS.map(travelerKey),
]

const WEAPON_LEVEL = 90

// The highest-rarity weapon of the type with the most base ATK at level 90
export function bestGenshinWeapon(weaponType: WeaponType | undefined, images: GenshinImages): GenshinWeapon | undefined {
  if (!weaponType) return undefined
  let best: { id: string, rarity: number, atk: number } | undefined
  for (const [id, weapon] of Object.entries(stats.weapons)) {
    if (images.weaponInfo[id]?.weaponType !== weaponType) continue
    const atk = weaponBaseAtk(id, WEAPON_LEVEL) ?? 0
    if (!best || weapon.rarity > best.rarity || (weapon.rarity === best.rarity && atk > best.atk)) best = { id, rarity: weapon.rarity, atk }
  }
  return best && { id: best.id, name: images.weaponInfo[best.id]?.name ?? nameFromGoodKey(best.id), rarity: best.rarity, level: WEAPON_LEVEL, refinement: 1 }
}

export function defaultGenshinCharacter(id: string, images: GenshinImages): GenshinCharacter {
  const traveler = id.startsWith('Traveler')
  const info = images.characterInfo[traveler ? 'Traveler' : id] ?? images.characterInfo[id]
  return {
    id,
    name: traveler ? `Traveler (${id.slice('Traveler'.length)})` : info?.name ?? nameFromGoodKey(id),
    element: traveler ? id.slice('Traveler'.length) as Element : info?.element,
    level: 90,
    constellation: 0,
    weapon: bestGenshinWeapon(traveler ? 'Sword' : info?.weaponType, images),
    artifactIds: {},
    stats: {},
    statsDate: '',
  }
}

// The saved characters, then a default one for everyone else by name
export function genshinRoster(saved: GenshinCharacter[], images: GenshinImages): GenshinCharacter[] {
  const have = new Set(saved.map((c) => c.id))
  const others = GENSHIN_ROSTER_IDS.filter((id) => !have.has(id)).map((id) => defaultGenshinCharacter(id, images))
  return [...saved, ...others.sort((a, b) => a.name.localeCompare(b.name))]
}
