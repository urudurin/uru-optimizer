import {
  gamePageHash,
  HOME_HASH,
  readGameHash,
} from 'lib/games/gameHash'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('readGameHash', () => {
  it('reads Home, game pages and HSR tabs', () => {
    expect(readGameHash(HOME_HASH)).toEqual({ kind: 'home' })
    expect(readGameHash(gamePageHash('genshin', 'characters'))).toEqual({ kind: 'game', game: 'genshin', page: 'characters' })
    expect(readGameHash('#zzz-discs')).toEqual({ kind: 'game', game: 'zzz', page: 'discs' })
    expect(readGameHash('#main')).toEqual({ kind: 'hsr' })
    expect(readGameHash('')).toEqual({ kind: 'hsr' })
  })

  it('ignores anything else', () => {
    expect(readGameHash('#hsr-optimizer')).toBeNull()
    expect(readGameHash('#elden-ring')).toBeNull()
    expect(readGameHash('#nonsense')).toBeNull()
  })
})
