import {
  type StatPriority,
  statPriority,
} from 'lib/games/genshin/data/statPriorities'
import { maxRoll } from 'lib/games/genshin/goodKeys'
import {
  type Artifact,
  ARTIFACT_SLOTS,
  type ArtifactSlot,
  type GenshinCharacter,
  type GenshinStatKey,
} from 'lib/games/genshin/types'
import {
  type GearScore,
  type PieceRules,
  scoreBuild,
  scoreGear,
} from 'lib/games/shared/gearScore'

// Artifact scores (shared/gearScore.ts) for one character, with fixed weights per character like Fribbels' HSR relic
// scores: CRIT Rate and CRIT DMG 1 when crits matter, the stat they scale on 0.75 (1 without crits), its flat version a
// third of that, Energy Recharge and Elemental Mastery as data/statPriorities.ts says. Only 5-star artifacts are
// scored, like HSR.
//
// The build rating's 100% is the character's KQM Standards build (compendium.keqingmains.com): 40 average rolls, 2 of
// every substat plus 20 placed on the best stats (at most 2 per artifact, never on the main stat), with the best main
// stats. Like HSR, where 100% is the character's benchmark build.

// 4 substats, then 5 upgrades by +20; a substat is never the main stat
export const ARTIFACT_RULES: PieceRules = { substats: 4, upgrades: 5, substatCanMatchMain: false }

const SCALING_STATS: Record<'atk' | 'hp' | 'def', [GenshinStatKey, GenshinStatKey]> = {
  atk: ['atkPct', 'atk'],
  hp: ['hpPct', 'hp'],
  def: ['defPct', 'def'],
}

export function weightsFromPriority(priority: StatPriority): Record<string, number> {
  const weights: Record<string, number> = {}
  if (priority.crit) {
    weights.critRate = 1
    weights.critDmg = 1
  }
  const main = priority.crit ? 0.75 : 1
  if (priority.scaling === 'em') {
    weights.elementalMastery = main
  } else {
    const [percent, flat] = SCALING_STATS[priority.scaling]
    weights[percent] = main
    weights[flat] = Math.round((main / 3) * 100) / 100
  }
  weights.energyRecharge = priority.er ?? (priority.crit ? 0.25 : 0.5)
  if (priority.em) weights.elementalMastery = Math.max(weights.elementalMastery ?? 0, priority.em)
  return weights
}

export function genshinArtifactWeights(character: GenshinCharacter): Record<string, number> {
  return weightsFromPriority(statPriority(character.id))
}

export function scoreArtifact(artifact: Artifact, weights: Record<string, number>): GearScore | undefined {
  if (artifact.rarity !== 5) return undefined
  const substats = artifact.substats.map((sub) => ({ stat: sub.stat, units: maxRoll(sub.stat) > 0 ? sub.value / maxRoll(sub.stat) : 0 }))
  return scoreGear(substats, artifact.main.stat, weights, ARTIFACT_RULES)
}

// KQM Standards
const SUBSTATS: GenshinStatKey[] = ['hp', 'hpPct', 'atk', 'atkPct', 'def', 'defPct', 'elementalMastery', 'critRate', 'critDmg', 'energyRecharge']
// An average roll against a max roll: rolls are 70, 80, 90 or 100% of the highest
const AVERAGE_ROLL = 0.85
const MAIN_OPTIONS: Record<ArtifactSlot, GenshinStatKey[]> = {
  flower: ['hp'],
  plume: ['atk'],
  sands: ['atkPct', 'hpPct', 'defPct', 'elementalMastery', 'energyRecharge'],
  // An element's DMG Bonus stands for every DMG goblet: it's never a substat
  goblet: ['pyroDmg', 'atkPct', 'hpPct', 'defPct', 'elementalMastery'],
  circlet: ['critRate', 'critDmg', 'atkPct', 'hpPct', 'defPct', 'elementalMastery', 'healingBonus'],
}

function kqmsAverage(weights: Record<string, number>, mains: GenshinStatKey[]): number {
  const pieces = mains.map((main) => ({ main, rolls: {} as Record<string, number> }))
  const add = (piece: (typeof pieces)[number], stat: string, rolls: number) => piece.rolls[stat] = (piece.rolls[stat] ?? 0) + rolls
  // 2 fixed rolls of every substat, on the artifacts with the fewest so far
  for (const stat of SUBSTATS) {
    for (let i = 0; i < 2; i++) {
      const open = pieces.filter((p) => p.main !== stat).sort((a, b) => Object.keys(a.rolls).length - Object.keys(b.rolls).length)
      if (open[0]) add(open[0], stat, 1)
    }
  }
  // 20 more on the best stats, at most 2 per artifact
  let left = 20
  for (const stat of SUBSTATS.filter((s) => (weights[s] ?? 0) > 0).sort((a, b) => weights[b] - weights[a])) {
    for (const piece of pieces) {
      if (left === 0 || piece.main === stat) continue
      const rolls = Math.min(2, left)
      add(piece, stat, rolls)
      left -= rolls
    }
  }
  const scores = pieces.map((p) =>
    scoreGear(Object.entries(p.rolls).map(([stat, rolls]) => ({ stat, units: rolls * AVERAGE_ROLL })), p.main, weights, ARTIFACT_RULES)?.percent ?? 0
  )
  return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

const benchmarkCache = new Map<string, number>()

// The average artifact score of the character's KQM Standards build, with whichever main stats score best
export function kqmsBenchmark(weights: Record<string, number>): number {
  const key = JSON.stringify(weights)
  const cached = benchmarkCache.get(key)
  if (cached !== undefined) return cached
  let best = 0
  for (const sands of MAIN_OPTIONS.sands) {
    for (const goblet of MAIN_OPTIONS.goblet) {
      for (const circlet of MAIN_OPTIONS.circlet) best = Math.max(best, kqmsAverage(weights, ['hp', 'atk', sands, goblet, circlet]))
    }
  }
  benchmarkCache.set(key, best)
  return best
}

// The worn artifacts' rating against the character's KQM Standards build (100%)
export function genshinBuildScore(character: GenshinCharacter, worn: Artifact[]): GearScore | undefined {
  const weights = genshinArtifactWeights(character)
  return scoreBuild(worn.map((artifact) => scoreArtifact(artifact, weights)), ARTIFACT_SLOTS.length, kqmsBenchmark(weights))
}
