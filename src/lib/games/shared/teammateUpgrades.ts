// Teammate set upgrades, after HSR's TeammateUpgrades (lib/tabs/tabOptimizer/analysis/TeammateUpgrades.tsx): the picked
// build's rotation damage with one teammate wearing a different squad 4-piece set, through each game's teammate
// overrides (shared/teammateOverrides.ts fourPiece). Each set's best swap, then every swap that changes the damage.

export type TeammateSetTry = {
  teammateId: string,
  teammateName: string,
  // The 4-piece the teammate counts as wearing now (undefined: none)
  from?: string,
  to: string,
  damage: number,
}

export type TeammateUpgradeRow = TeammateSetTry & {
  delta: number,
  percent: number,
}

export type TeammateUpgrades = {
  // The best swap to each set, most damage first
  bySet: TeammateUpgradeRow[],
  // Every swap that changes the damage, most first
  swaps: TeammateUpgradeRow[],
}

// Changes smaller than this share of the damage count as none (rounding)
const PRECISION = 1e-9

export function rankTeammateUpgrades(base: number, tries: TeammateSetTry[]): TeammateUpgrades {
  const rows = tries
    .map((t): TeammateUpgradeRow => ({ ...t, delta: t.damage - base, percent: base > 0 ? ((t.damage - base) / base) * 100 : 0 }))
    .filter((row) => Math.abs(row.delta) > Math.abs(base) * PRECISION)
    .sort((a, b) => b.delta - a.delta)
  const best = new Map<string, TeammateUpgradeRow>()
  for (const row of rows) if (!best.has(row.to)) best.set(row.to, row)
  return { bySet: [...best.values()], swaps: rows }
}

// The tries for every teammate and set: damageWith(teammateId, setId) is the build's damage with that teammate on that set
export function teammateSetTries(
  teammates: { id: string, name: string, fourPiece?: string }[],
  sets: string[],
  damageWith: (teammateId: string, setId: string) => number,
): TeammateSetTry[] {
  return teammates.flatMap((mate) =>
    sets.filter((set) => set !== mate.fourPiece).map((set) => ({
      teammateId: mate.id,
      teammateName: mate.name,
      from: mate.fourPiece,
      to: set,
      damage: damageWith(mate.id, set),
    }))
  )
}
