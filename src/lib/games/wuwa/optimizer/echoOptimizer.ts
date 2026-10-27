import {
  nestedFraction,
  PROGRESS_CHECK_MASK,
  type ProgressCallback,
  throttleProgress,
} from 'lib/games/shared/progress'
import {
  insertRanked,
  type Ranked,
  wouldRank,
} from 'lib/games/shared/ranking'
import {
  type DamageSetup,
  rotationDamage,
} from 'lib/games/wuwa/damage/damage'
import { SONATA_SETS } from 'lib/games/wuwa/data/gameData'
import {
  type Bonus,
  computeWuwaStats,
  echoStats,
  finalizeWuwaStats,
  prepareWuwaCharacter,
  sonataBonus,
  type WuwaStats,
} from 'lib/games/wuwa/stats/computeStats'
import {
  type CharacterState,
  type Cost,
  type Echo,
  MAX_LOADOUT_COST,
  MAX_LOADOUT_ECHOES,
  STAT_LABELS,
  type StatKey,
} from 'lib/games/wuwa/types'

// Finds the echo loadouts (up to 5 echoes, 12 cost) that score highest for one target: an overview-screen stat, Crit
// Value, or an average hit (scaling stat x crit multiplier x DMG bonus), with minimum stats, sonata set and main stat
// filters. Stats are worked out exactly like the Resonators page (computeWuwaStats).
// The search is exact and narrows the combinations without losing a result:
//   - Only cost patterns with no room for one more of the available echoes (4-3-3-1-1, 4-4-1-1-1, 3-3-3-3...): adding an
//     echo never lowers a stat, so a loadout with room left is never better than the same loadout plus an echo.
//   - Only stats that change the target or a minimum stat count. Sets whose 2-piece gives none of those (and that
//     aren't required) are interchangeable.
//   - An echo is dropped when enough echoes of the same cost and the same echo and set match or beat it on every stat
//     that counts (a loadout can hold several echoes of one cost, so it takes `limit` plus those).
//   - Branch and bound: a partial loadout stops when even the best remaining echoes in every stat can't beat the top
//     results or reach the minimum stats. Every stat only helps, so this is exact.

export type AverageHitBonus = 'none' | 'basicDmg' | 'heavyDmg' | 'skillDmg' | 'libDmg'

export type EchoTarget =
  | { kind: 'stat', stat: keyof WuwaStats }
  // 2 x Crit Rate + Crit DMG, as the overview screen shows them
  | { kind: 'critValue' }
  // stat x (1 + Crit Rate x (Crit DMG - 100%)) x (1 + element DMG + the chosen skill type's DMG), Crit Rate capped at 100%
  | { kind: 'averageHit', stat: 'atk' | 'hp' | 'def', bonus: AverageHitBonus }
  // A rotation's damage against an enemy (damage/damage.ts)
  | { kind: 'damage', setup: DamageSetup }

export type EchoFilters = {
  // Allowed main stats per cost, missing or empty means any
  mainStats: Partial<Record<Cost, StatKey[]>>,
  // A set that must be complete (5 pieces, or 3 for three-piece sets)
  fullSet?: string,
  // Sets that must have 2 pieces each
  twoPieceSets: string[],
  // Leave out echoes another Resonator is wearing
  excludeEquippedByOthers: boolean,
}

export type EchoRequest = {
  character: CharacterState,
  // Every saved character, to know who wears what
  characters: CharacterState[],
  echoes: Echo[],
  filters: EchoFilters,
  minStats: Partial<Record<keyof WuwaStats, number>>,
  // Loadouts above any of these are left out, e.g. Energy Regen at most 130
  maxStats?: Partial<Record<keyof WuwaStats, number>>,
  // What teammates give the Resonator (team/teamBuffs.ts), the same for every loadout
  teamBonus?: Bonus,
  target: EchoTarget,
  limit: number,
  // Called now and then while searching (added by the worker, never sent to it)
  onProgress?: ProgressCallback,
}

export type EchoBuild = {
  echoes: Echo[],
  stats: WuwaStats,
  score: number,
}

export type EchoOutcome =
  | {
    ok: true,
    builds: EchoBuild[],
    // The character's current echoes, for comparison (undefined without any)
    current?: EchoBuild,
    // Echoes after the filters, and after dropping ones that can't make the top results
    poolSize: number,
    prunedSize: number,
    visited: number,
    // The search hit its budget, the results are the best found so far
    truncated: boolean,
  }
  | { ok: false, reason: string }

export const VISIT_BUDGET = 30_000_000

const STATS = Object.keys(STAT_LABELS) as StatKey[]
const STAT_COUNT = STATS.length
const STAT_INDEX = new Map(STATS.map((stat, i) => [stat, i]))
const COSTS: Cost[] = [4, 3, 1]

// Cost patterns (how many 4, 3 and 1-cost echoes) within the limits that have no room for another of the available
// echoes. available is the number of echoes of each cost, in COSTS order
// allSizes: every pattern, not only full ones; a maximum stat can make a loadout with room left the better one
export function costPatterns(available: [number, number, number], allSizes = false): [number, number, number][] {
  const patterns: [number, number, number][] = []
  for (let k4 = 0; k4 <= available[0]; k4++) {
    for (let k3 = 0; k3 <= available[1]; k3++) {
      for (let k1 = 0; k1 <= available[2]; k1++) {
        const taken = [k4, k3, k1]
        const size = k4 + k3 + k1
        const cost = 4 * k4 + 3 * k3 + k1
        if (size === 0 || size > MAX_LOADOUT_ECHOES || cost > MAX_LOADOUT_COST) continue
        const roomLeft = COSTS.some((c, i) => taken[i] < available[i] && size < MAX_LOADOUT_ECHOES && cost + c <= MAX_LOADOUT_COST)
        if (allSizes || !roomLeft) patterns.push([k4, k3, k1])
      }
    }
  }
  return patterns
}

function choose(n: number, k: number): number {
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return Math.round(result)
}

// How many loadouts these echoes make, every cost pattern with no room left counted (before any pruning)
export function countLoadouts(pool: Echo[]): number {
  const available = COSTS.map((cost) => pool.filter((echo) => echo.cost === cost).length) as [number, number, number]
  return costPatterns(available).reduce((sum, pattern) => sum + pattern.reduce((product, k, c) => product * choose(available[c], k), 1), 0)
}

export function scoreStats(stats: WuwaStats, target: EchoTarget): number {
  if (target.kind === 'stat') return stats[target.stat]
  if (target.kind === 'critValue') return 2 * stats.critRate + stats.critDmg
  if (target.kind === 'damage') return rotationDamage(stats, target.setup)
  const critRate = Math.min(Math.max(stats.critRate, 0), 100)
  const crit = 1 + critRate / 100 * (stats.critDmg - 100) / 100
  const bonus = stats.elementDmg + (target.bonus === 'none' ? 0 : stats[target.bonus])
  return stats[target.stat] * crit * (1 + bonus / 100)
}

const WUWA_STAT_LABELS: Record<keyof WuwaStats, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  critRate: 'Crit Rate',
  critDmg: 'Crit DMG',
  energyRegen: 'Energy Regen',
  healingBonus: 'Healing Bonus',
  elementDmg: 'Element DMG',
  basicDmg: 'Basic DMG%',
  heavyDmg: 'Heavy DMG%',
  skillDmg: 'Skill DMG%',
  libDmg: 'Liberation DMG%',
}

export function wuwaStatLabel(stat: keyof WuwaStats): string {
  return WUWA_STAT_LABELS[stat]
}

export function targetLabel(target: EchoTarget): string {
  if (target.kind === 'stat') return WUWA_STAT_LABELS[target.stat]
  if (target.kind === 'critValue') return 'Crit Value'
  if (target.kind === 'damage') return 'Rotation damage'
  const bonus = target.bonus === 'none' ? '' : ` (${WUWA_STAT_LABELS[target.bonus].replace(' DMG%', '')})`
  return `Average ${WUWA_STAT_LABELS[target.stat]} hit${bonus}`
}

function toVector(bonus: Partial<Record<StatKey, number>>): Float64Array {
  const vector = new Float64Array(STAT_COUNT)
  for (const [stat, value] of Object.entries(bonus) as [StatKey, number][]) {
    const index = STAT_INDEX.get(stat)
    if (index !== undefined) vector[index] += value
  }
  return vector
}

function toRecord(vector: Float64Array): Partial<Record<StatKey, number>> {
  const record: Partial<Record<StatKey, number>> = {}
  for (let i = 0; i < STAT_COUNT; i++) if (vector[i] !== 0) record[STATS[i]] = vector[i]
  return record
}

// Pieces of a set needed for its full bonus
function fullPieces(setId: string): number {
  return SONATA_SETS[setId]?.fullPieces ?? 5
}

export function filterPool(request: Pick<EchoRequest, 'character' | 'characters' | 'echoes' | 'filters'>): Echo[] {
  const { character, characters, echoes, filters } = request
  const wornBy = new Map<string, string>()
  for (const c of characters) for (const id of c.echoIds) if (id) wornBy.set(id, c.charId)
  return echoes.filter((echo) => {
    const owner = wornBy.get(echo.id)
    if (filters.excludeEquippedByOthers && owner && owner !== character.charId) return false
    const allowed = filters.mainStats[echo.cost]
    return !allowed || allowed.length === 0 || allowed.includes(echo.mainStat)
  })
}

function currentBuild(request: EchoRequest): EchoBuild | undefined {
  const byId = new Map(request.echoes.map((echo) => [echo.id, echo]))
  const worn = request.character.echoIds.flatMap((id) => (id && byId.get(id) ? [byId.get(id)!] : []))
  if (worn.length === 0) return undefined
  const { stats } = computeWuwaStats(request.character, worn, request.teamBonus)
  return { echoes: worn, stats, score: scoreStats(stats, request.target) }
}

export function optimizeEchoes(request: EchoRequest): EchoOutcome {
  const { character, filters, target, limit } = request
  const prepared = prepareWuwaCharacter(character)

  const required = new Map<string, number>()
  if (filters.fullSet) required.set(filters.fullSet, fullPieces(filters.fullSet))
  for (const id of filters.twoPieceSets) if (!required.has(id)) required.set(id, 2)
  const requiredPieces = [...required.values()].reduce((sum, n) => sum + n, 0)
  if (requiredPieces > MAX_LOADOUT_ECHOES) return { ok: false, reason: `Those sets need ${requiredPieces} echoes, a loadout holds ${MAX_LOADOUT_ECHOES}` }

  const pool = filterPool(request)
  if (pool.length === 0) return { ok: false, reason: 'No echoes left with these filters' }

  const minEntries = (Object.entries(request.minStats) as [keyof WuwaStats, number][]).filter(([, v]) => Number.isFinite(v))
  const evaluate = (vector: Float64Array) => {
    const stats = finalizeWuwaStats(prepared, toRecord(vector))
    return { stats, score: scoreStats(stats, target) }
  }
  const meetsMins = (stats: WuwaStats) => minEntries.every(([stat, min]) => stats[stat] >= min)
  const maxEntries = (Object.entries(request.maxStats ?? {}) as [keyof WuwaStats, number][]).filter(([, v]) => Number.isFinite(v))
  const meetsMaxes = (stats: WuwaStats) => maxEntries.every(([stat, max]) => stats[stat] <= max)
  const base = toVector({ ...prepared.bonus })
  for (const [i, value] of toVector(request.teamBonus ?? {}).entries()) base[i] += value

  // Stats that change the target, a minimum or a maximum. More of a stat is better for the target and minimums, less for
  // maximums: direction 1 means more is better, -1 less is better, 0 that it has to match (both)
  const baseline = evaluate(base)
  const relevant: number[] = []
  const direction = new Int8Array(STAT_COUNT)
  for (let i = 0; i < STAT_COUNT; i++) {
    const bumped = new Float64Array(base)
    bumped[i] += 1000
    const after = evaluate(bumped)
    const up = after.score !== baseline.score || minEntries.some(([stat]) => after.stats[stat] !== baseline.stats[stat])
    const capped = maxEntries.some(([stat]) => after.stats[stat] !== baseline.stats[stat])
    if (up || capped) relevant.push(i)
    direction[i] = up && capped ? 0 : capped ? -1 : 1
  }

  // Sets that matter get an index, the rest share -1
  const setIds = [...new Set(pool.map((echo) => echo.setId))].filter((id) => {
    if (required.has(id)) return true
    for (let pieces = 2; pieces <= fullPieces(id); pieces++) {
      const bonus = toVector(sonataBonus(id, pieces))
      if (relevant.some((i) => bonus[i] !== 0)) return true
    }
    return false
  })
  for (const id of required.keys()) {
    if (!setIds.includes(id)) return { ok: false, reason: `No echoes of the required set ${SONATA_SETS[id]?.name ?? id} pass the filters` }
  }
  const setIndex = new Map(setIds.map((id, i) => [id, i]))
  // bonusAt[s][n] = set s's bonus with n distinct echoes
  const bonusAt = setIds.map((id) => Array.from({ length: MAX_LOADOUT_ECHOES + 1 }, (_, n) => toVector(sonataBonus(id, n))))
  const requiredIndexes = [...required].map(([id, pieces]) => [setIndex.get(id)!, pieces] as const)

  // Only the patterns the pool can fill, and the most echoes of each cost any of them takes
  const byCost = new Map<Cost, Echo[]>(COSTS.map((cost) => [cost, pool.filter((echo) => echo.cost === cost)]))
  const patterns = costPatterns([byCost.get(4)!.length, byCost.get(3)!.length, byCost.get(1)!.length], maxEntries.length > 0)
  const maxTaken = new Map<Cost, number>(COSTS.map((cost, c) => [cost, Math.max(...patterns.map((p) => p[c]))]))

  // Which set (and which echo, since only distinct echoes count) each echo is, for dominance and counting
  const groupKey = (echo: Echo) => setIndex.has(echo.setId) ? `${echo.setId}|${echo.defId}` : '-'
  const defKeys = [...new Set(pool.filter((echo) => setIndex.has(echo.setId)).map((echo) => `${echo.setId}|${echo.defId}`))]
  const defIndex = new Map(defKeys.map((key, i) => [key, i]))

  type Candidate = { echo: Echo, vector: Float64Array, set: number, def: number }
  const candidates = new Map<Cost, Candidate[]>()
  let prunedSize = 0
  for (const cost of COSTS) {
    const echoes = byCost.get(cost)!
    const vectors = echoes.map((echo) => toVector(echoStats(echo)))
    const groups = echoes.map(groupKey)
    const needed = limit + Math.max(0, maxTaken.get(cost)! - 1)
    const keep: Candidate[] = []
    for (let a = 0; a < echoes.length; a++) {
      let beatenBy = 0
      for (let b = 0; b < echoes.length && beatenBy < needed; b++) {
        if (a === b || groups[a] !== groups[b]) continue
        let atLeast = true
        let better = false
        for (const i of relevant) {
          // How much better b is than a in this stat, in the direction that helps
          const diff = (vectors[b][i] - vectors[a][i]) * (direction[i] || 1)
          if (diff < 0 || (direction[i] === 0 && diff !== 0)) {
            atLeast = false
            break
          }
          if (diff > 0) better = true
        }
        if (atLeast && (better || b < a)) beatenBy++
      }
      if (beatenBy < needed) {
        const echo = echoes[a]
        keep.push({ echo, vector: vectors[a], set: setIndex.get(echo.setId) ?? -1, def: defIndex.get(groups[a]) ?? -1 })
      }
    }
    // Most promising first, so good loadouts are found early and bound the rest
    const promise = new Map(keep.map((c) => {
      const vector = new Float64Array(base)
      for (let i = 0; i < STAT_COUNT; i++) vector[i] += c.vector[i]
      return [c, evaluate(vector).score]
    }))
    keep.sort((x, y) => promise.get(y)! - promise.get(x)!)
    candidates.set(cost, keep)
    prunedSize += keep.length
  }

  // topSums[cost][i][r] = the most stat i can gain from r echoes of that cost
  const topSums = new Map<Cost, number[][]>()
  for (const cost of COSTS) {
    const list = candidates.get(cost)!
    topSums.set(
      cost,
      STATS.map((_, i) => {
        const values = list.map((c) => c.vector[i]).sort((x, y) => y - x)
        const sums = [0]
        for (let r = 1; r <= MAX_LOADOUT_ECHOES; r++) sums.push(sums[r - 1] + Math.max(0, values[r - 1] ?? 0))
        return sums
      }),
    )
  }

  const top: Ranked<Echo[]>[] = []
  let visited = 0
  let truncated = false
  const defCounts = new Int32Array(defKeys.length)
  const distinct = new Int32Array(setIds.length)
  const sums = Array.from({ length: MAX_LOADOUT_ECHOES + 1 }, () => new Float64Array(STAT_COUNT))
  sums[0].set(base)
  const bound = new Float64Array(STAT_COUNT)
  const leaf = new Float64Array(STAT_COUNT)
  const chosen: Candidate[] = []
  // Progress: which pattern, and where the first two positions are in their lists
  const report = throttleProgress(request.onProgress)
  const at = [0, 0]
  const lengths = [1, 1]

  for (const [patternIndex, pattern] of patterns.entries()) {
    // Positions in cost order, 4-cost first
    const positions: Cost[] = COSTS.flatMap((cost, c) => Array<Cost>(pattern[c]).fill(cost))
    const count = positions.length
    // remainingOf[d][c] = echoes of COSTS[c] still to pick after position d-1
    const remainingOf = Array.from({ length: count + 1 }, (_, d) => COSTS.map((cost) => positions.slice(d).filter((p) => p === cost).length))

    const visit = (depth: number, from: number) => {
      if (truncated) return
      if (++visited > VISIT_BUDGET) {
        truncated = true
        return
      }
      if (report && (visited & PROGRESS_CHECK_MASK) === 0) {
        report({ visited, fraction: (patternIndex + nestedFraction(at[0], lengths[0], at[1], lengths[1])) / patterns.length })
      }
      const remaining = count - depth
      let need = 0
      for (const [s, pieces] of requiredIndexes) need += Math.max(0, pieces - distinct[s])
      if (need > remaining) return

      if (depth === count) {
        leaf.set(sums[depth])
        for (let s = 0; s < setIds.length; s++) {
          const bonus = bonusAt[s][Math.min(distinct[s], MAX_LOADOUT_ECHOES)]
          for (let i = 0; i < STAT_COUNT; i++) leaf[i] += bonus[i]
        }
        const { stats, score } = evaluate(leaf)
        if (!meetsMins(stats) || !meetsMaxes(stats) || !wouldRank(top, [score], limit)) return
        insertRanked(top, { values: [score], item: chosen.map((c) => c.echo) }, limit)
        return
      }

      // Echoes only add stats, so a branch already over a maximum stays over it
      if (maxEntries.length > 0 && depth > 0) {
        for (let i = 0; i < STAT_COUNT; i++) bound[i] = sums[depth][i]
        for (let s = 0; s < setIds.length; s++) {
          const bonus = bonusAt[s][Math.min(distinct[s], MAX_LOADOUT_ECHOES)]
          for (let i = 0; i < STAT_COUNT; i++) bound[i] += bonus[i]
        }
        if (!meetsMaxes(evaluate(bound).stats)) return
      }

      // The best this branch could do: the remaining echoes' best in every stat, plus set bonuses. At most two sets
      // can have a bonus in five echoes, so each stat gets its two biggest possible set bonuses
      for (let i = 0; i < STAT_COUNT; i++) {
        let value = sums[depth][i]
        COSTS.forEach((cost, c) => value += topSums.get(cost)![i][remainingOf[depth][c]])
        let first = 0
        let second = 0
        for (let s = 0; s < setIds.length; s++) {
          const possible = bonusAt[s][Math.min(distinct[s] + remaining, MAX_LOADOUT_ECHOES)][i]
          if (possible > first) {
            second = first
            first = possible
          } else if (possible > second) second = possible
        }
        bound[i] = value + first + second
      }
      const best = evaluate(bound)
      if (!meetsMins(best.stats)) return
      if (top.length === limit && best.score <= top[top.length - 1].values[0]) return

      const cost = positions[depth]
      const list = candidates.get(cost)!
      // Within one cost, echoes are picked in list order so each loadout is visited once
      const start = depth > 0 && positions[depth - 1] === cost ? from + 1 : 0
      for (let p = start; p < list.length; p++) {
        if (depth < 2) {
          at[depth] = p
          lengths[depth] = list.length
        }
        const candidate = list[p]
        const vector = candidate.vector
        const next = sums[depth + 1]
        for (let i = 0; i < STAT_COUNT; i++) next[i] = sums[depth][i] + vector[i]
        chosen.push(candidate)
        const isNew = candidate.def >= 0 && defCounts[candidate.def]++ === 0
        if (isNew) distinct[candidate.set]++
        visit(depth + 1, p)
        if (candidate.def >= 0) defCounts[candidate.def]--
        if (isNew) distinct[candidate.set]--
        chosen.pop()
      }
    }
    visit(0, 0)
  }

  const builds = top.map((entry): EchoBuild => {
    const { stats } = computeWuwaStats(character, entry.item, request.teamBonus)
    return { echoes: entry.item, stats, score: scoreStats(stats, target) }
  })

  return {
    ok: true,
    builds,
    current: currentBuild(request),
    poolSize: pool.length,
    prunedSize,
    visited,
    truncated,
  }
}
