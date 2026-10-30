import {
  pick,
  pickDistinct,
  SAMPLE_PREFIX,
  seededRandom,
  spreadRolls,
} from 'lib/games/shared/sampleData'
import {
  FIXED_MAIN_STAT_BY_SLOT,
  MAIN_STATS_BY_SLOT,
  SUBSTAT_STATS,
} from 'lib/games/zzz/discStats'
import type {
  ImportedBuild,
  ParsedZzzExport,
} from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  type Disc,
  type DiscSlot,
  type MainStatSlot,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'
import { sMainValue } from 'lib/games/zzz/ui/discKind'

// "Try with sample data" for ZZZ: Miyabi with Hailstorm Shrine and 30 made-up S-rank +15 discs (5 per slot) from three
// sets, with random substats. Not anyone's real account. Ids start with sample- (shared/sampleData.ts)

const SETS = [
  { id: 'branch-blade-song', name: 'Branch & Blade Song' },
  { id: 'woodpecker-electro', name: 'Woodpecker Electro' },
  { id: 'polar-metal', name: 'Polar Metal' },
]

// Main stats a Miyabi build would keep, so the sample's searches have something to choose between
const MAINS: Record<MainStatSlot, ZzzStatsValues[]> = {
  4: [ZzzStats.CRIT_RATE, ZzzStats.CRIT_DMG, ZzzStats.ATK_P],
  5: [ZzzStats.ELEMENT_DMG, ZzzStats.ATK_P, ZzzStats.PEN_RATIO],
  6: [ZzzStats.ATK_P, ZzzStats.ANOMALY_MASTERY],
}

const PER_SLOT = 5
const LEVEL = 15

export function zzzSampleData(): ParsedZzzExport {
  const random = seededRandom(1091)
  const discs: Disc[] = []
  for (const slot of [1, 2, 3, 4, 5, 6] as DiscSlot[]) {
    for (let n = 0; n < PER_SLOT; n++) {
      const set = SETS[n % SETS.length]
      const main = FIXED_MAIN_STAT_BY_SLOT[slot] ?? pick(random, slot >= 4 ? MAINS[slot as MainStatSlot] : MAIN_STATS_BY_SLOT[4])
      const subs = pickDistinct(random, SUBSTAT_STATS.filter((stat) => stat !== main), 4)
      // 4 substats, then 5 upgrades at +15
      const rolls = spreadRolls(random, subs.length, 5)
      discs.push({
        id: `${SAMPLE_PREFIX}disc-${slot}-${n}`,
        slot,
        setId: set.id,
        setName: set.name,
        rarity: 'S',
        level: LEVEL,
        main: { stat: main, value: sMainValue(main, LEVEL) ?? 0 },
        substats: subs.map((stat, i) => ({ stat, rolls: rolls[i] })),
        locked: false,
      })
    }
  }
  const build: ImportedBuild = {
    id: `${SAMPLE_PREFIX}1091`,
    agentId: '1091',
    name: 'Miyabi',
    element: 'Ice',
    specialty: 'Anomaly',
    level: 60,
    mindscapeLevel: 0,
    wEngineId: '14109',
    wEngineRefinement: 1,
    // Wears the first disc of each slot
    discIds: Object.fromEntries(([1, 2, 3, 4, 5, 6] as DiscSlot[]).map((slot) => [slot, `${SAMPLE_PREFIX}disc-${slot}-0`])),
  }
  return { discs, builds: [build], warnings: [] }
}
