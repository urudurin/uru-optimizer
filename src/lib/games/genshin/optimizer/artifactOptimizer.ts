import {
  type CombatSetup,
  resolveCombat,
  setCountsOf,
} from 'lib/games/genshin/damage/combatEffects'
import {
  type DamageSetup,
  prepareDamage,
  preparedDamage,
  rotationDamage,
} from 'lib/games/genshin/damage/damage'
import {
  CHARACTER_SCREEN_PASSIVES,
  WEAPON_SCREEN_PASSIVES,
} from 'lib/games/genshin/data/screenPassives'
import {
  computeGenshinStats,
  finalizeStats,
  prepareCharacter,
  type PreparedCharacter,
  type TeamBuffTotals,
  twoPieceBonus,
} from 'lib/games/genshin/stats/computeStats'
import {
  type Artifact,
  ARTIFACT_SLOTS,
  type ArtifactSlot,
  type Element,
  ELEMENT_DMG_STAT,
  type GenshinCharacter,
  type GenshinStatKey,
  STAT_LABELS,
} from 'lib/games/genshin/types'
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

// Finds the 5-artifact builds that score highest for one target (a stat, Crit Value or an average-hit estimate), with
// minimum stats, set and main stat filters. No damage formulas beyond the average hit.
// A full inventory has around 10^12 combinations, so the search narrows them down without losing a result:
//   1. Only stats that change the target or a minimum stat count. Sets whose 2-piece gives none of those (and that
//      aren't required) are interchangeable, so they're treated as one set.
//   2. An artifact is dropped when at least `limit` artifacts of the same slot and set are as good on every stat that
//      counts: each of them would make a build at least as good, so it can't be in the top `limit`.
//   3. Branch and bound: a partial build stops when even the best remaining pieces in every stat at once can't beat the
//      current top results or reach the minimum stats. Every stat only helps (passives included), so this is exact.
// Results are recomputed with computeGenshinStats, the numbers the Characters page shows.

export type OptimizerTarget =
  | { kind: 'stat', stat: GenshinStatKey }
  // 2 x CRIT Rate + CRIT DMG
  | { kind: 'critValue' }
  // The stat a character scales on x (1 + CRIT Rate x CRIT DMG) x (1 + DMG Bonus), CRIT Rate capped at 100%. The DMG
  // Bonus is the element's (when given) plus all-element DMG Bonus from team buffs
  | { kind: 'averageHit', stat: 'atk' | 'hp' | 'def' | 'elementalMastery', element?: Element }
  // A rotation's damage against an enemy (damage/damage.ts)
  | { kind: 'damage', setup: DamageSetup }

export type MainStatSlot = 'sands' | 'goblet' | 'circlet'

export type OptimizerFilters = {
  // Allowed main stats per slot, missing or empty means any
  mainStats: Partial<Record<MainStatSlot, GenshinStatKey[]>>,
  // Set that must have 4 pieces
  fourPieceSet?: string,
  // Sets that must have 2 pieces each (at most 2, or 1 with a 4-piece set)
  twoPieceSets: string[],
  // Leave out artifacts another character is wearing
  excludeEquippedByOthers: boolean,
}

export type OptimizerRequest = {
  character: GenshinCharacter,
  artifacts: Artifact[],
  filters: OptimizerFilters,
  minStats: Partial<Record<GenshinStatKey, number>>,
  // Builds above any of these are left out, e.g. Energy Recharge at most 160
  maxStats?: Partial<Record<GenshinStatKey, number>>,
  target: OptimizerTarget,
  limit: number,
  // Buffs from teammates (team/teamBuffs.ts), the same for every build
  teamBuffs?: TeamBuffTotals,
  // The character's own combat effects (damage/combatEffects.ts): kit, combat-only 2-pieces, and the 4-piece effects of
  // sets in combat.sets, which only the 4-piece filter's set can have here
  combat?: CombatSetup,
  // Called now and then while searching (added by the worker, never sent to it)
  onProgress?: ProgressCallback,
}

export type OptimizerBuild = {
  // Flower, plume, sands, goblet, circlet
  artifacts: Artifact[],
  stats: Partial<Record<GenshinStatKey, number>>,
  score: number,
}

export type OptimizerOutcome =
  | {
    ok: true,
    builds: OptimizerBuild[],
    // The character's current artifacts, for comparison (undefined without all 5)
    current?: OptimizerBuild,
    // Artifacts per slot after the filters, and after dropping ones that can't make the top results
    poolSizes: number[],
    prunedSizes: number[],
    // Partial and full builds the search looked at
    visited: number,
    // The search hit its budget, the results are the best found so far
    truncated: boolean,
  }
  | { ok: false, reason: string }

// Builds the search may look at before giving up and returning what it has
export const VISIT_BUDGET = 30_000_000

// Pieces per slot in the quick first pass
const FIRST_PASS_SIZE = 12

const STATS = Object.keys(STAT_LABELS) as GenshinStatKey[]
const STAT_COUNT = STATS.length
const STAT_INDEX = new Map(STATS.map((stat, i) => [stat, i]))

type Stats = Partial<Record<GenshinStatKey, number>>

export function scoreStats(stats: Stats, target: OptimizerTarget): number {
  if (target.kind === 'stat') return stats[target.stat] ?? 0
  if (target.kind === 'damage') return rotationDamage(stats, target.setup)
  const critRate = stats.critRate ?? 0
  const critDmg = stats.critDmg ?? 0
  if (target.kind === 'critValue') return 2 * critRate + critDmg
  const capped = Math.min(Math.max(critRate, 0), 100)
  const dmgBonus = (target.element ? stats[ELEMENT_DMG_STAT[target.element]] ?? 0 : 0) + (stats.allDmg ?? 0)
  return (stats[target.stat] ?? 0) * (1 + capped / 100 * critDmg / 100) * (1 + dmgBonus / 100)
}

export function targetLabel(target: OptimizerTarget): string {
  if (target.kind === 'stat') return STAT_LABELS[target.stat]
  if (target.kind === 'critValue') return 'Crit Value'
  if (target.kind === 'damage') return 'Rotation damage'
  return `Average ${STAT_LABELS[target.stat]} hit`
}

function toVector(bonus: Stats): Float64Array {
  const vector = new Float64Array(STAT_COUNT)
  for (const [stat, value] of Object.entries(bonus) as [GenshinStatKey, number][]) {
    const index = STAT_INDEX.get(stat)
    if (index !== undefined) vector[index] += value
  }
  return vector
}

function toRecord(vector: Float64Array): Stats {
  const record: Stats = {}
  for (let i = 0; i < STAT_COUNT; i++) if (vector[i] !== 0) record[STATS[i]] = vector[i]
  return record
}

// finalizeStats on vectors, the hot path of the search: HP/ATK/DEF from their bonuses, then the always-on passives.
// Writes into out and returns it; checked against finalizeStats by the tests
const HP = STAT_INDEX.get('hp')!
const HP_PCT = STAT_INDEX.get('hpPct')!
const ATK = STAT_INDEX.get('atk')!
const ATK_PCT = STAT_INDEX.get('atkPct')!
const DEF = STAT_INDEX.get('def')!
const DEF_PCT = STAT_INDEX.get('defPct')!

function vectorFinalizer(prepared: PreparedCharacter) {
  const { character, baseHp, baseAtk, baseDef } = prepared
  const totalBonus = (Object.entries(prepared.totalBonus) as [GenshinStatKey, number][]).map(([stat, value]) => [STAT_INDEX.get(stat)!, value] as const)
  const passives = [
    CHARACTER_SCREEN_PASSIVES[character.id] && { passive: CHARACTER_SCREEN_PASSIVES[character.id], refinement: 1 },
    character.weapon && WEAPON_SCREEN_PASSIVES[character.weapon.id]
    && { passive: WEAPON_SCREEN_PASSIVES[character.weapon.id], refinement: character.weapon.refinement },
  ].filter((p) => !!p)
  return (bonus: Float64Array, out: Float64Array): Float64Array => {
    out.set(bonus)
    out[HP] = baseHp * (1 + bonus[HP_PCT] / 100) + bonus[HP]
    out[ATK] = baseAtk * (1 + bonus[ATK_PCT] / 100) + bonus[ATK]
    out[DEF] = baseDef * (1 + bonus[DEF_PCT] / 100) + bonus[DEF]
    if (passives.length > 0) {
      const screen = { ...toRecord(out), baseAtk }
      for (const { passive, refinement } of passives) {
        for (const [stat, value] of Object.entries(passive.apply(screen, refinement)) as [GenshinStatKey, number][]) out[STAT_INDEX.get(stat)!] += value
      }
    }
    for (const [index, value] of totalBonus) out[index] += value
    for (const final of prepared.finals) {
      for (const [stat, value] of Object.entries(final({ ...toRecord(out), baseAtk })) as [GenshinStatKey, number][]) out[STAT_INDEX.get(stat)!] += value
    }
    return out
  }
}

function vectorScorer(target: OptimizerTarget): (stats: Float64Array) => number {
  const critRate = STAT_INDEX.get('critRate')!
  const critDmg = STAT_INDEX.get('critDmg')!
  if (target.kind === 'stat') {
    const index = STAT_INDEX.get(target.stat)!
    return (s) => s[index]
  }
  if (target.kind === 'critValue') return (s) => 2 * s[critRate] + s[critDmg]
  if (target.kind === 'damage') {
    const prepared = prepareDamage(target.setup)
    const indexOf = Object.fromEntries(STAT_INDEX) as Record<GenshinStatKey, number>
    return (s) => preparedDamage(prepared, (stat) => s[indexOf[stat]])
  }
  const index = STAT_INDEX.get(target.stat)!
  const allDmg = STAT_INDEX.get('allDmg')!
  const elementDmg = target.element ? STAT_INDEX.get(ELEMENT_DMG_STAT[target.element])! : -1
  return (s) =>
    s[index] * (1 + Math.min(Math.max(s[critRate], 0), 100) / 100 * s[critDmg] / 100)
    * (1 + ((elementDmg >= 0 ? s[elementDmg] : 0) + s[allDmg]) / 100)
}

function artifactVector(artifact: Artifact): Float64Array {
  const vector = new Float64Array(STAT_COUNT)
  vector[STAT_INDEX.get(artifact.main.stat)!] += artifact.main.value
  for (const sub of artifact.substats) vector[STAT_INDEX.get(sub.stat)!] += sub.value
  return vector
}

export function filterPools(request: Pick<OptimizerRequest, 'character' | 'artifacts' | 'filters'>): Artifact[][] {
  const { character, artifacts, filters } = request
  return ARTIFACT_SLOTS.map((slot) =>
    artifacts.filter((artifact) => {
      if (artifact.slot !== slot) return false
      if (filters.excludeEquippedByOthers && artifact.equippedBy && artifact.equippedBy !== character.id) return false
      const allowed = slot === 'sands' || slot === 'goblet' || slot === 'circlet' ? filters.mainStats[slot] : undefined
      return !allowed || allowed.length === 0 || allowed.includes(artifact.main.stat)
    })
  )
}

function currentBuild(
  character: GenshinCharacter,
  artifacts: Artifact[],
  target: OptimizerTarget,
  teamBuffs?: TeamBuffTotals,
  combat?: CombatSetup,
): OptimizerBuild | undefined {
  const byId = new Map(artifacts.map((a) => [a.id, a]))
  const worn = ARTIFACT_SLOTS.map((slot: ArtifactSlot) => byId.get(character.artifactIds[slot] ?? ''))
  if (worn.some((a) => !a)) return undefined
  const { stats } = computeGenshinStats(character, worn as Artifact[], {}, teamBuffs, combat)
  return { artifacts: worn as Artifact[], stats, score: scoreStats(stats, target) }
}

export function optimizeArtifacts(request: OptimizerRequest): OptimizerOutcome {
  const { character, filters, target, limit } = request
  const { combat } = request
  // Every build has the 4-piece filter's set, so its effects are known up front
  const resolved = combat
    ? resolveCombat(character, combat, setCountsOf(filters.fourPieceSet ? Array(4).fill(filters.fourPieceSet) : []))
    : undefined
  const prepared = prepareCharacter(character, request.teamBuffs, resolved)
  if (!prepared) return { ok: false, reason: `${character.name} isn't in the stat data yet` }
  // Five artifacts fit one 4-piece set or two 2-piece sets
  if (filters.twoPieceSets.length > (filters.fourPieceSet ? 0 : 2)) {
    return {
      ok: false,
      reason: filters.fourPieceSet ? 'A 4-piece set leaves room for only one more artifact, not a 2-piece set' : 'Pick at most two 2-piece sets',
    }
  }

  const pools = filterPools(request)
  const emptySlot = pools.findIndex((pool) => pool.length === 0)
  if (emptySlot >= 0) return { ok: false, reason: `No ${ARTIFACT_SLOTS[emptySlot]} left with these filters` }

  const minEntries = (Object.entries(request.minStats) as [GenshinStatKey, number][]).filter(([, v]) => Number.isFinite(v))
  const base = toVector(prepared.bonus)
  const evaluate = (vector: Float64Array) => {
    const stats = finalizeStats(prepared, toRecord(vector))
    return { stats, score: scoreStats(stats, target) }
  }
  const finalize = vectorFinalizer(prepared)
  const score = vectorScorer(target)
  const mins = minEntries.map(([stat, min]) => [STAT_INDEX.get(stat)!, min] as const)
  const meetsMins = (stats: Float64Array) => {
    for (const [index, min] of mins) if (stats[index] < min) return false
    return true
  }
  const maxEntries = (Object.entries(request.maxStats ?? {}) as [GenshinStatKey, number][]).filter(([, v]) => Number.isFinite(v))
  const maxes = maxEntries.map(([stat, max]) => [STAT_INDEX.get(stat)!, max] as const)
  const meetsMaxes = (stats: Float64Array) => {
    for (const [index, max] of maxes) if (stats[index] > max) return false
    return true
  }

  // 1. Stats that change the target, a minimum or a maximum. More of a stat is better for the target and minimums,
  // less for maximums: direction 1 means more is better, -1 less is better, 0 that it has to match (both)
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

  // Sets that matter: required ones, and ones whose 2-piece touches a relevant stat. The rest share index -1
  const required = new Set([...(filters.fourPieceSet ? [filters.fourPieceSet] : []), ...filters.twoPieceSets])
  const setIds = [...new Set(pools.flat().map((a) => a.setId))].filter((id) => {
    if (required.has(id)) return true
    const bonus = toVector(twoPieceBonus(id, !!combat))
    return relevant.some((i) => bonus[i] !== 0)
  })
  for (const id of required) if (!setIds.includes(id)) return { ok: false, reason: `No artifacts of the required set ${id} pass the filters` }
  const setIndex = new Map(setIds.map((id, i) => [id, i]))
  const twoPiece = setIds.map((id) => toVector(twoPieceBonus(id, !!combat)))

  // 2. Drop artifacts that `limit` others of the same slot and set match or beat on every relevant stat
  const vectors = pools.map((pool) => pool.map(artifactVector))
  const groupOf = pools.map((pool) => pool.map((a) => setIndex.get(a.setId) ?? -1))
  let candidates = pools.map((pool, slot) => {
    const keep: number[] = []
    for (let a = 0; a < pool.length; a++) {
      let beatenBy = 0
      for (let b = 0; b < pool.length && beatenBy < limit; b++) {
        if (a === b || groupOf[slot][b] !== groupOf[slot][a]) continue
        let atLeast = true
        let better = false
        for (const i of relevant) {
          // How much better b is than a in this stat, in the direction that helps
          const diff = (vectors[slot][b][i] - vectors[slot][a][i]) * (direction[i] || 1)
          if (diff < 0 || (direction[i] === 0 && diff !== 0)) {
            atLeast = false
            break
          }
          if (diff > 0) better = true
        }
        // Exact ties: the earlier artifact counts as the better one, so one of a tied pair always stays
        if (atLeast && (better || b < a)) beatenBy++
      }
      if (beatenBy < limit) keep.push(a)
    }
    // Most promising first, so good builds are found early and bound the rest
    const promise = keep.map((a) => {
      const vector = new Float64Array(base)
      for (let i = 0; i < STAT_COUNT; i++) vector[i] += vectors[slot][a][i]
      return evaluate(vector).score
    })
    return keep.map((a, k) => ({ a, p: promise[k] })).sort((x, y) => y.p - x.p).map(({ a }) => a)
  })

  // Sands, goblet and circlet first: their main stats split them into groups, which keeps the bounds tight (a CRIT Rate
  // circlet and a CRIT DMG circlet never count as one piece with both)
  const order = [2, 3, 4, 0, 1]
  candidates = order.map((slot) => candidates[slot])
  const orderedVectors = order.map((slot) => vectors[slot])
  const orderedGroups = order.map((slot) => groupOf[slot])
  const mainOf = order.map((slot) => pools[slot].map((a) => a.main.stat))

  // The best vector of every main-stat group in each slot, and every way to combine them over slots d..4
  const comboBounds = (lists: number[][], skip = -1): Float64Array[][] => {
    const groups = lists.map((list, d) => {
      const byMain = new Map<GenshinStatKey, Float64Array>()
      if (d === skip) return [new Float64Array(STAT_COUNT)]
      for (const a of list) {
        const main = mainOf[d][a]
        const max = byMain.get(main) ?? new Float64Array(STAT_COUNT)
        for (let i = 0; i < STAT_COUNT; i++) max[i] = Math.max(max[i], orderedVectors[d][a][i])
        byMain.set(main, max)
      }
      return [...byMain.values()]
    })
    const combos: Float64Array[][] = Array.from({ length: 6 }, () => [])
    combos[5] = [new Float64Array(STAT_COUNT)]
    for (let d = 4; d >= 0; d--) {
      for (const group of groups[d]) {
        for (const rest of combos[d + 1]) {
          const sum = new Float64Array(STAT_COUNT)
          for (let i = 0; i < STAT_COUNT; i++) sum[i] = group[i] + rest[i]
          combos[d].push(sum)
        }
      }
    }
    return combos
  }

  // At most two 2-piece bonuses fit in five artifacts: the biggest two in each stat bound any build
  const setUpper = new Float64Array(STAT_COUNT)
  for (let i = 0; i < STAT_COUNT; i++) {
    const values = twoPiece.map((v) => Math.max(0, v[i])).sort((x, y) => y - x)
    setUpper[i] = (values[0] ?? 0) + (values[1] ?? 0)
  }

  const fourIndex = filters.fourPieceSet ? setIndex.get(filters.fourPieceSet)! : -1
  const twoIndexes = filters.twoPieceSets.map((id) => setIndex.get(id)!)
  // Best builds so far, as pool indices per slot
  const top: Ranked<number[]>[] = []
  const threshold = () => (top.length === limit ? top[top.length - 1].values[0] : -Infinity)
  let visited = 0
  let truncated = false

  // 3. Branch and bound over the given pool indices per slot, adding to top
  // Only the full search reports progress, the quick first pass would fill the bar and start it over
  const report = throttleProgress(request.onProgress)
  const search = (lists: number[][], reportProgress = false) => {
    const slotVectors = lists.map((list, d) => list.map((a) => orderedVectors[d][a]))
    const slotSets = lists.map((list, d) => list.map((a) => orderedGroups[d][a]))
    // combos[d] = the most slots d..4 can add, one vector per mix of main stats
    const combos = comboBounds(lists)
    // setSlots[d][s] = how many of slots d..4 have a piece of set s
    const setSlots = Array.from({ length: 6 }, () => new Int32Array(setIds.length))
    for (let d = 4; d >= 0; d--) {
      setSlots[d].set(setSlots[d + 1])
      for (const s of new Set(slotSets[d])) if (s >= 0) setSlots[d][s]++
    }
    // For each relevant stat, the sets whose 2-piece adds to it, biggest first
    const setsByStat = relevant.map((i) => ({
      i,
      sets: setIds.map((_, s) => s).filter((s) => twoPiece[s][i] > 0).sort((a, b) => twoPiece[b][i] - twoPiece[a][i]),
    }))

    const counts = new Int32Array(setIds.length)
    const sums = Array.from({ length: 6 }, () => new Float64Array(STAT_COUNT))
    sums[0].set(base)
    const bound = new Float64Array(STAT_COUNT)
    const withRest = new Float64Array(STAT_COUNT)
    const leaf = new Float64Array(STAT_COUNT)
    const final = new Float64Array(STAT_COUNT)
    const picks = [0, 0, 0, 0, 0]

    const setsReachable = (remaining: number) => {
      let need = fourIndex >= 0 ? Math.max(0, 4 - counts[fourIndex]) : 0
      for (const index of twoIndexes) need += Math.max(0, 2 - counts[index])
      return need <= remaining
    }

    const visit = (depth: number) => {
      if (truncated) return
      if (++visited > VISIT_BUDGET) {
        truncated = true
        return
      }
      if (reportProgress && report && (visited & PROGRESS_CHECK_MASK) === 0) {
        report({ visited, fraction: nestedFraction(picks[0], lists[0].length, picks[1], lists[1].length) })
      }
      if (!setsReachable(5 - depth)) return

      if (depth === 5) {
        leaf.set(sums[5])
        for (let s = 0; s < setIds.length; s++) {
          if (counts[s] < 2) continue
          for (let i = 0; i < STAT_COUNT; i++) leaf[i] += twoPiece[s][i]
        }
        finalize(leaf, final)
        if (!meetsMins(final) || !meetsMaxes(final)) return
        const value = score(final)
        if (!wouldRank(top, [value], limit)) return
        const item: number[] = []
        picks.forEach((p, d) => item[order[d]] = lists[d][p])
        // The full search finds the first pass's builds again
        if (top.some((entry) => entry.item.every((a, slot) => a === item[slot]))) return
        insertRanked(top, { values: [value], item }, limit)
        return
      }

      // Gear only adds stats, so a branch already over a maximum stays over it
      if (maxes.length > 0) {
        for (let i = 0; i < STAT_COUNT; i++) bound[i] = sums[depth][i]
        for (let s = 0; s < setIds.length; s++) {
          if (counts[s] < 2) continue
          for (let i = 0; i < STAT_COUNT; i++) bound[i] += twoPiece[s][i]
        }
        finalize(bound, final)
        if (!meetsMaxes(final)) return
      }

      // The best this branch could possibly do: every remaining slot's best in every stat, plus the 2-piece bonuses
      // already complete and the biggest ones that could still complete (at most two 2-pieces in all)
      const remaining = 5 - depth
      let complete = 0
      for (let s = 0; s < setIds.length; s++) if (counts[s] >= 2) complete++
      for (let i = 0; i < STAT_COUNT; i++) bound[i] = sums[depth][i]
      for (const { i, sets } of setsByStat) {
        let extra = 2 - complete
        for (const s of sets) {
          if (counts[s] >= 2) bound[i] += twoPiece[s][i]
          else if (extra > 0 && 2 - counts[s] <= Math.min(remaining, setSlots[depth][s])) {
            bound[i] += twoPiece[s][i]
            extra--
          }
        }
      }
      let promising = false
      for (const combo of combos[depth]) {
        for (let i = 0; i < STAT_COUNT; i++) withRest[i] = bound[i] + combo[i]
        finalize(withRest, final)
        if (meetsMins(final) && (top.length < limit || score(final) > threshold())) {
          promising = true
          break
        }
      }
      if (!promising) return

      const from = sums[depth]
      const to = sums[depth + 1]
      const options = slotVectors[depth]
      const sets = slotSets[depth]
      for (let p = 0; p < options.length; p++) {
        const vector = options[p]
        for (let i = 0; i < STAT_COUNT; i++) to[i] = from[i] + vector[i]
        picks[depth] = p
        if (sets[p] >= 0) counts[sets[p]]++
        visit(depth + 1)
        if (sets[p] >= 0) counts[sets[p]]--
      }
    }
    visit(0)
  }

  // 3a. A quick first pass finds real builds to beat: the most promising pieces, plus the best in each minimum stat
  search(candidates.map((list, d) => {
    const picked = new Set(list.slice(0, FIRST_PASS_SIZE))
    for (const [index] of mins) {
      const best = [...list].sort((a, b) => orderedVectors[d][b][index] - orderedVectors[d][a][index])
      for (const a of best.slice(0, FIRST_PASS_SIZE / 2)) picked.add(a)
    }
    return list.filter((a) => picked.has(a))
  }))

  // 3b. Drop each artifact that can't reach the top even with the best of everything else in the other slots; that
  // lowers the best of everything else, so repeat until nothing changes
  const bound = new Float64Array(STAT_COUNT)
  const final = new Float64Array(STAT_COUNT)
  const withRest = new Float64Array(STAT_COUNT)
  for (let changed = true; changed;) {
    changed = false
    const bar = threshold()
    candidates = candidates.map((list, d) => {
      // Every mix of main stats in the other slots
      const others = comboBounds(candidates, d)[0]
      return list.filter((a) => {
        // An artifact that alone takes a stat over its maximum can't be in any build
        if (maxes.length > 0) {
          for (let i = 0; i < STAT_COUNT; i++) bound[i] = base[i] + orderedVectors[d][a][i]
          finalize(bound, final)
          if (!meetsMaxes(final)) {
            changed = true
            return false
          }
        }
        for (let i = 0; i < STAT_COUNT; i++) bound[i] = base[i] + orderedVectors[d][a][i] + setUpper[i]
        const keep = others.some((combo) => {
          for (let i = 0; i < STAT_COUNT; i++) withRest[i] = bound[i] + combo[i]
          finalize(withRest, final)
          return meetsMins(final) && score(final) >= bar
        })
        if (!keep) changed = true
        return keep
      })
    })
  }

  // 3c. The full search, with the first pass's builds already setting the bar
  if (candidates.every((list) => list.length > 0)) search(candidates, true)

  const builds = top.map((candidate): OptimizerBuild => {
    const chosen = candidate.item.map((a, slot) => pools[slot][a])
    const { stats } = computeGenshinStats(character, chosen, {}, request.teamBuffs, combat)
    return { artifacts: chosen, stats, score: scoreStats(stats, target) }
  })

  return {
    ok: true,
    builds,
    current: currentBuild(character, request.artifacts, target, request.teamBuffs, combat),
    poolSizes: pools.map((pool) => pool.length),
    prunedSizes: ARTIFACT_SLOTS.map((_, slot) => candidates[order.indexOf(slot)].length),
    visited,
    truncated,
  }
}
