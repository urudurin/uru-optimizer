import {
  avgRollPct,
  isValidMainStat,
  mainStatValue,
  maxRoll,
  secondaryMainValue,
  SUBSTAT_TIERS,
  tierOf,
} from 'lib/games/wuwa/echoStats'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('main stats', () => {
  it('gives max values at +25', () => {
    expect(mainStatValue(4, 'critRate', 25)).toBe(22)
    expect(secondaryMainValue(3, 25)).toBe(100)
    expect(secondaryMainValue(1, 25)).toBe(2280)
  })

  it('starts at 20% of max at +0', () => {
    expect(mainStatValue(4, 'critRate', 0)).toBeCloseTo(4.4, 6)
  })

  it('only allows the main stats each cost can roll', () => {
    expect(isValidMainStat(4, 'critDmg')).toBe(true)
    expect(isValidMainStat(3, 'havocDmg')).toBe(true)
    expect(isValidMainStat(3, 'critRate')).toBe(false)
    expect(isValidMainStat(1, 'energyRegen')).toBe(false)
  })
})

describe('substat tiers', () => {
  it('has the known tier values', () => {
    expect(SUBSTAT_TIERS.critRate).toEqual([6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5])
    expect(SUBSTAT_TIERS.atkFlat).toEqual([30, 40, 50, 60])
    expect(Object.keys(SUBSTAT_TIERS)).toHaveLength(13)
    expect(maxRoll('critDmg')).toBe(21)
  })

  it('finds the tier of a real roll value, tolerating float noise', () => {
    expect(tierOf('critRate', 9.9)).toBe(7)
    expect(tierOf('atkFlat', 50)).toBe(3)
    expect(tierOf('critRate', 9.900000001)).toBe(7)
  })

  it('rejects values that are not real rolls', () => {
    expect(tierOf('critRate', 9.0)).toBeUndefined()
  })

  it('averages tier values as a fraction of the max roll', () => {
    expect(avgRollPct('critRate')).toBeCloseTo(0.8, 6)
    expect(avgRollPct('atkPct')).toBeCloseTo(0.775862, 5)
  })
})
