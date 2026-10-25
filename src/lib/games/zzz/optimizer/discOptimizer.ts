import type {
  ActiveConditions,
  AgentData,
  StatEffect,
  WEngineData,
} from 'lib/games/zzz/data/dataTypes'
import { SETS } from 'lib/games/zzz/data/sets'
import { getSubstatValue } from 'lib/games/zzz/discStats'
import {
  ALL_STATS,
  computeStats,
  effectApplies,
  finalizeStats,
  type FinalStats,
  STAT_INDEX,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
import type {
  Disc,
  DiscSlot,
  MainStatSlot,
  ZzzStatsValues,
} from 'lib/games/zzz/types'

// Finds the six-disc combinations that maximize one final stat. No damage math: the ranking is a stat the user picks,
// with minimum stats, set and main stat filters. Every result is recomputed with computeStats, so the numbers shown
// are exactly what the stats panel would show for the same discs.

export type { MainStatSlot }

export type OptimizerFilters = {
  // Allowed main stats per slot, missing or empty means any
  mainStats: Partial<Record<MainStatSlot, ZzzStatsValues[]>>,
  // Set id that must have at least 4 pieces
  fourPieceSet?: string,
  // Set id that must have at least 2 pieces, ignored when it is the same as the 4-piece set
  twoPieceSet?: string,
  // Leave out discs the source says another agent is wearing
  excludeEquippedByOthers: boolean,
}

export type OptimizerRequest = {
  agent: AgentData,
  wEngine: WEngineData,
  wEngineRefinement: number,
  coreSkillLevel: number,
  conditions: ActiveConditions,
  discs: Disc[],
  filters: OptimizerFilters,
  // Compared against the unrounded stat
  minStats: Partial<Record<keyof FinalStats, number>>,
  sortBy: keyof FinalStats,
  // Breaks ties in sortBy, compared in order
  thenBy?: (keyof FinalStats)[],
  limit: number,
}

export type OptimizerBuild = {
  // In slot order 1-6
  discs: Disc[],
  display: FinalStats,
  warnings: string[],
}

export type OptimizerOutcome =
  | { ok: true, builds: OptimizerBuild[], combinations: number, matched: number }
  | { ok: false, reason: string }

// Beyond this the search would freeze the page for too long, the user is asked to filter first
export const MAX_COMBINATIONS = 100_000_000

const SLOTS: DiscSlot[] = [1, 2, 3, 4, 5, 6]

export function filterPools(request: Pick<OptimizerRequest, 'agent' | 'discs' | 'filters'>): Disc[][] {
  const { agent, discs, filters } = request
  return SLOTS.map((slot) =>
    discs.filter((disc) => {
      if (disc.slot !== slot) return false
      if (filters.excludeEquippedByOthers && disc.equippedBy && disc.equippedBy !== agent.id) return false
      const allowed = slot >= 4 ? filters.mainStats[slot as MainStatSlot] : undefined
      if (allowed && allowed.length > 0 && !allowed.includes(disc.main.stat)) return false
      return true
    })
  )
}

export function countCombinations(pools: Disc[][]): number {
  return pools.reduce((product, pool) => product * pool.length, 1)
}

const STAT_COUNT = ALL_STATS.length

function addToVector(vector: Float64Array, stat: ZzzStatsValues, value: number) {
  const index = STAT_INDEX.get(stat)
  if (index !== undefined) vector[index] += value
}

function effectsVector(effects: StatEffect[], agent: AgentData, conditions: ActiveConditions): Float64Array {
  const vector = new Float64Array(STAT_COUNT)
  for (const effect of effects) {
    if (effectApplies(effect, agent, conditions)) addToVector(vector, effect.stat, effect.value)
  }
  return vector
}

function discVector(disc: Disc): Float64Array {
  const vector = new Float64Array(STAT_COUNT)
  addToVector(vector, disc.main.stat, disc.main.value)
  for (const substat of disc.substats) {
    // Unknown roll values are left out here, computeStats reports them on the final results
    const value = getSubstatValue(disc.rarity, substat.stat, substat.rolls)
    if (value !== undefined) addToVector(vector, substat.stat, value)
  }
  return vector
}

// values holds the sortBy stat followed by the thenBy stats
type Candidate = { values: number[], picks: number[] }

// Positive when a ranks above b
function compareValues(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

export function optimizeDiscs(request: OptimizerRequest): OptimizerOutcome {
  const { agent, wEngine, conditions, filters, sortBy, limit } = request
  const pools = filterPools(request)

  const emptySlot = pools.findIndex((pool) => pool.length === 0)
  if (emptySlot >= 0) return { ok: false, reason: `No discs left for slot ${emptySlot + 1} with these filters` }

  const combinations = countCombinations(pools)
  if (combinations > MAX_COMBINATIONS) {
    return {
      ok: false,
      reason: `${combinations.toLocaleString('en-US')} combinations is too many, narrow the main stats or sets first`,
    }
  }

  // Everything that doesn't depend on the discs
  const base = new Float64Array(STAT_COUNT)
  addToVector(base, wEngine.subStat.stat, wEngine.subStat.value)
  const passiveVector = effectsVector(wEngine.passive(request.wEngineRefinement), agent, conditions)
  const coreVector = effectsVector(agent.coreEffects[request.coreSkillLevel] ?? [], agent, conditions)
  for (let i = 0; i < STAT_COUNT; i++) base[i] += passiveVector[i] + coreVector[i]

  // Sets are numbered so counting pieces is an array lookup
  const setIds = [...new Set(pools.flat().map((disc) => disc.setId))]
  const setIndex = new Map(setIds.map((id, i) => [id, i]))
  const twoPiece = setIds.map((id) => effectsVector(SETS[id]?.twoPiece ?? [], agent, conditions))
  const fourPiece = setIds.map((id) => effectsVector(SETS[id]?.fourPiece ?? [], agent, conditions))

  const poolVectors = pools.map((pool) => pool.map(discVector))
  const poolSets = pools.map((pool) => pool.map((disc) => setIndex.get(disc.setId) ?? -1))

  const requiredFour = filters.fourPieceSet !== undefined ? (setIndex.get(filters.fourPieceSet) ?? -2) : -1
  const requiredTwo = filters.twoPieceSet !== undefined && filters.twoPieceSet !== filters.fourPieceSet
    ? (setIndex.get(filters.twoPieceSet) ?? -2)
    : -1
  // A required set with no discs in the pool can never be satisfied
  if (requiredFour === -2 || requiredTwo === -2) return { ok: true, builds: [], combinations, matched: 0 }

  const minEntries = Object.entries(request.minStats).filter(([, v]) => v !== undefined) as [keyof FinalStats, number][]
  const rankKeys = [sortBy, ...(request.thenBy ?? []).filter((key) => key !== sortBy)]

  // sums[d] holds base + the first d discs
  const sums = Array.from({ length: 7 }, () => new Float64Array(STAT_COUNT))
  sums[0].set(base)
  const counts = new Int32Array(setIds.length)
  const picks = [0, 0, 0, 0, 0, 0]
  const pickedSets = [0, 0, 0, 0, 0, 0]
  const leaf = new Float64Array(STAT_COUNT)
  const top: Candidate[] = []
  let matched = 0

  const evaluate = () => {
    leaf.set(sums[6])
    for (let j = 0; j < 6; j++) {
      const s = pickedSets[j]
      let seen = false
      for (let k = 0; k < j; k++) if (pickedSets[k] === s) seen = true
      if (seen || counts[s] < 2) continue
      const two = twoPiece[s]
      for (let i = 0; i < STAT_COUNT; i++) leaf[i] += two[i]
      if (counts[s] >= 4) {
        const four = fourPiece[s]
        for (let i = 0; i < STAT_COUNT; i++) leaf[i] += four[i]
      }
    }
    const stats = finalizeStats(agent, wEngine, leaf)
    for (const [key, min] of minEntries) if (stats[key] < min) return
    matched++

    // Cheap check on the main stat first, most combinations stop here
    if (top.length === limit && stats[sortBy] < top[top.length - 1].values[0]) return
    const values = rankKeys.map((key) => stats[key])
    if (top.length === limit && compareValues(values, top[top.length - 1].values) <= 0) return
    // Insert keeping the list sorted from best to worst, full ties keep the earlier find first
    let at = top.length
    while (at > 0 && compareValues(values, top[at - 1].values) > 0) at--
    top.splice(at, 0, { values, picks: [...picks] })
    if (top.length > limit) top.pop()
  }

  const search = (depth: number) => {
    // Stop as soon as the required sets can no longer be reached, this also rejects finished builds that miss them
    const remaining = 6 - depth
    if (requiredFour >= 0 && counts[requiredFour] + remaining < 4) return
    if (requiredTwo >= 0 && counts[requiredTwo] + remaining < 2) return
    if (depth === 6) {
      evaluate()
      return
    }

    const vectors = poolVectors[depth]
    const sets = poolSets[depth]
    const from = sums[depth]
    const to = sums[depth + 1]
    for (let p = 0; p < vectors.length; p++) {
      const vector = vectors[p]
      for (let i = 0; i < STAT_COUNT; i++) to[i] = from[i] + vector[i]
      picks[depth] = p
      pickedSets[depth] = sets[p]
      counts[sets[p]]++
      search(depth + 1)
      counts[sets[p]]--
    }
  }
  search(0)

  const builds = top.map((candidate): OptimizerBuild => {
    const discs = candidate.picks.map((p, slot) => pools[slot][p])
    const result = computeStats({
      agent,
      wEngine,
      wEngineRefinement: request.wEngineRefinement,
      coreSkillLevel: request.coreSkillLevel,
      discs,
      conditions,
    })
    return { discs, display: toDisplayStats(result.stats), warnings: result.warnings }
  })

  return { ok: true, builds, combinations, matched }
}
