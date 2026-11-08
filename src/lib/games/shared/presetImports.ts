import type { GameId } from 'lib/games/games'
import type {
  CharacterMetadata,
  SimulationTeammate,
} from 'lib/games/shared/characterMetadata'
import { weightsFromPriority } from 'lib/games/shared/gearScore'
import {
  isDateString,
  readPresetImport,
  type StoredPresetImport,
  todayString,
  writePresetImport,
} from 'lib/games/shared/importedPresets'
import {
  create,
  type StoreApi,
  type UseBoundStore,
} from 'zustand'

// Imported presets v2 (hsr-workflow-review.md step 5): the user's own preset file (shared/importedPresets.ts, kept in
// this browser only, never committed) fills in a character's metadata (shared/characterMetadata.ts) the way HSR's
// curated ScoringMetadata is filled in: substat weights, ideal main stats, the optimizer's rank, and the DPS score's
// Default team, rotation, benchmark sets and substats. Every game reads the same entry shape:
// {
//   "character": "Yumemizuki Mizuki",                       name or id
//   "substatPriority": ["Elemental Mastery", "Energy Recharge"],   best first (weights 1, 0.8, 0.6, ...)
//   "substatWeights": { "Elemental Mastery": 1, "CRIT Rate": 0.5 },  or exact weights
//   "mainStats": { "sands": ["Elemental Mastery"], ... },    slot (Genshin sands/goblet/circlet, ZZZ 4/5/6,
//                                                            WuWa cost 4/3/1) -> allowed main stats
//   "sets": [["Viridescent Venerer"], ["Gilded Dreams", "Wanderer's Troupe"]],   set options, each worn together (ZZZ
//                                                            also { "fourPiece", "twoPiece" })
//   "rankBy": "damage",                                      the optimizer's rank
//   "team": [{ "character": "Odette", "rank": 0, "weapon": "...", "refinement": 1, "fourPiece": "..." }],
//   "rotation": { "skill:Dreamdrifter DMG": 4, "reaction:stellarswirl": 4 },   hit key -> count, as the Rotation card
//   "substats": ["Elemental Mastery", "Energy Recharge"]     the substats the benchmark may place rolls in
// }
// Version 1 files (ZZZ, before Nov 2026) still load. Anything unknown is skipped with a warning; parsing never throws.

export const PRESET_FILE_VERSIONS = [1, 2]

// What an imported entry adds to a character's metadata; game ids throughout
export type ImportedMetadata = {
  stats?: Record<string, number>,
  parts?: Record<string, string[]>,
  sortOption?: string,
  teammates?: SimulationTeammate[],
  rotationCounts?: Record<string, number>,
  sets?: string[][],
  substats?: string[],
  notes?: string,
  source: string,
  reviewed: string,
}

// How one game reads names in the file; each returns the game's id, or undefined when it doesn't know the value
export type PresetResolver = {
  character: (value: string) => string | undefined,
  stat: (value: string) => string | undefined,
  // Slot names as the file writes them -> the game's slot key, and whether a stat can be that slot's main stat
  slot: (value: string) => string | undefined,
  mainStat: (slot: string, stat: string) => boolean,
  set: (value: string) => string | undefined,
  weapon: (value: string) => string | undefined,
  sortOption: (value: string) => string | undefined,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const text = (value: unknown) => (typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '')

// The file's header, accepting versions 1 and 2. Never throws
export function readPresetFileHeader(stored: StoredPresetImport, game: GameId): { source: string, reviewed: string, entries: unknown[], warnings: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(stored.text)
  } catch {
    return { source: '', reviewed: stored.importedAt, entries: [], warnings: ['The file isn\'t valid JSON'] }
  }
  const empty = (warning: string) => ({ source: '', reviewed: stored.importedAt, entries: [], warnings: [warning] })
  if (!isRecord(parsed)) return empty('Expected an object with "version", "game", "source" and "presets"')
  if (!PRESET_FILE_VERSIONS.includes(parsed.version as number)) return empty(`Expected "version": ${PRESET_FILE_VERSIONS.join(' or ')}`)
  if (parsed.game !== game) return empty(`This file is for "${String(parsed.game)}", not "${game}"`)
  if (!Array.isArray(parsed.presets)) return empty('Expected a "presets" list')
  const warnings: string[] = []
  const source = typeof parsed.source === 'string' && parsed.source.trim() ? parsed.source.trim() : 'Imported file'
  let reviewed = stored.importedAt
  if (parsed.updated !== undefined) {
    if (isDateString(parsed.updated)) reviewed = parsed.updated
    else warnings.push('"updated" should be a date like 2026-10-25, the import date is used instead')
  }
  return { source, reviewed, entries: parsed.presets, warnings }
}

function parseEntry(raw: unknown, index: number, resolver: PresetResolver, source: string, reviewed: string, warnings: string[]) {
  if (!isRecord(raw)) {
    warnings.push(`Preset ${index + 1}: not an object, skipped`)
    return undefined
  }
  const id = resolver.character(text(raw.character))
  if (!id) {
    warnings.push(`Preset ${index + 1}: no character "${text(raw.character)}", skipped`)
    return undefined
  }
  const name = text(raw.character)
  const entry: ImportedMetadata = { source, reviewed }
  const stats = (values: unknown, what: string) =>
    (Array.isArray(values) ? values : []).flatMap((value) => {
      const stat = resolver.stat(text(value))
      if (!stat) warnings.push(`${name}: unknown ${what} "${text(value)}", skipped`)
      return stat ? [stat] : []
    })

  if (isRecord(raw.substatWeights)) {
    entry.stats = {}
    for (const [key, weight] of Object.entries(raw.substatWeights)) {
      const stat = resolver.stat(key)
      if (stat && typeof weight === 'number' && Number.isFinite(weight) && weight >= 0) entry.stats[stat] = weight
      else warnings.push(`${name}: substat weight "${key}" skipped`)
    }
  } else if (Array.isArray(raw.substatPriority)) {
    entry.stats = weightsFromPriority(stats(raw.substatPriority, 'substat'))
  }

  if (isRecord(raw.mainStats)) {
    entry.parts = {}
    for (const [slotName, listed] of Object.entries(raw.mainStats)) {
      const slot = resolver.slot(slotName)
      if (!slot) {
        warnings.push(`${name}: unknown slot "${slotName}", skipped`)
        continue
      }
      entry.parts[slot] = stats(listed, 'main stat').filter((stat) => {
        const ok = resolver.mainStat(slot, stat)
        if (!ok) warnings.push(`${name}: "${stat}" can't be a ${slotName} main stat, skipped`)
        return ok
      })
    }
  }

  if (Array.isArray(raw.sets)) {
    entry.sets = raw.sets.flatMap((option) => {
      const names = Array.isArray(option) ? option : isRecord(option) ? [option.fourPiece, option.twoPiece].filter((v) => v !== undefined) : [option]
      const ids = names.flatMap((value) => {
        const set = resolver.set(text(value))
        if (!set) warnings.push(`${name}: unknown set "${text(value)}", skipped`)
        return set ? [set] : []
      })
      return ids.length > 0 ? [ids] : []
    })
  }

  if (raw.rankBy !== undefined) {
    const sort = resolver.sortOption(text(raw.rankBy))
    if (sort) entry.sortOption = sort
    else warnings.push(`${name}: can't rank by "${text(raw.rankBy)}", skipped`)
  }

  if (Array.isArray(raw.team)) {
    entry.teammates = raw.team.flatMap((mate) => {
      const mateId = resolver.character(text(isRecord(mate) ? mate.character : mate))
      if (!mateId || mateId === id) {
        warnings.push(`${name}: teammate "${text(isRecord(mate) ? mate.character : mate)}" skipped`)
        return []
      }
      const teammate: SimulationTeammate = { id: mateId }
      if (!isRecord(mate)) return [teammate]
      if (typeof mate.rank === 'number' && mate.rank >= 0 && mate.rank <= 6) teammate.rank = Math.round(mate.rank)
      if (mate.weapon !== undefined) {
        const weapon = resolver.weapon(text(mate.weapon))
        if (weapon) teammate.weaponId = weapon
        else warnings.push(`${name}: unknown weapon "${text(mate.weapon)}" for a teammate, skipped`)
      }
      if (typeof mate.refinement === 'number' && mate.refinement >= 1 && mate.refinement <= 5) teammate.refinement = Math.round(mate.refinement)
      if (mate.fourPiece !== undefined) {
        const set = resolver.set(text(mate.fourPiece))
        if (set) teammate.fourPiece = set
        else warnings.push(`${name}: unknown teammate set "${text(mate.fourPiece)}", skipped`)
      }
      return [teammate]
    })
  }

  if (isRecord(raw.rotation)) {
    entry.rotationCounts = {}
    for (const [key, count] of Object.entries(raw.rotation)) {
      if (typeof count === 'number' && Number.isFinite(count) && count >= 0) entry.rotationCounts[key] = count
      else warnings.push(`${name}: rotation line "${key}" needs a count, skipped`)
    }
  }

  if (Array.isArray(raw.substats)) entry.substats = stats(raw.substats, 'benchmark substat')
  if (typeof raw.notes === 'string') entry.notes = raw.notes
  return { id, entry }
}

export type ParsedImports = { source: string, byCharacter: Record<string, ImportedMetadata>, warnings: string[] }

export function parseImportedMetadata(stored: StoredPresetImport, game: GameId, resolver: PresetResolver): ParsedImports {
  const { source, reviewed, entries, warnings } = readPresetFileHeader(stored, game)
  const byCharacter: Record<string, ImportedMetadata> = {}
  entries.forEach((raw, index) => {
    const parsed = parseEntry(raw, index, resolver, source, reviewed, warnings)
    if (!parsed) return
    if (byCharacter[parsed.id]) warnings.push(`More than one preset for ${parsed.id}, the last one is used`)
    byCharacter[parsed.id] = parsed.entry
  })
  return { source, byCharacter, warnings }
}

// A character's metadata with the imported entry laid over it: each field the entry has wins, and the DPS score's
// simulation is filled from the team, rotation, sets, mains and substats it gives
export function withImported<Rotation extends { counts: Record<string, number> }>(
  base: CharacterMetadata<Rotation>,
  imported: ImportedMetadata | undefined,
): CharacterMetadata<Rotation> {
  if (!imported) return base
  const stats = imported.stats ?? base.stats
  const parts = imported.parts ?? base.parts
  const simulates = imported.teammates || imported.rotationCounts || imported.sets || imported.substats
  const baseSim = base.simulation
  return {
    ...base,
    stats,
    parts,
    sortOption: imported.sortOption ?? base.sortOption,
    ...(simulates
      ? {
        simulation: {
          teammates: imported.teammates ?? baseSim?.teammates ?? [],
          rotation: imported.rotationCounts ? { ...base.rotation, counts: imported.rotationCounts } : baseSim?.rotation ?? base.rotation,
          sets: imported.sets ?? baseSim?.sets ?? [],
          parts: imported.parts ?? baseSim?.parts ?? parts,
          substats: imported.substats ?? baseSim?.substats ?? Object.keys(stats).filter((stat) => stats[stat] > 0),
        },
      }
      : {}),
    source: `${imported.source} (imported)`,
    confidence: 'guide',
    reviewed: imported.reviewed,
  }
}

// The imported file per game, after the ZZZ store it replaces: the raw text in this browser only, parsed where used, and
// whether it's switched on (off = the built-in metadata only, like ZZZ's old Built-in choice)
type PresetImportState = {
  stored: StoredPresetImport | undefined,
  enabled: boolean,
  importText: (text: string) => void,
  clear: () => void,
  setEnabled: (enabled: boolean) => void,
}

const stores = new Map<GameId, UseBoundStore<StoreApi<PresetImportState>>>()
const enabledKey = (game: GameId) => `${game}-imported-presets-off`

export function presetImportStore(game: GameId): UseBoundStore<StoreApi<PresetImportState>> {
  let store = stores.get(game)
  if (!store) {
    let off = false
    try {
      off = localStorage.getItem(enabledKey(game)) === '1'
    } catch {
      // Storage blocked: on
    }
    store = create<PresetImportState>()((set) => ({
      stored: readPresetImport(game),
      enabled: !off,
      importText: (fileText) => {
        const stored = { text: fileText, importedAt: todayString(new Date()) }
        if (!writePresetImport(game, stored)) console.error(`Failed to save imported ${game} presets (storage blocked or quota exceeded?)`)
        set({ stored, enabled: true })
        try {
          localStorage.removeItem(enabledKey(game))
        } catch {
          // Nothing to do
        }
      },
      clear: () => {
        writePresetImport(game, undefined)
        set({ stored: undefined })
      },
      setEnabled: (enabled) => {
        try {
          if (enabled) localStorage.removeItem(enabledKey(game))
          else localStorage.setItem(enabledKey(game), '1')
        } catch {
          // Kept for this visit only
        }
        set({ enabled })
      },
    }))
    stores.set(game, store)
  }
  return store
}

// The parsed import for a game, cached per file text; undefined when nothing is imported or it's switched off
const parsedCache = new Map<GameId, { text: string, parsed: ParsedImports }>()

export function importedPresets(game: GameId, resolver: PresetResolver): ParsedImports | undefined {
  const { stored, enabled } = presetImportStore(game).getState()
  if (!stored || !enabled) return undefined
  const cached = parsedCache.get(game)
  if (cached?.text === stored.text) return cached.parsed
  const parsed = parseImportedMetadata(stored, game, resolver)
  parsedCache.set(game, { text: stored.text, parsed })
  return parsed
}
