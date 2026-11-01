import {
  fourPieceSetsOf,
  keepOverridesFor,
  NO_SET,
  resolveTeammate,
  setOverride,
  teammateFourPieces,
  type TeammateRoster,
} from 'lib/games/shared/teammateOverrides'
import {
  describe,
  expect,
  it,
} from 'vitest'

const roster: TeammateRoster = { rank: 1, weaponId: 'sword', refinement: 3, fourPiece: 'noblesse' }

describe('setOverride', () => {
  it('keeps only fields that differ from the roster', () => {
    const one = setOverride({}, 'bennett', 'rank', 6, roster)
    expect(one).toEqual({ bennett: { rank: 6 } })
    expect(setOverride(one, 'bennett', 'rank', 1, roster)).toEqual({})
  })

  it('starts a new weapon at R1 and forgets the refinement when the roster weapon comes back', () => {
    const changed = setOverride({}, 'bennett', 'weaponId', 'tales', roster)
    expect(changed).toEqual({ bennett: { weaponId: 'tales', refinement: 1 } })
    expect(setOverride(changed, 'bennett', 'weaponId', 'sword', { ...roster, refinement: 1 })).toEqual({})
  })

  it('treats no 4-piece as its own choice', () => {
    expect(setOverride({}, 'bennett', 'fourPiece', NO_SET, roster)).toEqual({ bennett: { fourPiece: NO_SET } })
    expect(setOverride({}, 'bennett', 'fourPiece', NO_SET, { ...roster, fourPiece: undefined })).toEqual({})
  })
})

describe('resolveTeammate', () => {
  it('fills what the override leaves out from the roster', () => {
    expect(resolveTeammate(roster, undefined)).toBe(roster)
    expect(resolveTeammate(roster, { rank: 6 })).toEqual({ ...roster, rank: 6 })
    expect(resolveTeammate(roster, { weaponId: 'tales' })).toEqual({ ...roster, weaponId: 'tales', refinement: 1 })
  })
})

describe('4-piece sets', () => {
  it('counts whole sets and lets the override replace them', () => {
    expect(fourPieceSetsOf(['a', 'a', 'a', 'a', 'b'])).toEqual(['a'])
    expect(teammateFourPieces(['a'], undefined)).toEqual(['a'])
    expect(teammateFourPieces(['a'], { fourPiece: 'c' })).toEqual(['c'])
    expect(teammateFourPieces(['a'], { fourPiece: NO_SET })).toEqual([])
  })
})

it('forgets overrides for removed teammates', () => {
  expect(keepOverridesFor({ a: { rank: 1 }, b: { rank: 2 } }, ['b'])).toEqual({ b: { rank: 2 } })
})
