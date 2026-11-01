// What to loosen when a search finds nothing, after HSR's suggestions (lib/tabs/tabOptimizer/suggestionsEngine.ts):
// every filter that's set, each with a one-click fix. Pool filters (main stats, sets, worn gear, priority) are also
// checked: one that empties the pool on its own is marked as blocking and listed first. Stat limits can't be checked
// without searching again, so they're listed as they are, like HSR's zero-results causes.

export type FilterCause = {
  key: string,
  label: string,
  fixLabel: string,
  apply: () => void,
  // Dropping only this filter refills the empty slots
  blocking?: boolean,
}

// A pool filter with the page's filters as they'd be without it
export type PoolCandidate<F> = Omit<FilterCause, 'blocking'> & { without: F }

export function poolCauses<F>(candidates: PoolCandidate<F>[], poolEmpty: (filters: F) => boolean, emptyNow: boolean): FilterCause[] {
  return candidates
    .map(({ without, ...cause }) => ({ ...cause, blocking: emptyNow && !poolEmpty(without) }))
    .sort((a, b) => Number(b.blocking) - Number(a.blocking))
}

// The pool filters every game's Optimizer options card sets (shared/ui/optimizer/OptimizerOptionsCard.tsx)
export type OptionFilters = {
  excludeEquippedByOthers: boolean,
  excludeOwners?: string[],
  keep?: unknown,
  minLevel?: number,
  minRarity?: unknown,
}

// The Optimizer options that are set, as pool candidates: worn gear, priority, keep current, minimum level and rarity.
// Each fix turns its option off and then calls clear (which drops the old results)
export function optionCandidates<F extends OptionFilters>(filters: F, options: {
  // 'artifacts', 'discs', 'echoes'
  gearNoun: string,
  clear: () => void,
  setExcludeWorn: (value: boolean) => void,
  setPriority: (value: boolean) => void,
  setKeep?: (value: boolean) => void,
  setMinLevel: (value: number) => void,
  // The rarity filter as the card names it, e.g. 'Minimum rarity 5★', and how to reset it
  rarity?: { label: string, reset: () => void },
}): PoolCandidate<F>[] {
  const { gearNoun, clear } = options
  const candidates: PoolCandidate<F>[] = []
  if (filters.excludeEquippedByOthers) {
    candidates.push({
      key: 'worn',
      label: `Leave out ${gearNoun} others are wearing`,
      fixLabel: 'Allow them',
      without: { ...filters, excludeEquippedByOthers: false },
      apply: () => (options.setExcludeWorn(false), clear()),
    })
  }
  if (filters.excludeOwners?.length) {
    candidates.push({
      key: 'priority',
      label: 'Character priority filter',
      fixLabel: 'Turn off',
      without: { ...filters, excludeOwners: undefined },
      apply: () => (options.setPriority(false), clear()),
    })
  }
  if (options.setKeep && filters.keep !== undefined) {
    const setKeep = options.setKeep
    candidates.push({
      key: 'keep',
      label: `Keep current ${gearNoun}`,
      fixLabel: 'Turn off',
      without: { ...filters, keep: undefined },
      apply: () => (setKeep(false), clear()),
    })
  }
  if ((filters.minLevel ?? 0) > 0) {
    candidates.push({
      key: 'level',
      label: `Minimum level +${filters.minLevel}`,
      fixLabel: 'Clear',
      without: { ...filters, minLevel: 0 },
      apply: () => (options.setMinLevel(0), clear()),
    })
  }
  if (options.rarity && filters.minRarity) {
    const rarity = options.rarity
    candidates.push({
      key: 'rarity',
      label: rarity.label,
      fixLabel: 'Clear',
      without: { ...filters, minRarity: undefined },
      apply: () => (rarity.reset(), clear()),
    })
  }
  return candidates
}

// One cause per minimum and maximum that's set, in the stat filter's row order
export function statLimitCauses(
  rows: { key: string, label: string }[],
  min: Partial<Record<string, number>>,
  max: Partial<Record<string, number>>,
  setMin: (next: Partial<Record<string, number>>) => void,
  setMax: (next: Partial<Record<string, number>>) => void,
): FilterCause[] {
  const causes: FilterCause[] = []
  for (const row of rows) {
    const low = min[row.key]
    if (low !== undefined) {
      causes.push({
        key: `min:${row.key}`,
        label: `Minimum ${row.label} ${low}`,
        fixLabel: 'Clear',
        apply: () => setMin({ ...min, [row.key]: undefined }),
      })
    }
  }
  for (const row of rows) {
    const high = max[row.key]
    if (high !== undefined) {
      causes.push({
        key: `max:${row.key}`,
        label: `Maximum ${row.label} ${high}`,
        fixLabel: 'Clear',
        apply: () => setMax({ ...max, [row.key]: undefined }),
      })
    }
  }
  return causes
}
