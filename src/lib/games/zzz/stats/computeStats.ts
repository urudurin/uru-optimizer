import { roundHalfUp } from 'lib/games/shared/format'
import type {
  ActiveConditions,
  AgentData,
  Condition,
  StatEffect,
  WEngineData,
} from 'lib/games/zzz/data/dataTypes'
import { SETS } from 'lib/games/zzz/data/sets'
import { getSubstatValue } from 'lib/games/zzz/discStats'
import {
  type Disc,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Computes the numbers shown on the in-game agent stat screen, nothing about damage.
// Disc stat kinds: HP/ATK/DEF/PEN/Anomaly Proficiency are flat, HP%/ATK%/DEF%/Impact/Anomaly Mastery/Energy Regen
// are percent bonuses on the base value, CRIT Rate/CRIT DMG/PEN Ratio/Element DMG are added as points.

export type FinalStats = {
  hp: number,
  atk: number,
  def: number,
  impact: number,
  anomalyMastery: number,
  anomalyProficiency: number,
  critRate: number,
  critDmg: number,
  penRatio: number,
  pen: number,
  energyRegen: number,
  // DMG bonus for the agent's own element from stats and set effects
  elementDmg: number,
  // Rupture agents only, 0 for everyone else
  sheerForce: number,
}

export type Contribution = {
  source: string,
  stat: ZzzStatsValues,
  value: number,
  condition?: Condition,
}

export type ComputeInput = {
  agent: AgentData,
  wEngine: WEngineData,
  wEngineRefinement: number,
  coreSkillLevel: number,
  discs: Disc[],
  conditions: ActiveConditions,
  // Stat points to add on top, e.g. one more substat roll for the build analysis
  extraStats?: Partial<Record<ZzzStatsValues, number>>,
  // What teammates give this agent (team/teamBuffs.ts), counted whatever the conditions
  teamEffects?: StatEffect[],
}

export type ComputeResult = {
  stats: FinalStats,
  contributions: Contribution[],
  // Anything that stopped the result from being complete, never silently ignored
  warnings: string[],
}

export function defaultConditions(): ActiveConditions {
  return { onField: true, inEtherVeil: false, veilTriggered: false, freezeOrShatter: false }
}

// What the in-game agent stat screen shows: out of combat, so nothing that needs the agent on the field or an Ether Veil applies
export function statScreenConditions(): ActiveConditions {
  return { onField: false, inEtherVeil: false, veilTriggered: false, freezeOrShatter: false }
}

// Rounds the way the stat screen shows values
export function toDisplayStats(stats: FinalStats): FinalStats {
  return {
    hp: roundHalfUp(stats.hp),
    atk: roundHalfUp(stats.atk),
    def: roundHalfUp(stats.def),
    impact: roundHalfUp(stats.impact),
    anomalyMastery: roundHalfUp(stats.anomalyMastery),
    anomalyProficiency: roundHalfUp(stats.anomalyProficiency),
    critRate: roundHalfUp(stats.critRate, 1),
    critDmg: roundHalfUp(stats.critDmg, 1),
    penRatio: roundHalfUp(stats.penRatio, 1),
    pen: roundHalfUp(stats.pen),
    energyRegen: roundHalfUp(stats.energyRegen, 2),
    elementDmg: roundHalfUp(stats.elementDmg, 1),
    sheerForce: roundHalfUp(stats.sheerForce),
  }
}

export function effectApplies(effect: StatEffect, agent: AgentData, conditions: ActiveConditions): boolean {
  if (effect.when && !conditions[effect.when]) return false
  if (effect.specialty && effect.specialty !== agent.specialty) return false
  if (effect.element && effect.element !== agent.element) return false
  return true
}

export function computeStats(input: ComputeInput): ComputeResult {
  const { agent, wEngine, discs } = input
  const contributions: Contribution[] = []
  const warnings: string[] = []

  // Effects that need a final stat to reach a value wait until the other stats are known
  const thresholdEffects: StatEffect[] = []
  const addEffects = (effects: StatEffect[]) => {
    for (const effect of effects) {
      if (!effectApplies(effect, agent, input.conditions)) continue
      if (isThreshold(effect)) {
        thresholdEffects.push(effect)
        continue
      }
      contributions.push({ source: effect.source, stat: effect.stat, value: effect.value, condition: effect.when })
    }
  }

  // Disc main stats and substats
  for (const disc of discs) {
    contributions.push({ source: `Disc ${disc.slot} main stat`, stat: disc.main.stat, value: disc.main.value })
    for (const substat of disc.substats) {
      const value = getSubstatValue(disc.rarity, substat.stat, substat.rolls)
      if (value === undefined) {
        warnings.push(`Disc ${disc.slot}: no roll value known for ${disc.rarity}-rank ${substat.stat}, substat left out`)
        continue
      }
      contributions.push({ source: `Disc ${disc.slot} substat`, stat: substat.stat, value })
    }
  }

  for (const [stat, value] of Object.entries(input.extraStats ?? {}) as [ZzzStatsValues, number][]) {
    contributions.push({ source: 'Extra substat roll', stat, value })
  }

  addEffects(input.teamEffects ?? [])

  // Set bonuses: a 4-piece also has its 2-piece, and 2-pieces from different sets stack
  const pieceCount = new Map<string, { name: string, count: number }>()
  for (const disc of discs) {
    const entry = pieceCount.get(disc.setId)
    if (entry) entry.count++
    else pieceCount.set(disc.setId, { name: disc.setName, count: 1 })
  }
  for (const [setId, { name, count }] of pieceCount) {
    if (count < 2) continue
    const set = SETS[setId]
    if (!set) {
      warnings.push(`No set data for "${name}", its bonuses are left out`)
      continue
    }
    addEffects(set.twoPiece)
    if (count >= 4) {
      addEffects(set.fourPiece)
      if (!set.fourPieceModeled) warnings.push(`${set.name} 4-piece effects aren't modeled yet`)
    }
  }

  // W-Engine
  contributions.push({ source: `${wEngine.name} advanced stat`, stat: wEngine.subStat.stat, value: wEngine.subStat.value })
  addEffects(wEngine.passive(input.wEngineRefinement))

  // Core Skill
  const coreEffects = agent.coreEffects[input.coreSkillLevel]
  if (coreEffects) addEffects(coreEffects)
  else warnings.push(`No Core Skill data for level ${input.coreSkillLevel}`)

  const totals = emptyTotals()
  for (const c of contributions) totals[STAT_INDEX.get(c.stat)!] += c.value
  const before = finalizeStats(agent, wEngine, totals)
  const reached = metThresholds(before, thresholdEffects)
  for (const effect of reached) {
    contributions.push({ source: effect.source, stat: effect.stat, value: effect.value, condition: effect.when })
    totals[STAT_INDEX.get(effect.stat)!] += effect.value
  }

  return { stats: reached.length > 0 ? finalizeStats(agent, wEngine, totals) : before, contributions, warnings }
}

// The threshold effects (minStat) whose stat reaches its value, and fromStat effects with their value worked out. Checked against the stats without any of them, so the
// order they're listed in never matters
export function metThresholds(stats: FinalStats, effects: StatEffect[]): StatEffect[] {
  return effects.flatMap((effect) => {
    if (effect.minStat && stats[effect.minStat.stat] < effect.minStat.atLeast) return []
    const from = effect.fromStat
    if (!from) return effect.minStat ? [effect] : []
    return [{ ...effect, value: Math.min(from.max, effect.value + from.per * Math.max(0, stats[from.stat] - from.above)) }]
  })
}

// Effects that wait for the other stats: a minimum (minStat) or a value from a final stat (fromStat)
export function isThreshold(effect: StatEffect): boolean {
  return effect.minStat !== undefined || effect.fromStat !== undefined
}

// Summed bonus points per stat before they are applied to the base stats, indexed by STAT_INDEX.
// A typed array rather than an object because the disc optimizer fills one for every combination it tries
export type StatTotals = Float64Array

export const ALL_STATS: ZzzStatsValues[] = Object.values(ZzzStats)
export const STAT_INDEX = new Map(ALL_STATS.map((stat, i) => [stat, i]))

const I = Object.fromEntries(Object.keys(ZzzStats).map((key, i) => [key, i])) as Record<keyof typeof ZzzStats, number>

export function emptyTotals(): StatTotals {
  return new Float64Array(ALL_STATS.length)
}

// The one place that turns bonus totals into final stats, shared by the calculator and the disc optimizer
export function finalizeStats(agent: AgentData, wEngine: WEngineData, totals: StatTotals): FinalStats {
  const base = agent.base
  const hp = base.hp * (1 + totals[I.HP_P] / 100) + totals[I.HP]
  const atk = (base.atk + wEngine.baseAtk) * (1 + totals[I.ATK_P] / 100) + totals[I.ATK]
  // Each part is rounded down, without that a Yixuan screenshot comes out one point high
  const sheerForce = agent.sheerForce
    ? Math.floor(atk * agent.sheerForce.fromAtk) + Math.floor(hp * agent.sheerForce.fromHp)
    : 0

  return {
    hp,
    atk,
    def: base.def * (1 + totals[I.DEF_P] / 100) + totals[I.DEF],
    impact: base.impact * (1 + totals[I.IMPACT] / 100),
    anomalyMastery: base.anomalyMastery * (1 + totals[I.ANOMALY_MASTERY] / 100),
    anomalyProficiency: base.anomalyProficiency + totals[I.ANOMALY_PROFICIENCY],
    critRate: base.critRate + totals[I.CRIT_RATE],
    critDmg: base.critDmg + totals[I.CRIT_DMG],
    penRatio: base.penRatio + totals[I.PEN_RATIO],
    pen: totals[I.PEN],
    energyRegen: base.energyRegen * (1 + totals[I.ENERGY_REGEN] / 100),
    elementDmg: totals[I.ELEMENT_DMG],
    sheerForce,
  }
}
