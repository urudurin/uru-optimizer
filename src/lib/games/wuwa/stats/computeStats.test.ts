import {
  atLevel,
  computeWuwaStats,
  setPieceCounts,
  toDisplayStats,
} from 'lib/games/wuwa/stats/computeStats'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

// Hsin's real build, read from the user's in-game screenshots (2026-10-25)
const SET = 'heart-of-sworn-vigil'
const HSIN_ECHOES: Echo[] = [
  {
    id: 'e1',
    defId: 'reminiscence-suhsin-the-inevitable',
    cost: 4,
    setId: SET,
    mainStat: 'critRate',
    level: 25,
    substats: [
      { stat: 'skillDmg', value: 9.4 },
      { stat: 'defFlat', value: 60 },
      { stat: 'critRate', value: 9.3 },
      { stat: 'basicDmg', value: 7.9 },
      { stat: 'energyRegen', value: 8.4 },
    ],
  },
  {
    id: 'e2',
    defId: 'formrender',
    cost: 3,
    setId: SET,
    mainStat: 'electroDmg',
    level: 25,
    substats: [
      { stat: 'critDmg', value: 13.8 },
      { stat: 'defPct', value: 10.9 },
      { stat: 'skillDmg', value: 10.1 },
      { stat: 'critRate', value: 6.3 },
      { stat: 'atkPct', value: 8.6 },
    ],
  },
  {
    id: 'e3',
    defId: 'soulfrayer',
    cost: 3,
    setId: SET,
    mainStat: 'electroDmg',
    level: 25,
    substats: [
      { stat: 'skillDmg', value: 8.6 },
      { stat: 'atkPct', value: 8.6 },
      { stat: 'critDmg', value: 13.8 },
      { stat: 'libDmg', value: 10.9 },
      { stat: 'energyRegen', value: 10.0 },
    ],
  },
  {
    id: 'e4',
    defId: 'bloomburst-puppet',
    cost: 1,
    setId: SET,
    mainStat: 'atkPct',
    level: 25,
    substats: [
      { stat: 'critDmg', value: 15.0 },
      { stat: 'skillDmg', value: 8.6 },
      { stat: 'atkPct', value: 7.9 },
      { stat: 'critRate', value: 6.9 },
      { stat: 'hpFlat', value: 540 },
    ],
  },
  {
    id: 'e5',
    defId: 'jade-nether-serpent',
    cost: 1,
    setId: SET,
    mainStat: 'atkPct',
    level: 25,
    substats: [
      { stat: 'energyRegen', value: 11.6 },
      { stat: 'critDmg', value: 16.2 },
      { stat: 'skillDmg', value: 7.1 },
      { stat: 'atkPct', value: 8.6 },
      { stat: 'critRate', value: 6.3 },
    ],
  },
]

const HSIN: CharacterState = {
  charId: 'hsin',
  level: 90,
  sequence: 0,
  weaponId: 'blooming-jadehaven',
  weaponLevel: 90,
  refinement: 1,
  minorFortes: true,
  echoIds: HSIN_ECHOES.map((echo) => echo.id),
}

describe('computeWuwaStats for Hsin', () => {
  it('matches HP, DEF, Crit Rate, Crit DMG and Energy Regen on the stat screen (screenshot)', () => {
    const result = computeWuwaStats(HSIN, HSIN_ECHOES)
    const shown = toDisplayStats(result.stats)

    expect(result.warnings).toEqual([])
    expect(shown.hp).toBe(15400)
    expect(shown.def).toBe(1293)
    expect(shown.critRate).toBe(88.1)
    expect(shown.critDmg).toBe(208.8)
    expect(shown.energyRegen).toBe(130)
  })

  it('comes out 2 ATK above the stat screen, a known open gap', () => {
    // Screen: 2255. (462.5 + 587.5) x (1 + 81.7%) + 350 = 2257.85. Likely the game's real ATK% roll values are a little
    // below the one-decimal values it shows. Unverified until another character's screen narrows it down
    expect(toDisplayStats(computeWuwaStats(HSIN, HSIN_ECHOES).stats).atk).toBe(2257)
  })

  it('counts the element, set and DMG bonuses that are not on the overview screen', () => {
    const shown = toDisplayStats(computeWuwaStats(HSIN, HSIN_ECHOES).stats)

    // 30 + 30 from the 3-cost main stats and 10 from the 2-piece. The weapon's 12% All-Attribute DMG isn't counted yet
    expect(shown.elementDmg).toBe(70)
    expect(shown.skillDmg).toBe(43.8)
    expect(shown.basicDmg).toBe(7.9)
    expect(shown.libDmg).toBe(10.9)
  })

  it('leaves out minor fortes when they are locked', () => {
    const locked = toDisplayStats(computeWuwaStats({ ...HSIN, minorFortes: false }, HSIN_ECHOES).stats)

    expect(locked.critRate).toBe(80.1)
  })

  it('warns about characters, weapons and sets it has no data for', () => {
    const unknown = { ...HSIN, charId: 'someone-new', weaponId: 'new-blade' }
    const echoes = HSIN_ECHOES.map((echo) => ({ ...echo, setId: 'new-set' }))

    expect(computeWuwaStats(unknown, echoes).warnings).toEqual([
      'No base stats for someone-new in the game data, HP, ATK and DEF are missing their base',
      'No element or minor forte data for someone-new yet, those bonuses are left out',
      'No data for weapon new-blade, its ATK and secondary stat are left out',
      'No data for sonata set new-set, its bonuses are left out',
    ])
  })
})

describe('helpers', () => {
  it('interpolates between listed levels and clamps outside them', () => {
    const table = { 1: 10, 20: 48, 90: 188 }
    expect(atLevel(table, 1)).toBe(10)
    expect(atLevel(table, 10)).toBe(28)
    expect(atLevel(table, 95)).toBe(188)
  })

  it('counts distinct echoes per set', () => {
    const [a, b] = HSIN_ECHOES
    expect(setPieceCounts([a, b, { ...b, id: 'copy' }])).toEqual(new Map([[SET, 2]]))
  })
})
