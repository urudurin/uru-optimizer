import {
  type GearScore,
  type PieceRules,
  scoreGear,
  weightsFromPriority,
} from 'lib/games/shared/gearScore'
import type { AgentData } from 'lib/games/zzz/data/dataTypes'
import { getPreset } from 'lib/games/zzz/data/presets'
import type { Disc } from 'lib/games/zzz/types'

// Disc scores (shared/gearScore.ts) for one agent, weighted by their build preset's substat priority (best first:
// 1, 0.8, 0.6, 0.4, 0.2), like HSR's character weights. Only S-rank discs are scored, like HSR's 5-star relics.

// 4 substats, then 5 upgrades by +15; a substat is never the main stat
export const DISC_RULES: PieceRules = { substats: 4, upgrades: 5, substatCanMatchMain: false }

export function zzzDiscWeights(agent: AgentData): Record<string, number> {
  return weightsFromPriority(getPreset(agent).substatPriority)
}

export function scoreDisc(disc: Disc, weights: Record<string, number>): GearScore | undefined {
  if (disc.rarity !== 'S') return undefined
  return scoreGear(disc.substats.map((sub) => ({ stat: sub.stat, units: sub.rolls })), disc.main.stat, weights, DISC_RULES)
}
