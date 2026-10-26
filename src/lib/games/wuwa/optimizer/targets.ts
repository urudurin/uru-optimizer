import { readOptimizerSettings } from 'lib/games/shared/optimizerSettings'
import type { EchoTarget } from 'lib/games/wuwa/optimizer/echoOptimizer'
import type { WuwaStats } from 'lib/games/wuwa/stats/computeStats'

// What the WuWa optimizer can rank by, and each Resonator's saved choice. The optimizer page and the echo score
// (stats/echoScore.ts) both use them, so a score follows what the Resonator is ranked by

export const WUWA_SETTINGS_KEY = 'wuwa-optimizer-settings'

// Targets as Select values
export const WUWA_TARGETS: { value: string, target: EchoTarget }[] = [
  { value: 'avg:atk', target: { kind: 'averageHit', stat: 'atk', bonus: 'none' } },
  { value: 'avg:atk:skillDmg', target: { kind: 'averageHit', stat: 'atk', bonus: 'skillDmg' } },
  { value: 'avg:atk:libDmg', target: { kind: 'averageHit', stat: 'atk', bonus: 'libDmg' } },
  { value: 'avg:atk:basicDmg', target: { kind: 'averageHit', stat: 'atk', bonus: 'basicDmg' } },
  { value: 'avg:atk:heavyDmg', target: { kind: 'averageHit', stat: 'atk', bonus: 'heavyDmg' } },
  { value: 'avg:hp', target: { kind: 'averageHit', stat: 'hp', bonus: 'none' } },
  { value: 'avg:def', target: { kind: 'averageHit', stat: 'def', bonus: 'none' } },
  { value: 'cv', target: { kind: 'critValue' } },
  ...(['atk', 'hp', 'def', 'critRate', 'critDmg', 'energyRegen', 'elementDmg', 'healingBonus'] as (keyof WuwaStats)[])
    .map((stat) => ({ value: `stat:${stat}`, target: { kind: 'stat', stat } as EchoTarget })),
]

export function wuwaTarget(value: string): EchoTarget {
  return WUWA_TARGETS.find((t) => t.value === value)?.target ?? WUWA_TARGETS[0].target
}

// What this Resonator is ranked by in the optimizer, the average ATK hit until it's changed there
export function savedWuwaTarget(charId: string): EchoTarget {
  const value = readOptimizerSettings(WUWA_SETTINGS_KEY).byCharacter[charId]?.targetValue
  return wuwaTarget(typeof value === 'string' ? value : 'avg:atk')
}
