import {
  pick,
  pickDistinct,
  SAMPLE_PREFIX,
  seededRandom,
} from 'lib/games/shared/sampleData'
import {
  SUBSTAT_KEYS,
  SUBSTAT_TIERS,
} from 'lib/games/wuwa/echoStats'
import type { ParsedWuwaData } from 'lib/games/wuwa/importer/userDataParser'
import type {
  CharacterState,
  Cost,
  Echo,
  StatKey,
} from 'lib/games/wuwa/types'

// "Try with sample data" for WuWa: Hsin with Blooming Jadehaven and 15 made-up +25 Void Thunder echoes (3 cost-4, 5
// cost-3, 7 cost-1), random substats. Not anyone's real account. Ids start with sample- (shared/sampleData.ts)

const ECHOES: { defId: string, cost: Cost, mains: StatKey[] }[] = [
  { defId: 'nightmare-thundering-mephis', cost: 4, mains: ['critRate'] },
  { defId: 'thundering-mephis', cost: 4, mains: ['critDmg'] },
  { defId: 'nightmare-tempest-mephis', cost: 4, mains: ['critRate'] },
  { defId: 'flautist', cost: 3, mains: ['electroDmg'] },
  { defId: 'lumiscale-construct', cost: 3, mains: ['electroDmg'] },
  { defId: 'violet-feathered-heron', cost: 3, mains: ['atkPct'] },
  { defId: 'phantom-lumiscale-construct', cost: 3, mains: ['electroDmg'] },
  { defId: 'flautist', cost: 3, mains: ['energyRegen'] },
  { defId: 'electro-predator', cost: 1, mains: ['atkPct'] },
  { defId: 'fission-junrock', cost: 1, mains: ['atkPct'] },
  { defId: 'aero-predator', cost: 1, mains: ['atkPct'] },
  { defId: 'havoc-prism', cost: 1, mains: ['atkPct'] },
  { defId: 'spectro-prism', cost: 1, mains: ['hpPct'] },
  { defId: 'fusion-warrior', cost: 1, mains: ['atkPct'] },
  { defId: 'vanguard-junrock', cost: 1, mains: ['atkPct'] },
]

export function wuwaSampleData(): ParsedWuwaData {
  const random = seededRandom(1311)
  const echoes: Echo[] = ECHOES.map(({ defId, cost, mains }, i) => ({
    id: `${SAMPLE_PREFIX}echo-${i}`,
    defId,
    cost,
    setId: 'void-thunder',
    mainStat: pick(random, mains),
    level: 25,
    // Five different substats, each one of its rollable tiers
    substats: pickDistinct(random, SUBSTAT_KEYS, 5).map((stat) => ({ stat, value: pick(random, SUBSTAT_TIERS[stat]) })),
  }))
  const hsin: CharacterState = {
    charId: 'hsin',
    level: 90,
    sequence: 0,
    weaponId: 'blooming-jadehaven',
    weaponLevel: 90,
    refinement: 1,
    minorFortes: true,
    // 4 + 3 + 3 + 1 + 1, the main echo first
    echoIds: [echoes[0].id, echoes[3].id, echoes[4].id, echoes[8].id, echoes[9].id],
  }
  return { echoes, characters: [hsin], teams: [], priority: ['hsin'], warnings: [] }
}
