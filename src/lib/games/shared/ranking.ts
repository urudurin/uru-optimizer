// Keeps the best N results of a search, ranked by a list of values compared in order (main value first, then
// tie-breakers). Shared by the gear optimizers.

export type Ranked<T> = {
  values: number[],
  item: T,
}

// Positive when a ranks above b
export function compareValues(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

// Whether values would make it into a full list, checked before building the entry
export function wouldRank<T>(list: Ranked<T>[], values: number[], limit: number): boolean {
  return list.length < limit || compareValues(values, list[list.length - 1].values) > 0
}

// Inserts into a list sorted best first and trims it to limit. Full ties keep the earlier entry first
export function insertRanked<T>(list: Ranked<T>[], entry: Ranked<T>, limit: number): void {
  let at = list.length
  while (at > 0 && compareValues(entry.values, list[at - 1].values) > 0) at--
  list.splice(at, 0, entry)
  if (list.length > limit) list.pop()
}
