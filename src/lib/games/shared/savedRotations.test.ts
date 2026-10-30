import {
  deleteRotation,
  MAX_SAVED_ROTATIONS,
  savedRotations,
  saveRotation,
} from 'lib/games/shared/savedRotations'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

describe('saved rotations', () => {
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

  it('saves by name per game and character, newest first, the same name replacing the old one', () => {
    saveRotation('zzz', '1091', 'Burst', { counts: { a: 1 } })
    saveRotation('zzz', '1091', 'Full cycle', { counts: { a: 3, b: 2 } })
    saveRotation('zzz', '1091', 'Burst', { counts: { a: 2 } })
    expect(savedRotations('zzz', '1091')).toEqual([
      { name: 'Burst', rotation: { counts: { a: 2 } } },
      { name: 'Full cycle', rotation: { counts: { a: 3, b: 2 } } },
    ])
    expect(savedRotations('zzz', '1431')).toEqual([])
    expect(savedRotations('wuwa', '1091')).toEqual([])
  })

  it('deletes, keeps at most a dozen, and reads a broken save as none', () => {
    for (let i = 0; i < MAX_SAVED_ROTATIONS + 3; i++) saveRotation('genshin', 'Xiangling', `R${i}`, { counts: {} })
    expect(savedRotations('genshin', 'Xiangling')).toHaveLength(MAX_SAVED_ROTATIONS)
    expect(deleteRotation('genshin', 'Xiangling', 'R14').map((r) => r.name)).not.toContain('R14')
    localStorage.setItem('wuwa-saved-rotations', 'not json')
    expect(savedRotations('wuwa', 'hsin')).toEqual([])
  })
})
