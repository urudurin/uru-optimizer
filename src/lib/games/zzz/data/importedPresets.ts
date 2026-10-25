import type { GameId } from 'lib/games/games'
import {
  isDateString,
  parsePresetFile,
  type StoredPresetImport,
} from 'lib/games/shared/importedPresets'
import type { AgentData } from 'lib/games/zzz/data/dataTypes'
import {
  type BuildPreset,
  getPreset,
  type SetChoice,
} from 'lib/games/zzz/data/presets'
import { SETS } from 'lib/games/zzz/data/sets'
import { MAIN_STATS_BY_SLOT } from 'lib/games/zzz/discStats'
import {
  parseStat,
  slugifySetName,
} from 'lib/games/zzz/importer/zzzBuildsExportParser'
import { STAT_ROWS } from 'lib/games/zzz/statLabels'
import type { FinalStats } from 'lib/games/zzz/stats/computeStats'
import {
  type MainStatSlot,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Turns an imported preset file (see shared/importedPresets.ts) into ZZZ build presets. Each entry looks like:
// {
//   "character": "Miyabi",                                   agent name or id
//   "sets": [{ "fourPiece": "Branch & Blade Song", "twoPiece": "Woodpecker Electro" }],
//   "mainStats": { "4": ["CRIT Rate"], "5": ["Element DMG%", "ATK%"], "6": ["ATK%"] },
//   "substatPriority": ["CRIT Rate", "CRIT DMG", "ATK%"],
//   "rankBy": "critDmg", "thenBy": ["critRate", "atk"],         optional, the built-in preset's ranking otherwise
//   "notes": "Anything worth remembering"
// }
// Stat names can be written as the stats panel shows them ("CRIT Rate", "ATK%") or as the builds export writes them
// ("CRIT_Rate"). Set names can be the in-game name or the set id. Never throws: bad parts are skipped with a warning.

const GAME: GameId = 'zzz'
const STAT_LABEL_VALUES = new Set<string>(Object.values(ZzzStats))
const RANKABLE = new Set<string>(STAT_ROWS.map((row) => row.key))

export type ImportedZzzPresets = {
  source: string,
  // By agent id
  presets: Record<string, BuildPreset>,
  warnings: string[],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStat(value: unknown): ZzzStatsValues | undefined {
  if (typeof value === 'string' && STAT_LABEL_VALUES.has(value)) return value as ZzzStatsValues
  return parseStat(value)
}

function toSetId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  return SETS[value] ? value : slugifySetName(value)
}

function findAgent(value: unknown, agents: AgentData[]): AgentData | undefined {
  if (typeof value === 'number') value = String(value)
  if (typeof value !== 'string') return undefined
  const wanted = value.trim().toLowerCase()
  return agents.find((agent) => agent.id === wanted || agent.name.toLowerCase() === wanted)
}

function parseEntry(raw: unknown, index: number, agents: AgentData[], source: string, reviewed: string, warnings: string[]) {
  const label = `Preset ${index + 1}`
  if (!isRecord(raw)) {
    warnings.push(`${label}: not an object, skipped`)
    return undefined
  }
  const agent = findAgent(raw.character, agents)
  if (!agent) {
    warnings.push(`${label}: no agent data for "${String(raw.character)}" yet, skipped`)
    return undefined
  }
  const name = agent.name
  const fallback = getPreset(agent)

  const sets: SetChoice[] = []
  for (const choice of Array.isArray(raw.sets) ? raw.sets : []) {
    const fourPiece = isRecord(choice) ? toSetId(choice.fourPiece) : undefined
    if (!fourPiece) {
      warnings.push(`${name}: a set choice has no "fourPiece", skipped`)
      continue
    }
    const twoPiece = isRecord(choice) ? toSetId(choice.twoPiece) : undefined
    for (const id of [fourPiece, twoPiece]) {
      if (id && !SETS[id]) warnings.push(`${name}: no set data for "${id}" yet, its bonuses won't be counted`)
    }
    sets.push(twoPiece ? { fourPiece, twoPiece } : { fourPiece })
  }

  const mainStats = { 4: [], 5: [], 6: [] } as Record<MainStatSlot, ZzzStatsValues[]>
  const rawMain = isRecord(raw.mainStats) ? raw.mainStats : {}
  for (const slot of [4, 5, 6] as MainStatSlot[]) {
    const listed = rawMain[String(slot)]
    for (const value of Array.isArray(listed) ? listed : []) {
      const stat = toStat(value)
      if (stat && MAIN_STATS_BY_SLOT[slot].includes(stat)) mainStats[slot].push(stat)
      else warnings.push(`${name}: "${String(value)}" can't be a slot ${slot} main stat, skipped`)
    }
  }

  const substatPriority: ZzzStatsValues[] = []
  for (const value of Array.isArray(raw.substatPriority) ? raw.substatPriority : []) {
    const stat = toStat(value)
    if (stat) substatPriority.push(stat)
    else warnings.push(`${name}: unknown substat "${String(value)}", skipped`)
  }

  let rankBy = fallback.rankBy
  if (raw.rankBy !== undefined) {
    if (typeof raw.rankBy === 'string' && RANKABLE.has(raw.rankBy)) rankBy = raw.rankBy as keyof FinalStats
    else warnings.push(`${name}: can't rank by "${String(raw.rankBy)}", using ${fallback.rankBy}`)
  }
  let thenBy = fallback.thenBy
  if (Array.isArray(raw.thenBy)) {
    thenBy = raw.thenBy.filter((key): key is keyof FinalStats => typeof key === 'string' && RANKABLE.has(key))
    if (thenBy.length < raw.thenBy.length) warnings.push(`${name}: some "thenBy" stats aren't known and were skipped`)
  }

  const preset: BuildPreset = {
    sets,
    mainStats,
    substatPriority,
    rankBy,
    thenBy,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    source,
    confidence: 'sourced',
    reviewed,
  }
  return { agentId: agent.id, preset }
}

export function parseImportedZzzPresets(stored: StoredPresetImport, agents: AgentData[]): ImportedZzzPresets {
  const { file, warnings } = parsePresetFile(stored.text, GAME)
  if (!file) return { source: '', presets: {}, warnings }

  const reviewed = file.updated && isDateString(file.updated) ? file.updated : stored.importedAt
  const presets: Record<string, BuildPreset> = {}
  file.entries.forEach((raw, index) => {
    const parsed = parseEntry(raw, index, agents, file.source, reviewed, warnings)
    if (!parsed) return
    if (presets[parsed.agentId]) warnings.push(`${parsed.preset.source}: more than one preset for agent ${parsed.agentId}, the last one is used`)
    presets[parsed.agentId] = parsed.preset
  })
  return { source: file.source, presets, warnings }
}
