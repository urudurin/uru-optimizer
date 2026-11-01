import stats from 'lib/games/genshin/data/generated/stats.json'
import type { GenshinImages } from 'lib/games/genshin/data/images'
import {
  GENSHIN_ROSTER_IDS,
  genshinRoster,
} from 'lib/games/genshin/state/roster'
import type { GenshinCharacter } from 'lib/games/genshin/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const images: GenshinImages = {
  characters: {},
  weapons: {},
  artifacts: {},
  characterInfo: { Xiangling: { name: 'Xiangling', element: 'Pyro', weaponType: 'Polearm', rarity: 4 } },
  weaponInfo: {},
}

describe('genshinRoster', () => {
  it('lists every character once, the Traveler once per element', () => {
    expect(GENSHIN_ROSTER_IDS).not.toContain('Traveler')
    expect(GENSHIN_ROSTER_IDS).toContain('TravelerDendro')
    expect(new Set(GENSHIN_ROSTER_IDS).size).toBe(GENSHIN_ROSTER_IDS.length)
    expect(GENSHIN_ROSTER_IDS.length).toBe(Object.keys(stats.characters).length - 1 + 7)
  })

  it('keeps saved characters and adds defaults for the rest', () => {
    const saved = { id: 'Xiangling', name: 'Xiangling', level: 80, constellation: 6, artifactIds: {}, stats: {}, statsDate: '' } as GenshinCharacter
    const roster = genshinRoster([saved], images)
    expect(roster[0]).toBe(saved)
    expect(roster.filter((c) => c.id === 'Xiangling')).toHaveLength(1)
    expect(roster).toHaveLength(GENSHIN_ROSTER_IDS.length)
    expect(roster.find((c) => c.id === 'TravelerPyro')).toMatchObject({ name: 'Traveler (Pyro)', element: 'Pyro', level: 90, constellation: 0 })
  })

  it('starts defaults with no weapon and no artifacts', () => {
    for (const character of genshinRoster([], images)) {
      expect(character.weapon).toBeUndefined()
      expect(character.artifactIds).toEqual({})
    }
  })
})
