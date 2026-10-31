import {
  moveToTop,
  orderByPriority,
  ranksAbove,
} from 'lib/games/shared/characterPriority'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('character priority', () => {
  const ids = ['amber', 'bennett', 'chongyun', 'diluc']

  it('orders ranked characters first, then the rest as saved', () => {
    expect(orderByPriority(ids, ['diluc', 'bennett'])).toEqual(['diluc', 'bennett', 'amber', 'chongyun'])
    expect(orderByPriority(ids, [])).toEqual(ids)
    // Ids no longer saved are ignored
    expect(orderByPriority(ids, ['xiao', 'chongyun'])).toEqual(['chongyun', 'amber', 'bennett', 'diluc'])
  })

  it('moves a character to the top and lists who ranks above, for the priority filter', () => {
    expect(moveToTop(ids, ['diluc', 'bennett'], 'chongyun')).toEqual(['chongyun', 'diluc', 'bennett', 'amber'])
    expect(ranksAbove(ids, ['diluc', 'bennett'], 'amber')).toEqual(['diluc', 'bennett'])
    expect(ranksAbove(ids, ['diluc', 'bennett'], 'diluc')).toEqual([])
    expect(ranksAbove(ids, [], 'xiao')).toEqual([])
  })
})
