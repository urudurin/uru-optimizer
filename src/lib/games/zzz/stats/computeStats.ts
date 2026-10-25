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
}

export type ComputeResult = {
  stats: FinalStats,
  contributions: Contribution[],
  // Anything that stopped the result from being complete, never silently ignored
  warnings: string[],
}

export function defaultConditions(): ActiveConditions {
  return { onField: true, inEtherVeil: false, veilTriggered: false }
}

// What the in-game agent stat screen shows: out of combat, so nothing that needs the agent on the field or an Ether Veil applies
export function statScreenConditions(): ActiveConditions {
  return { onField: false, inEtherVeil: false, veilTriggered: false }
}

export function roundHalfUp(value: number, digits = 0): number {
  const factor = 10 ** digits
  // The small epsilon keeps values like 1.005 from rounding down because of float representation
  return Math.round((value + Number.EPSILON) * factor) / factor
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

function effectApplies(effect: StatEffect, input: ComputeInput): boolean {
  if (effect.when && !input.conditions[effect.when]) return false
  if (effect.specialty && effect.specialty !== input.agent.specialty) return false
  if (effect.element && effect.element !== input.agent.element) return false
  return true
}

export function computeStats(input: ComputeInput): ComputeResult {
  const { agent, wEngine, discs } = input
  const contributions: Contribution[] = []
  const warnings: string[] = []

  const addEffects = (effects: StatEffect[]) => {
    for (const effect of effects) {
      if (!effectApplies(effect, input)) continue
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

  const total = (stat: ZzzStatsValues) => contributions.reduce((sum, c) => c.stat === stat ? sum + c.value : sum, 0)
  const percent = (stat: ZzzStatsValues) => 1 + total(stat) / 100

  const hp = agent.base.hp * percent(ZzzStats.HP_P) + total(ZzzStats.HP)
  const atk = (agent.base.atk + wEngine.baseAtk) * percent(ZzzStats.ATK_P) + total(ZzzStats.ATK)
  // Each part is rounded down, without that a Yixuan screenshot comes out one point high
  const sheerForce = agent.sheerForce
    ? Math.floor(atk * agent.sheerForce.fromAtk) + Math.floor(hp * agent.sheerForce.fromHp)
    : 0

  const stats: FinalStats = {
    hp,
    atk,
    def: agent.base.def * percent(ZzzStats.DEF_P) + total(ZzzStats.DEF),
    impact: agent.base.impact * percent(ZzzStats.IMPACT),
    anomalyMastery: agent.base.anomalyMastery * percent(ZzzStats.ANOMALY_MASTERY),
    anomalyProficiency: agent.base.anomalyProficiency + total(ZzzStats.ANOMALY_PROFICIENCY),
    critRate: agent.base.critRate + total(ZzzStats.CRIT_RATE),
    critDmg: agent.base.critDmg + total(ZzzStats.CRIT_DMG),
    penRatio: agent.base.penRatio + total(ZzzStats.PEN_RATIO),
    pen: total(ZzzStats.PEN),
    energyRegen: agent.base.energyRegen * percent(ZzzStats.ENERGY_REGEN),
    elementDmg: total(ZzzStats.ELEMENT_DMG),
    sheerForce,
  }

  return { stats, contributions, warnings }
}
