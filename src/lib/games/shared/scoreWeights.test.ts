import {
  saveWeightOverrides,
  weightOverrides,
  withWeightOverrides,
} from 'lib/games/shared/scoreWeights'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

describe('scoring weights', () => {
  beforeEach(() => {
    // Tests run without a browser, so a Map stands in for localStorage
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('puts a character\'s own weights over the defaults, per game, and resets them', () => {
    const defaults = { critRate: 1, critDmg: 1, atkPct: 0.75, hp: 0 }
    expect(withWeightOverrides('genshin', 'Nefer', defaults)).toBe(defaults)
    saveWeightOverrides('genshin', 'Nefer', { ...defaults, atkPct: 0, elementalMastery: 1 })
    expect(withWeightOverrides('genshin', 'Nefer', defaults)).toEqual({ critRate: 1, critDmg: 1, atkPct: 0, hp: 0, elementalMastery: 1 })
    expect(weightOverrides('wuwa', 'Nefer')).toBeUndefined()
    expect(weightOverrides('genshin', 'Lauma')).toBeUndefined()
    saveWeightOverrides('genshin', 'Nefer', undefined)
    expect(weightOverrides('genshin', 'Nefer')).toBeUndefined()
  })

  it('skips anything that isn\'t a weight', () => {
    localStorage.setItem('zzz-score-weights', JSON.stringify({ 1091: { 'CRIT Rate': 1, 'ATK%': 'lots', 'PEN': -1 } }))
    expect(weightOverrides('zzz', '1091')).toEqual({ 'CRIT Rate': 1 })
    localStorage.setItem('zzz-score-weights', 'not json')
    expect(weightOverrides('zzz', '1091')).toBeUndefined()
  })
})
