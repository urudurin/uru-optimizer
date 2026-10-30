import type { GenshinData } from 'lib/games/genshin/state/genshinState'
import {
  type Artifact,
  ARTIFACT_SLOTS,
  type ArtifactSlot,
  type GenshinCharacter,
  type GenshinStatKey,
} from 'lib/games/genshin/types'
import {
  pick,
  pickDistinct,
  SAMPLE_PREFIX,
  seededRandom,
  spreadRolls,
} from 'lib/games/shared/sampleData'

// "Try with sample data" for Genshin: Xiangling with The Catch R5 and 25 made-up 5-star +20 artifacts (5 per slot) from
// Emblem of Severed Fate and Crimson Witch of Flames, random substats. Not anyone's real account. Ids start with
// sample- (shared/sampleData.ts)

// 5-star +20 main stat values, as the game shows them
const MAIN_VALUES: Partial<Record<GenshinStatKey, number>> = {
  hp: 4780,
  atk: 311,
  atkPct: 46.6,
  hpPct: 46.6,
  energyRecharge: 51.8,
  elementalMastery: 186.5,
  pyroDmg: 46.6,
  critRate: 31.1,
  critDmg: 62.2,
}

const MAINS: Record<ArtifactSlot, GenshinStatKey[]> = {
  flower: ['hp'],
  plume: ['atk'],
  sands: ['atkPct', 'energyRecharge', 'elementalMastery'],
  goblet: ['pyroDmg', 'atkPct'],
  circlet: ['critRate', 'critDmg'],
}

// 5-star substat roll values at the top tier; each roll is 70%, 80%, 90% or 100% of it
const MAX_ROLL: Partial<Record<GenshinStatKey, number>> = {
  hp: 298.75,
  atk: 19.45,
  def: 23.15,
  hpPct: 5.83,
  atkPct: 5.83,
  defPct: 7.29,
  elementalMastery: 23.31,
  energyRecharge: 6.48,
  critRate: 3.89,
  critDmg: 7.77,
}
const SUBSTATS = Object.keys(MAX_ROLL) as GenshinStatKey[]
const FLAT = new Set<GenshinStatKey>(['hp', 'atk', 'def', 'elementalMastery'])

const SETS = [
  { id: 'EmblemOfSeveredFate', name: 'Emblem of Severed Fate' },
  { id: 'CrimsonWitchOfFlames', name: 'Crimson Witch of Flames' },
]

const PER_SLOT = 5

export function genshinSampleData(): GenshinData & { warnings: string[] } {
  const random = seededRandom(1029)
  const artifacts: Artifact[] = ARTIFACT_SLOTS.flatMap((slot) =>
    Array.from({ length: PER_SLOT }, (_, n): Artifact => {
      const main = pick(random, MAINS[slot])
      const subs = pickDistinct(random, SUBSTATS.filter((stat) => stat !== main), 4)
      // 4 substats, then 5 upgrades at +20
      const rolls = spreadRolls(random, subs.length, 5)
      const set = SETS[n % SETS.length]
      return {
        id: `${SAMPLE_PREFIX}artifact-${slot}-${n}`,
        slot,
        setId: set.id,
        setName: set.name,
        rarity: 5,
        level: 20,
        main: { stat: main, value: MAIN_VALUES[main] ?? 0 },
        substats: subs.map((stat, i) => {
          const value = Array.from({ length: rolls[i] }, () => pick(random, [0.7, 0.8, 0.9, 1])).reduce((sum, tier) => sum + tier, 0)
            * (MAX_ROLL[stat] ?? 0)
          return { stat, value: FLAT.has(stat) ? Math.round(value) : Math.round(value * 10) / 10, rolls: rolls[i] }
        }),
        // Xiangling wears the first artifact of each slot
        ...(n === 0 ? { equippedBy: 'Xiangling' } : {}),
      }
    })
  )
  const xiangling: GenshinCharacter = {
    id: 'Xiangling',
    name: 'Xiangling',
    element: 'Pyro',
    level: 90,
    ascension: 6,
    constellation: 6,
    talents: { auto: 9, skill: 9, burst: 9 },
    weapon: { id: 'TheCatch', name: 'The Catch', rarity: 4, level: 90, ascension: 6, refinement: 5 },
    // Wears the first artifact of each slot
    artifactIds: Object.fromEntries(ARTIFACT_SLOTS.map((slot) => [slot, `${SAMPLE_PREFIX}artifact-${slot}-0`])),
    stats: {},
    statsDate: '',
  }
  return { artifacts, characters: [xiangling], warnings: [] }
}
