import {
  cleanupRows,
  fodder,
  levelNext,
} from 'lib/games/shared/gearCleanup'
import {
  describe,
  expect,
  it,
} from 'vitest'

type Piece = { id: string, level: number, worn?: string, scores: Record<string, number> }

const pieces: Piece[] = [
  { id: 'junk', level: 15, scores: { a: 10, b: 20 } },
  { id: 'worn-junk', level: 15, worn: 'a', scores: { a: 5 } },
  { id: 'good-for-b', level: 9, scores: { a: 25, b: 70 } },
  { id: 'unscored', level: 15, scores: {} },
  { id: 'ok-unfinished', level: 3, scores: { a: 40 } },
]

const rows = cleanupRows(
  pieces,
  [{ id: 'a', name: 'Agent A' }, { id: 'b', name: 'Agent B' }],
  (piece, id) => piece.scores[id] === undefined ? undefined : { percent: piece.scores[id], rating: 'X' },
  { equipped: (piece) => piece.worn !== undefined, maxed: (piece) => piece.level >= 15 },
)

describe('gear clean-up', () => {
  it('scores each piece for its best character', () => {
    expect(rows.find((r) => r.item.id === 'good-for-b')?.best).toMatchObject({ id: 'b', name: 'Agent B', percent: 70 })
    expect(rows.find((r) => r.item.id === 'unscored')?.best).toBeUndefined()
  })

  it('suggests unworn pieces nobody wants as fodder, lowest first, never worn ones', () => {
    expect(fodder(rows).map((r) => r.item.id)).toEqual(['unscored', 'junk'])
  })

  it('suggests unfinished pieces that already score well, best first', () => {
    expect(levelNext(rows).map((r) => r.item.id)).toEqual(['good-for-b', 'ok-unfinished'])
  })
})
