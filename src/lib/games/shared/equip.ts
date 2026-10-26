// Equipping a build onto a character the way the games do it, for games with fixed gear slots (ZZZ discs, Genshin
// artifacts): a piece another character wears is swapped, so they get this character's old piece in that slot.
// Works on plain maps so each game can map its own save shape in and out. Changes the browser save only, never the game.

// Who wears what: owner id -> slot -> item id
export type Loadouts<Slot extends string | number> = Map<string, Partial<Record<Slot, string>>>

export type EquipChange = {
  // Item id -> its new owner, undefined when it's now unequipped. Only items whose owner changed
  owners: Map<string, string | undefined>,
  // Every owner whose loadout changed, the target included
  changedOwners: Set<string>,
  // Pieces taken from other characters, for asking first
  takenFrom: { owner: string, itemId: string }[],
}

// The owner each item is worn by, from the loadouts
export function ownersOf<Slot extends string | number>(loadouts: Loadouts<Slot>): Map<string, string> {
  const owners = new Map<string, string>()
  for (const [owner, slots] of loadouts) for (const id of Object.values(slots) as (string | undefined)[]) if (id) owners.set(id, owner)
  return owners
}

// What equipping would take from other characters, without changing anything
export function piecesTaken<Slot extends string | number>(loadouts: Loadouts<Slot>, owner: string, items: { slot: Slot, id: string }[]) {
  const wornBy = ownersOf(loadouts)
  return items.flatMap(({ id }) => {
    const from = wornBy.get(id)
    return from && from !== owner ? [{ owner: from, itemId: id }] : []
  })
}

// Updates loadouts in place and says what changed
export function equipSlots<Slot extends string | number>(
  loadouts: Loadouts<Slot>,
  owner: string,
  items: { slot: Slot, id: string }[],
): EquipChange {
  const wornBy = ownersOf(loadouts)
  const change: EquipChange = { owners: new Map(), changedOwners: new Set(), takenFrom: [] }
  const mine: Partial<Record<Slot, string>> = loadouts.get(owner) ?? {}
  loadouts.set(owner, mine)

  for (const { slot, id } of items) {
    const current = mine[slot]
    if (current === id) continue
    const from = wornBy.get(id)
    mine[slot] = id
    change.owners.set(id, owner)
    wornBy.set(id, owner)
    change.changedOwners.add(owner)

    if (from && from !== owner) {
      // Swap: the other character gets this character's old piece in that slot, or an empty slot
      const theirs: Partial<Record<Slot, string>> = loadouts.get(from) ?? {}
      if (current) {
        theirs[slot] = current
        change.owners.set(current, from)
        wornBy.set(current, from)
      } else {
        delete theirs[slot]
      }
      change.changedOwners.add(from)
      change.takenFrom.push({ owner: from, itemId: id })
    } else if (current) {
      change.owners.set(current, undefined)
      wornBy.delete(current)
    }
  }
  return change
}
