import {
  type GearScore,
  type PieceRules,
  scoreGear,
  weightsFromUpgrades,
} from 'lib/games/shared/gearScore'
import { maxRoll } from 'lib/games/wuwa/echoStats'
import { wuwaSubstatUpgrades } from 'lib/games/wuwa/optimizer/analysis'
import type { EchoTarget } from 'lib/games/wuwa/optimizer/echoOptimizer'
import { savedWuwaTarget } from 'lib/games/wuwa/optimizer/targets'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'

// Echo scores (shared/gearScore.ts) for one Resonator. Each substat's weight is how much one more roll of it raises what
// the Resonator is ranked by in the optimizer (their saved target, the average ATK hit by default), on the echoes they
// wear now. Substats count in max rolls, so a top-tier roll is 1.

// 5 substats rolled once each; a substat can be the same stat as the main stat
export const ECHO_RULES: PieceRules = { substats: 5, upgrades: 0, substatCanMatchMain: true }

export function wuwaEchoWeights(character: CharacterState, worn: Echo[], target?: EchoTarget): Record<string, number> {
  return weightsFromUpgrades(wuwaSubstatUpgrades(character, worn, target ?? savedWuwaTarget(character.charId)))
}

export function scoreEcho(echo: Echo, weights: Record<string, number>): GearScore | undefined {
  const substats = echo.substats.map((sub) => ({ stat: sub.stat, units: sub.value / maxRoll(sub.stat) }))
  return scoreGear(substats, echo.mainStat, weights, ECHO_RULES)
}
