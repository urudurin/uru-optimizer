import { createGearStore } from 'lib/games/shared/gearStore'
import { mergeById } from 'lib/games/shared/storage'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

type Piece = { id: string, owner?: string }
type Data = { pieces: Piece[], owners: { id: string }[] }

const KEY = 'test-gear-state'
const storage = new Map<string, string>()

function makeStore() {
  return createGearStore<Data, Piece, Data & { warnings: string[] }, string, { addOwner: (id: string) => void }>(
    {
      game: 'zzz',
      storageKey: KEY,
      empty: { pieces: [], owners: [] },
      serialize: (data) => JSON.stringify(data),
      deserialize: (text) => (text ? JSON.parse(text) as Data : { pieces: [], owners: [] }),
      isEmptyImport: (parsed) => parsed.pieces.length === 0 && parsed.owners.length === 0,
      merge: (data, parsed, mode) => ({ pieces: mergeById(data.pieces, parsed.pieces, mode), owners: mergeById(data.owners, parsed.owners, mode) }),
      saveGear: (data, item) => ({ ...data, pieces: [...data.pieces.filter((p) => p.id !== item.id), item] }),
      deleteGear: (data, ids) => ({ ...data, pieces: data.pieces.filter((p) => !ids.includes(p.id)) }),
      assignGear: (data, itemId, owner) => ({ ...data, pieces: data.pieces.map((p) => (p.id === itemId ? { ...p, owner: owner ?? undefined } : p)) }),
      unequipOwner: (data, ownerId) => ({ ...data, pieces: data.pieces.map((p) => (p.owner === ownerId ? { id: p.id } : p)) }),
      switchGear: (data) => data,
      deleteOwner: (data, ownerId) => ({ ...data, owners: data.owners.filter((o) => o.id !== ownerId) }),
      itemId: (item) => item.id,
    },
    (apply) => ({ addOwner: (id) => apply((data) => ({ ...data, owners: [...data.owners, { id }] })) }),
  )
}

const saved = () => JSON.parse(storage.get(KEY) ?? '{}') as Data

describe('createGearStore', () => {
  beforeEach(() => {
    storage.clear()
    // Tests run without a browser, so a Map stands in for localStorage
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('starts from the save, and every verb saves and sets its result', () => {
    storage.set(KEY, JSON.stringify({ pieces: [{ id: 'a' }], owners: [] }))
    const store = makeStore()
    expect(store.getState().pieces).toEqual([{ id: 'a' }])

    store.getState().addOwner('ye')
    store.getState().saveGear({ id: 'b' }, 'ye')
    expect(store.getState().pieces).toEqual([{ id: 'a' }, { id: 'b', owner: 'ye' }])
    expect(saved()).toEqual({ pieces: [{ id: 'a' }, { id: 'b', owner: 'ye' }], owners: [{ id: 'ye' }] })

    store.getState().unequipOwner('ye')
    store.getState().deleteGear(['a'])
    store.getState().deleteOwner('ye')
    expect(saved()).toEqual({ pieces: [{ id: 'b' }], owners: [] })
  })

  it('never wipes the save with an empty import, and keeps the warnings', () => {
    const store = makeStore()
    store.getState().saveGear({ id: 'a' })
    store.getState().importParsed({ pieces: [], owners: [], warnings: ['nothing found'] }, 'replace')
    expect(store.getState().pieces).toEqual([{ id: 'a' }])
    expect(store.getState().lastWarnings).toEqual(['nothing found'])

    store.getState().importParsed({ pieces: [{ id: 'c' }], owners: [], warnings: [] }, 'replace')
    expect(saved().pieces).toEqual([{ id: 'c' }])
    expect(store.getState().lastWarnings).toEqual([])
  })

  it('clears the save', () => {
    const store = makeStore()
    store.getState().saveGear({ id: 'a' })
    store.getState().clear()
    expect(store.getState().pieces).toEqual([])
    expect(saved()).toEqual({ pieces: [], owners: [] })
  })
})
