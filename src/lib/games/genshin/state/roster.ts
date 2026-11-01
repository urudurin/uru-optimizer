import stats from 'lib/games/genshin/data/generated/stats.json'
import type { GenshinImages } from 'lib/games/genshin/data/images'
import {
  nameFromGoodKey,
  travelerKey,
} from 'lib/games/genshin/goodKeys'
import type {
  Element,
  GenshinCharacter,
} from 'lib/games/genshin/types'

// Every character is available without adding them first, like HSR: characters not in the save get a default build
// (level 90, C0, no weapon and no artifacts). Changing one (weapon, constellation, Equip...) saves them as usual.

const TRAVELER_ELEMENTS: Element[] = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo']

// Every character with stat data; the Traveler once per element, like HSR's Trailblazer paths
export const GENSHIN_ROSTER_IDS: string[] = [
  ...Object.keys(stats.characters).filter((id) => id !== 'Traveler'),
  ...TRAVELER_ELEMENTS.map(travelerKey),
]

export function defaultGenshinCharacter(id: string, images: GenshinImages): GenshinCharacter {
  const traveler = id.startsWith('Traveler')
  const element = traveler ? id.slice('Traveler'.length) as Element : images.characterInfo[id]?.element
  return {
    id,
    name: traveler ? `Traveler (${element})` : images.characterInfo[id]?.name ?? nameFromGoodKey(id),
    element,
    level: 90,
    constellation: 0,
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
