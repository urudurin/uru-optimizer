import { maxRoll } from 'lib/games/genshin/goodKeys'
import { genshinSubstatUpgrades } from 'lib/games/genshin/optimizer/analysis'
import type { OptimizerTarget } from 'lib/games/genshin/optimizer/artifactOptimizer'
import { savedGenshinTarget } from 'lib/games/genshin/optimizer/targets'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import {
  type GearScore,
  type PieceRules,
  scoreGear,
  weightsFromUpgrades,
} from 'lib/games/shared/gearScore'

// Artifact scores (shared/gearScore.ts) for one character. Each substat's weight is how much one more roll of it raises
// what the character is ranked by in the optimizer (their saved target, the average ATK hit by default), on the
// artifacts they wear now. Only 5-star artifacts are scored, like HSR.

// 4 substats, then 5 upgrades by +20; a substat is never the main stat
export const ARTIFACT_RULES: PieceRules = { substats: 4, upgrades: 5, substatCanMatchMain: false }

export function genshinArtifactWeights(character: GenshinCharacter, worn: Artifact[], target?: OptimizerTarget): Record<string, number> {
  return weightsFromUpgrades(genshinSubstatUpgrades(character, worn, target ?? savedGenshinTarget(character.id, character.element)))
}

export function scoreArtifact(artifact: Artifact, weights: Record<string, number>): GearScore | undefined {
  if (artifact.rarity !== 5) return undefined
  const substats = artifact.substats.map((sub) => ({ stat: sub.stat, units: maxRoll(sub.stat) > 0 ? sub.value / maxRoll(sub.stat) : 0 }))
  return scoreGear(substats, artifact.main.stat, weights, ARTIFACT_RULES)
}
