import type { ZzzStatsValues } from 'lib/games/zzz/types'

export type Specialty = 'Attack' | 'Stun' | 'Anomaly' | 'Support' | 'Defense' | 'Rupture'

// Situations a conditional effect can depend on
export type Condition = 'onField' | 'inEtherVeil' | 'veilTriggered'
export type ActiveConditions = Record<Condition, boolean>

// confirmed = matched against the in-game stat screen, sourced = from community data, unverified = single or older source
export type Confidence = 'confirmed' | 'sourced' | 'unverified'

export type StatEffect = {
  stat: ZzzStatsValues,
  value: number,
  // Omitted means the effect always applies
  when?: Condition,
  // Only applies to agents of this specialty
  specialty?: Specialty,
  // Only applies to agents of this element, used for element-specific DMG bonuses
  element?: string,
  source: string,
  confidence: Confidence,
}

export type AgentBaseStats = {
  hp: number,
  atk: number,
  def: number,
  impact: number,
  critRate: number,
  critDmg: number,
  anomalyMastery: number,
  anomalyProficiency: number,
  penRatio: number,
  energyRegen: number,
}

export type AgentData = {
  id: string,
  name: string,
  element: string,
  specialty: Specialty,
  // Base stats are for this level, with Core Skill bonuses to base stats included
  level: number,
  base: AgentBaseStats,
  // Rupture agents only: Sheer Force per point of final ATK and max HP. Unverified against the stat screen
  sheerForce?: { fromAtk: number, fromHp: number },
  // Core Skill effects by Core Skill level (1 = A ... 6 = F)
  coreEffects: Record<number, StatEffect[]>,
}

export type WEngineData = {
  id: string,
  name: string,
  rarity: 'S' | 'A' | 'B',
  specialty: Specialty,
  baseAtk: number,
  subStat: { stat: ZzzStatsValues, value: number },
  passive: (refinement: number) => StatEffect[],
}

export type SetData = {
  id: string,
  name: string,
  twoPiece: StatEffect[],
  fourPiece: StatEffect[],
  // False when the 4-piece has effects that this model doesn't represent yet
  fourPieceModeled: boolean,
}
