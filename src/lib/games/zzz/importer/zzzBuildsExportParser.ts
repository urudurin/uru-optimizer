import {
  FIXED_MAIN_STAT_BY_SLOT,
  getSubstatValue,
} from 'lib/games/zzz/discStats'
import {
  type Disc,
  type DiscRarity,
  type DiscSlot,
  type DiscSubstat,
  MAX_DISC_LEVEL,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Adapter for the "builds export" JSON (version 3.x) produced by another ZZZ optimizer.
// The parser never throws on bad data: it skips what it can't use and reports a warning.

export type ParseWarningCode =
  | 'INVALID_INPUT'
  | 'UNKNOWN_VERSION'
  | 'MALFORMED_DISC'
  | 'MALFORMED_BUILD'
  | 'DUPLICATE_DISC'
  | 'UNKNOWN_STAT'
  | 'EMPTY_SUBSTAT'
  | 'INVALID_SUBSTAT'
  | 'VALUE_MISMATCH'
  | 'FIXED_MAIN_STAT_MISMATCH'

export type ParseWarning = {
  code: ParseWarningCode,
  message: string,
  discId?: string,
}

export type ImportedBuild = {
  id: string,
  agentId: string,
  name: string,
  element: string,
  specialty: string,
  level: number,
  mindscapeLevel: number,
  wEngineId?: string,
  wEngineRefinement: number,
  discIds: Partial<Record<DiscSlot, string>>,
}

export type ParsedZzzExport = {
  discs: Disc[],
  builds: ImportedBuild[],
  warnings: ParseWarning[],
}

const EXPECTED_VERSION_PREFIX = '3'
const VALUE_TOLERANCE = 0.01

const EXPORT_STAT_TO_STAT: Record<string, ZzzStatsValues> = {
  'HP': ZzzStats.HP,
  'ATK': ZzzStats.ATK,
  'DEF': ZzzStats.DEF,
  'HP%': ZzzStats.HP_P,
  'ATK%': ZzzStats.ATK_P,
  'DEF%': ZzzStats.DEF_P,
  'CRIT_Rate': ZzzStats.CRIT_RATE,
  'CRIT_DMG': ZzzStats.CRIT_DMG,
  'Anomaly_Proficiency': ZzzStats.ANOMALY_PROFICIENCY,
  'Anomaly_Mastery': ZzzStats.ANOMALY_MASTERY,
  'Impact': ZzzStats.IMPACT,
  'Energy_Regen': ZzzStats.ENERGY_REGEN,
  'PEN': ZzzStats.PEN,
  'PEN_Ratio': ZzzStats.PEN_RATIO,
  'Element_DMG': ZzzStats.ELEMENT_DMG,
}

const SLOT_PATTERN = /^Drive([1-6])$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// Ids show up as strings in this format, but accept numbers too
function asId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return asString(value)
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseSlot(value: unknown): DiscSlot | undefined {
  if (typeof value !== 'string') return undefined
  const match = SLOT_PATTERN.exec(value)
  return match ? Number(match[1]) as DiscSlot : undefined
}

function parseRarity(value: unknown): DiscRarity | undefined {
  return value === 'S' || value === 'A' || value === 'B' ? value : undefined
}

function parseStat(value: unknown): ZzzStatsValues | undefined {
  return typeof value === 'string' && Object.hasOwn(EXPORT_STAT_TO_STAT, value)
    ? EXPORT_STAT_TO_STAT[value]
    : undefined
}

// Temporary stable id until the set registry exists: "Phaethon's Melody" -> "phaethons-melody"
export function slugifySetName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || name
}

function parseSubstats(
  raw: unknown,
  rarity: DiscRarity,
  discId: string,
  warnings: ParseWarning[],
): DiscSubstat[] {
  const substats: DiscSubstat[] = []
  if (!Array.isArray(raw)) return substats

  for (const entry of raw) {
    if (!isRecord(entry)) {
      warnings.push({ code: 'INVALID_SUBSTAT', message: 'Substat entry is not an object, skipped', discId })
      continue
    }

    const rolls = asFiniteNumber(entry.rolls)
    if (entry.type === '' || entry.type == null || rolls === 0) {
      warnings.push({ code: 'EMPTY_SUBSTAT', message: 'Substat has no stat type or no rolls, skipped', discId })
      continue
    }

    const stat = parseStat(entry.type)
    if (!stat) {
      warnings.push({ code: 'UNKNOWN_STAT', message: `Unknown substat type "${String(entry.type)}", skipped`, discId })
      continue
    }

    if (rolls === undefined || !Number.isInteger(rolls) || rolls < 1) {
      warnings.push({ code: 'INVALID_SUBSTAT', message: `Substat "${stat}" has invalid rolls, skipped`, discId })
      continue
    }

    const expected = getSubstatValue(rarity, stat, rolls)
    const actual = asFiniteNumber(entry.value)
    if (expected !== undefined && actual !== undefined && Math.abs(expected - actual) > VALUE_TOLERANCE) {
      warnings.push({
        code: 'VALUE_MISMATCH',
        message: `Substat "${stat}" has ${rolls} rolls, expected ${expected} but file says ${actual}`,
        discId,
      })
    }

    substats.push({ stat, rolls })
  }

  return substats
}

function parseDisc(raw: unknown, warnings: ParseWarning[]): Disc | undefined {
  if (!isRecord(raw)) {
    warnings.push({ code: 'MALFORMED_DISC', message: 'Disc entry is not an object, skipped' })
    return undefined
  }

  const id = asId(raw.uid)
  const slot = parseSlot(raw.slot)
  const rarity = parseRarity(raw.rarity)
  const level = asFiniteNumber(raw.level)
  const setName = asString(raw.set)
  const mainRaw = raw.mainStat

  if (
    !id || !slot || !rarity || !setName || !isRecord(mainRaw)
    || level === undefined || !Number.isInteger(level) || level < 0 || level > MAX_DISC_LEVEL
  ) {
    warnings.push({ code: 'MALFORMED_DISC', message: 'Disc is missing or has invalid fields, skipped', discId: id })
    return undefined
  }

  const mainStat = parseStat(mainRaw.type)
  const mainValue = asFiniteNumber(mainRaw.value)
  if (!mainStat || mainValue === undefined) {
    warnings.push({
      code: 'UNKNOWN_STAT',
      message: `Unknown or invalid main stat "${String(mainRaw.type)}", disc skipped`,
      discId: id,
    })
    return undefined
  }

  const fixedMainStat = FIXED_MAIN_STAT_BY_SLOT[slot]
  if (fixedMainStat && fixedMainStat !== mainStat) {
    warnings.push({
      code: 'FIXED_MAIN_STAT_MISMATCH',
      message: `Slot ${slot} should have main stat ${fixedMainStat} but has ${mainStat}`,
      discId: id,
    })
  }

  return {
    id,
    slot,
    setId: slugifySetName(setName),
    setName,
    rarity,
    level,
    main: { stat: mainStat, value: mainValue },
    substats: parseSubstats(raw.subStats, rarity, id, warnings),
    locked: raw.lock === true,
    equippedBy: asId(raw.equippedBy),
  }
}

function parseBuild(
  raw: unknown,
  discsById: Map<string, Disc>,
  warnings: ParseWarning[],
): ImportedBuild | undefined {
  if (!isRecord(raw)) {
    warnings.push({ code: 'MALFORMED_BUILD', message: 'Build entry is not an object, skipped' })
    return undefined
  }

  const id = asId(raw.id)
  const agentId = asId(raw.agentId)
  if (!id || !agentId) {
    warnings.push({ code: 'MALFORMED_BUILD', message: 'Build is missing id or agentId, skipped' })
    return undefined
  }

  // Builds embed full copies of their discs. Those are only parsed when the disc isn't already known,
  // so a disc listed in both places is neither duplicated nor warned about twice
  const discIds: Partial<Record<DiscSlot, string>> = {}
  if (isRecord(raw.equippedDiscs)) {
    for (const embedded of Object.values(raw.equippedDiscs)) {
      if (!isRecord(embedded)) continue

      const embeddedId = asId(embedded.uid)
      const known = embeddedId ? discsById.get(embeddedId) : undefined
      const disc = known ?? parseDisc(embedded, warnings)
      if (!disc) continue

      discsById.set(disc.id, disc)
      discIds[disc.slot] = disc.id
    }
  }

  const wEngine = isRecord(raw.equippedWEngine) ? raw.equippedWEngine : undefined

  return {
    id,
    agentId,
    name: asString(raw.name) ?? agentId,
    element: asString(raw.element) ?? '',
    specialty: asString(raw.specialty) ?? '',
    level: asFiniteNumber(raw.level) ?? 1,
    mindscapeLevel: asFiniteNumber(raw.mindscapeLevel) ?? 0,
    wEngineId: wEngine ? asId(wEngine.id) : undefined,
    wEngineRefinement: asFiniteNumber(raw.wEngineRefinement) ?? 1,
    discIds,
  }
}

export function parseZzzBuildsExport(input: unknown): ParsedZzzExport {
  const warnings: ParseWarning[] = []

  if (!isRecord(input) || (!Array.isArray(input.discs) && !Array.isArray(input.builds))) {
    warnings.push({ code: 'INVALID_INPUT', message: 'Expected an object with a "discs" or "builds" array' })
    return { discs: [], builds: [], warnings }
  }

  if (typeof input.version !== 'string' || !input.version.startsWith(EXPECTED_VERSION_PREFIX)) {
    warnings.push({
      code: 'UNKNOWN_VERSION',
      message: `Expected export version ${EXPECTED_VERSION_PREFIX}.x, got ${JSON.stringify(input.version)}. Parsing anyway`,
    })
  }

  const discsById = new Map<string, Disc>()

  if (Array.isArray(input.discs)) {
    for (const raw of input.discs) {
      const disc = parseDisc(raw, warnings)
      if (!disc) continue

      if (discsById.has(disc.id)) {
        warnings.push({ code: 'DUPLICATE_DISC', message: 'Disc id appears more than once, kept the first', discId: disc.id })
        continue
      }
      discsById.set(disc.id, disc)
    }
  }

  const builds: ImportedBuild[] = []
  if (Array.isArray(input.builds)) {
    for (const raw of input.builds) {
      const build = parseBuild(raw, discsById, warnings)
      if (build) builds.push(build)
    }
  }

  return { discs: [...discsById.values()], builds, warnings }
}

export function parseZzzBuildsExportJson(text: string): ParsedZzzExport {
  try {
    // Strip a UTF-8 byte order mark if the file has one
    return parseZzzBuildsExport(JSON.parse(text.replace(/^\uFEFF/, '')))
  } catch {
    return {
      discs: [],
      builds: [],
      warnings: [{ code: 'INVALID_INPUT', message: 'File is not valid JSON' }],
    }
  }
}
