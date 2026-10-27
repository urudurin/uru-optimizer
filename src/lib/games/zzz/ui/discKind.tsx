import {
  type GearDraft,
  type GearKind,
  newGearId,
} from 'lib/games/shared/gear/gearKind'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type { ZzzImages } from 'lib/games/zzz/data/images'
import { SETS } from 'lib/games/zzz/data/sets'
import {
  FIXED_MAIN_STAT_BY_SLOT,
  getSubstatValue,
  MAIN_STATS_BY_SLOT,
  SUBSTAT_STATS,
} from 'lib/games/zzz/discStats'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  scoreDisc,
  zzzDiscWeights,
} from 'lib/games/zzz/stats/discScore'
import {
  type Disc,
  type DiscRarity,
  type DiscSlot,
  type MainStatSlot,
  MAX_DISC_LEVEL,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'
import { DiscCard } from 'lib/games/zzz/ui/DiscCard'

// ZZZ discs for the shared gear inventory (shared/gear/gearKind.ts). The editor makes S-rank discs only: their roll
// values (discStats.ts) and main stat values are the ones known. Substats are entered as roll counts, shown as values.

// S-rank main stats at +15. A main stat is a quarter of that at +0 and grows 20% of the +0 value per level, like the
// importer works it out (importer/enkaParser.ts)
const S_MAIN_AT_MAX: Partial<Record<ZzzStatsValues, number>> = {
  [ZzzStats.HP]: 2200,
  [ZzzStats.ATK]: 316,
  [ZzzStats.DEF]: 184,
  [ZzzStats.HP_P]: 30,
  [ZzzStats.ATK_P]: 30,
  [ZzzStats.DEF_P]: 48,
  [ZzzStats.CRIT_RATE]: 24,
  [ZzzStats.CRIT_DMG]: 48,
  [ZzzStats.ANOMALY_PROFICIENCY]: 92,
  [ZzzStats.PEN_RATIO]: 24,
  [ZzzStats.ELEMENT_DMG]: 30,
  [ZzzStats.ANOMALY_MASTERY]: 30,
  [ZzzStats.IMPACT]: 18,
  [ZzzStats.ENERGY_REGEN]: 60,
}

const FLAT_STATS = new Set<string>([ZzzStats.HP, ZzzStats.ATK, ZzzStats.DEF, ZzzStats.PEN, ZzzStats.ANOMALY_PROFICIENCY])

export function sMainValue(stat: ZzzStatsValues, level: number): number | undefined {
  const max = S_MAIN_AT_MAX[stat]
  if (max === undefined) return undefined
  const value = (max / 4) * (1 + 0.2 * level)
  return FLAT_STATS.has(stat) ? Math.floor(value) : Math.round(value * 10) / 10
}

const formatValue = (stat: string, value: number) => (FLAT_STATS.has(stat) ? String(Math.round(value)) : `${Math.round(value * 10) / 10}%`)

// Every disc has 4 substats once levelled; 3 or 4 at +0, and one roll every 3 levels
const maxRolls = (level: number) => 4 + Math.floor(level / 3)

// A disc with this many max rolls of one stat is the top of that stat's colour scale
const COLUMN_TOP_ROLLS = 5

function mainStatsFor(slot: string): ZzzStatsValues[] {
  const n = Number(slot) as DiscSlot
  const fixed = FIXED_MAIN_STAT_BY_SLOT[n]
  return fixed ? [fixed] : MAIN_STATS_BY_SLOT[n as MainStatSlot] ?? []
}

export function zzzDiscKind({ builds, images, discs }: { builds: ImportedBuild[], images: ZzzImages, discs: Disc[] }): GearKind<Disc> {
  const ownerNames = new Map(builds.map((b) => [b.agentId, b.name]))
  const setNames = new Map<string, string>([
    ...Object.values(SETS).map((set) => [set.id, set.name] as [string, string]),
    ...Object.entries(images.setNames),
    ...discs.map((d) => [d.setId, d.setName] as [string, string]),
  ])
  const setOptions = [...setNames].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))

  return {
    noun: 'Disc',
    slots: [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Slot ${n}` })),
    slotOf: (disc) => String(disc.slot),
    sets: () => setOptions,
    setOf: (disc) => disc.setId,
    setName: (disc) => disc.setName,
    setIcon: (disc) => images.sets[disc.setId],
    rarities: (['S', 'A', 'B'] as DiscRarity[]).map((r) => ({ value: r, label: `${r}-rank` })),
    rarityOf: (disc) => disc.rarity,
    levelOf: (disc) => disc.level,
    mainStatOf: (disc) => disc.main.stat,
    mainValueText: (disc) => formatValue(disc.main.stat, disc.main.value),
    substats: SUBSTAT_STATS.map((stat) => ({ value: stat, label: stat })),
    substatValues: (disc) => Object.fromEntries(disc.substats.map((sub) => [sub.stat, getSubstatValue(disc.rarity, sub.stat, sub.rolls) ?? 0])),
    columnTop: (stat) => (getSubstatValue('S', stat as ZzzStatsValues, COLUMN_TOP_ROLLS) ?? 1),
    formatValue,
    statLabel: (stat) => stat,
    ownerOf: (disc) => disc.equippedBy,
    ownerName: (id) => ownerNames.get(id) ?? AGENTS[id]?.name ?? `Agent ${id}`,
    score: (disc) => {
      const agent = disc.equippedBy ? AGENTS[disc.equippedBy] : undefined
      return agent ? scoreDisc(disc, zzzDiscWeights(agent)) : undefined
    },
    preview: (disc) => (
      <DiscCard
        disc={disc}
        icon={images.sets[disc.setId]}
        owner={disc.equippedBy ? ownerNames.get(disc.equippedBy) : undefined}
        score={disc.equippedBy && AGENTS[disc.equippedBy] ? scoreDisc(disc, zzzDiscWeights(AGENTS[disc.equippedBy])) : undefined}
      />
    ),

    maxLevel: () => MAX_DISC_LEVEL,
    substatCount: 4,
    substatCanMatchMain: false,
    mainStats: (draft) => mainStatsFor(draft.slot).map((stat) => ({ value: stat, label: stat })),
    mainValuePreview: (draft) => {
      const value = sMainValue(draft.mainStat as ZzzStatsValues, draft.level)
      return value === undefined ? '—' : formatValue(draft.mainStat, value)
    },
    substatChoices: (_draft, stat) =>
      [1, 2, 3, 4, 5, 6].map((rolls) => {
        const value = getSubstatValue('S', stat as ZzzStatsValues, rolls)
        return { value: String(rolls), label: `${value === undefined ? '?' : formatValue(stat, value)} (${rolls} roll${rolls === 1 ? '' : 's'})` }
      }),
    newDraft: () => ({ slot: '1', setId: setOptions[0]?.value ?? '', rarity: 'S', level: MAX_DISC_LEVEL, mainStat: ZzzStats.HP, substats: [], extra: {} }),
    toDraft: (disc) => ({
      slot: String(disc.slot),
      setId: disc.setId,
      rarity: disc.rarity,
      level: disc.level,
      mainStat: disc.main.stat,
      substats: disc.substats.map((sub) => ({ stat: sub.stat, value: sub.rolls })),
      extra: {},
    }),
    fromDraft: (draft: GearDraft, existing?: Disc) => {
      const errors: string[] = []
      if (draft.rarity !== 'S') errors.push('Only S-rank discs can be added or edited here: the other rarities\' roll values aren\'t known yet')
      if (!draft.setId) errors.push('Pick a set')
      if (draft.level < 0 || draft.level > MAX_DISC_LEVEL) errors.push(`Level must be from 0 to ${MAX_DISC_LEVEL}`)
      const main = draft.mainStat as ZzzStatsValues
      if (!mainStatsFor(draft.slot).includes(main)) errors.push(`${main} can't be the main stat of slot ${draft.slot}`)
      const subs = draft.substats.filter((s) => s.stat)
      if (subs.some((s) => s.stat === main)) errors.push('A substat can\'t be the same as the main stat')
      if (subs.some((s) => !s.value)) errors.push('Every substat needs a value')
      const rolls = subs.reduce((sum, s) => sum + s.value, 0)
      if (subs.length < 3) errors.push('A disc has at least 3 substats')
      if (draft.level >= 3 && subs.length < 4) errors.push('A disc past +3 has 4 substats')
      if (rolls > maxRolls(draft.level)) errors.push(`A +${draft.level} disc has at most ${maxRolls(draft.level)} substat rolls in total, this has ${rolls}`)
      const mainValue = sMainValue(main, draft.level)
      if (errors.length > 0 || mainValue === undefined) return { errors }
      const disc: Disc = {
        id: existing?.id ?? newGearId('disc'),
        slot: Number(draft.slot) as DiscSlot,
        setId: draft.setId,
        setName: setNames.get(draft.setId) ?? draft.setId,
        rarity: 'S',
        level: draft.level,
        main: { stat: main, value: mainValue },
        substats: subs.map((s) => ({ stat: s.stat as ZzzStatsValues, rolls: s.value })),
        locked: existing?.locked ?? false,
        ...(existing?.equippedBy ? { equippedBy: existing.equippedBy } : {}),
      }
      return { item: disc, errors: [] }
    },
  }
}
