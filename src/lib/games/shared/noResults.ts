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
