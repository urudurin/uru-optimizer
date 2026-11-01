import type { GameId } from 'lib/games/games'
import { swapsOnEquip } from 'lib/games/shared/gameSettings'
import {
  type ImportMode,
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import {
  create,
  type StoreApi,
  type UseBoundStore,
} from 'zustand'

// One zustand store per game for its gear and characters, after HSR's characterStore / relicStore: the state functions
// in <game>/state/<game>State.ts stay pure (data in, data out, tested on their own) and every verb here runs one of them,
// saves the result to the game's storage key and sets it. The equip / swap rules live in those functions and in
// shared/equip.ts; shared/gameSettings.ts decides between swapping and replacing.

export type GearStoreConfig<Data extends object, Gear, Parsed extends { warnings: Warning[] }, Warning> = {
  game: GameId,
  storageKey: string,
  empty: Data,
  serialize: (data: Data) => string,
  deserialize: (text: string | null) => Data,
  // An import with nothing in it, which never wipes existing data, even in replace mode
  isEmptyImport: (parsed: Parsed) => boolean,
  merge: (data: Data, parsed: Parsed, mode: ImportMode) => Data,
  // A piece added or edited by hand
  saveGear: (data: Data, item: Gear) => Data,
  deleteGear: (data: Data, ids: string[]) => Data,
  // The editor's Equipped by: a character id puts the piece on them, null takes it off
  assignGear: (data: Data, itemId: string, owner: string | null, swap: boolean) => Data,
  // The Characters page's Character menu, by character (ZZZ: build) id
  unequipOwner: (data: Data, ownerId: string) => Data,
  switchGear: (data: Data, a: string, b: string) => Data,
  deleteOwner: (data: Data, ownerId: string) => Data,
  itemId: (item: Gear) => string,
}

export type GearStoreVerbs<Gear, Parsed, Warning> = {
  // Warnings from the most recent import, not persisted
  lastWarnings: Warning[],
  importParsed: (parsed: Parsed, mode: ImportMode) => void,
  // Adds or edits a piece by hand; owner (the editor's Equipped by): a character id puts it on them, null takes it off,
  // undefined leaves it
  saveGear: (item: Gear, owner?: string | null) => void,
  deleteGear: (ids: string[]) => void,
  unequipOwner: (ownerId: string) => void,
  switchGear: (a: string, b: string) => void,
  deleteOwner: (ownerId: string) => void,
  clear: () => void,
}

// Runs a state function over the saved data, then saves and sets the result. swap is the game's equip setting
export type ApplyChange<Data> = (change: (data: Data, swap: boolean) => Data) => void

export function createGearStore<Data extends object, Gear, Parsed extends { warnings: Warning[] }, Warning, Extra extends object>(
  config: GearStoreConfig<Data, Gear, Parsed, Warning>,
  extra: (apply: ApplyChange<Data>) => Extra,
): UseBoundStore<StoreApi<Data & GearStoreVerbs<Gear, Parsed, Warning> & Extra>> {
  type Store = Data & GearStoreVerbs<Gear, Parsed, Warning> & Extra
  const keys = Object.keys(config.empty) as (keyof Data)[]
  const dataOf = (state: Store) => Object.fromEntries(keys.map((key) => [key, state[key]])) as Data

  function save(data: Data) {
    if (!writeStorage(config.storageKey, config.serialize(data))) {
      console.error(`Failed to save ${config.game} data (storage blocked or quota exceeded?)`)
    }
  }

  return create<Store>()((set, get) => {
    const apply: ApplyChange<Data> = (change) => {
      const data = change(dataOf(get()), swapsOnEquip(config.game))
      save(data)
      set(data as Partial<Store>)
    }

    const verbs: GearStoreVerbs<Gear, Parsed, Warning> = {
      lastWarnings: [],
      importParsed: (parsed, mode) => {
        if (config.isEmptyImport(parsed)) {
          set({ lastWarnings: parsed.warnings } as Partial<Store>)
          return
        }
        apply((data) => config.merge(data, parsed, mode))
        set({ lastWarnings: parsed.warnings } as Partial<Store>)
      },
      saveGear: (item, owner) =>
        apply((data, swap) => {
          const saved = config.saveGear(data, item)
          return owner === undefined ? saved : config.assignGear(saved, config.itemId(item), owner, swap)
        }),
      deleteGear: (ids) => apply((data) => config.deleteGear(data, ids)),
      unequipOwner: (ownerId) => apply((data) => config.unequipOwner(data, ownerId)),
      switchGear: (a, b) => apply((data) => config.switchGear(data, a, b)),
      deleteOwner: (ownerId) => apply((data) => config.deleteOwner(data, ownerId)),
      clear: () => {
        save(config.empty)
        set({ ...config.empty, lastWarnings: [] } as Partial<Store>)
      },
    }

    return { ...config.deserialize(readStorage(config.storageKey)), ...verbs, ...extra(apply) } as Store
  })
}
