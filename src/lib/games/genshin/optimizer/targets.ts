import type { OptimizerTarget } from 'lib/games/genshin/optimizer/artifactOptimizer'
import type {
  Element,
  GenshinStatKey,
} from 'lib/games/genshin/types'
import { readOptimizerSettings } from 'lib/games/shared/optimizerSettings'

// What the Genshin optimizer can rank by, and each character's saved choice. The optimizer page and the artifact score
// (stats/artifactScore.ts) both use them, so a score follows what the character is ranked by

export const GENSHIN_SETTINGS_KEY = 'genshin-optimizer-settings'

const SHOWN: GenshinStatKey[] = ['hp', 'atk', 'def', 'elementalMastery', 'critRate', 'critDmg', 'energyRecharge']

// Targets as Select values
export const GENSHIN_TARGETS: { value: string, target: OptimizerTarget }[] = [
  { value: 'avg:atk', target: { kind: 'averageHit', stat: 'atk' } },
  { value: 'avg:hp', target: { kind: 'averageHit', stat: 'hp' } },
  { value: 'avg:def', target: { kind: 'averageHit', stat: 'def' } },
  { value: 'avg:elementalMastery', target: { kind: 'averageHit', stat: 'elementalMastery' } },
  { value: 'cv', target: { kind: 'critValue' } },
  ...SHOWN.map((stat) => ({ value: `stat:${stat}`, target: { kind: 'stat', stat } as OptimizerTarget })),
  ...(['pyroDmg', 'hydroDmg', 'anemoDmg', 'electroDmg', 'dendroDmg', 'cryoDmg', 'geoDmg', 'physicalDmg', 'healingBonus'] as GenshinStatKey[])
    .map((stat) => ({ value: `stat:${stat}`, target: { kind: 'stat', stat } as OptimizerTarget })),
]

// A Select value as a target; the average hit counts the character's own element's DMG Bonus
export function genshinTarget(value: string, element: Element | undefined): OptimizerTarget {
  const picked = GENSHIN_TARGETS.find((t) => t.value === value)?.target ?? GENSHIN_TARGETS[0].target
  return picked.kind === 'averageHit' ? { ...picked, element } : picked
}

// What this character is ranked by in the optimizer, the average ATK hit until it's changed there
export function savedGenshinTarget(characterId: string, element: Element | undefined): OptimizerTarget {
  const value = readOptimizerSettings(GENSHIN_SETTINGS_KEY).byCharacter[characterId]?.targetValue
  return genshinTarget(typeof value === 'string' ? value : 'avg:atk', element)
}
