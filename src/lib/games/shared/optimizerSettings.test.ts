import {
  mergeSettings,
  readOptimizerSettings,
} from 'lib/games/shared/optimizerSettings'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const defaults = { target: 'avg:atk', fourPieceSet: null as string | null, twoPieceSets: [] as string[], exclude: true, mins: {} as Record<string, number> }

describe('optimizer settings', () => {
  it('lays saved values of the right kind over the defaults', () => {
    const merged = mergeSettings(defaults, { target: 'cv', fourPieceSet: 'GladiatorsFinale', twoPieceSets: ['A'], mins: { er: 200 }, unknown: 1 })
    expect(merged).toEqual({ target: 'cv', fourPieceSet: 'GladiatorsFinale', twoPieceSets: ['A'], exclude: true, mins: { er: 200 } })
  })

  it('ignores saved values of the wrong kind, and clearing a choice back to null', () => {
    expect(mergeSettings(defaults, { target: 5, twoPieceSets: 'A', exclude: 'yes', mins: [] })).toEqual(defaults)
    expect(mergeSettings({ ...defaults, fourPieceSet: 'X' }, { fourPieceSet: null }).fourPieceSet).toBeNull()
    expect(mergeSettings(defaults, undefined)).toBe(defaults)
  })

  it('reads an empty or broken save as no settings', () => {
    // Tests run without a browser, so a Map stands in for localStorage
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
    localStorage.removeItem('test-optimizer-settings')
    expect(readOptimizerSettings('test-optimizer-settings')).toEqual({ byCharacter: {} })
    localStorage.setItem('test-optimizer-settings', 'not json')
    expect(readOptimizerSettings('test-optimizer-settings')).toEqual({ byCharacter: {} })
    localStorage.setItem('test-optimizer-settings', JSON.stringify({ last: 'Venti', byCharacter: { Venti: { target: 'cv' } } }))
    expect(readOptimizerSettings('test-optimizer-settings')).toEqual({ last: 'Venti', byCharacter: { Venti: { target: 'cv' } } })
    vi.unstubAllGlobals()
  })
})
