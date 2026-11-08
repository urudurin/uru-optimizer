import { restrictOwners } from 'lib/games/shared/importChoice'
import {
  describe,
  expect,
  it,
} from 'vitest'

type Owner = { id: string, v: number }
const saved: Owner[] = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }]
const imported: Owner[] = [{ id: 'b', v: 2 }, { id: 'c', v: 2 }]
const idOf = (o: Owner) => o.id

describe('import choice (after HSR import step 2)', () => {
  it('brings in everything by default', () => {
    expect(restrictOwners(saved, imported, idOf, 'all', 'merge')).toBe(imported)
  })

  it('gear only: no characters merged, saved ones kept when replacing', () => {
    expect(restrictOwners(saved, imported, idOf, 'gear', 'merge')).toEqual([])
    expect(restrictOwners(saved, imported, idOf, 'gear', 'replace')).toBe(saved)
  })

  it('only existing: the imported ones already saved, plus the other saved ones when replacing', () => {
    expect(restrictOwners(saved, imported, idOf, 'existing', 'merge')).toEqual([{ id: 'b', v: 2 }])
    expect(restrictOwners(saved, imported, idOf, 'existing', 'replace')).toEqual([{ id: 'b', v: 2 }, { id: 'a', v: 1 }])
  })
})
