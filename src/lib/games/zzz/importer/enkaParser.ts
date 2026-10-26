import { AGENTS } from 'lib/games/zzz/data/agents'
import {
  type ImportedBuild,
  type ParsedZzzExport,
  type ParseWarning,
  slugifySetName,
} from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  type Disc,
  type DiscRarity,
  type DiscSlot,
  type DiscSubstat,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Converts an Enka.Network ZZZ showcase response (https://enka.network/api/zzz/uid/<uid>) into discs and builds.
// Enka only has the agents in the player's showcase and the discs they wear, not the whole inventory.
// Ids and names come from Enka's public store files (store/zzz in github.com/EnkaNetwork/API-docs), loaded at import
// time rather than copied into this repo. Never throws: anything it can't use is skipped with a warning.

export type EnkaZzzStore = {
  equipments: {
    Items: Record<string, { Rarity: number, SuitId: number }>,
    Suits: Record<string, { Name: string }>,
  },
  avatars: Record<string, { Name: string, ProfessionType?: string, ElementTypes?: string[] }>,
  // English names by localization key
  locs: Record<string, string>,
}

export type ParsedEnkaZzz = ParsedZzzExport & {
  uid?: string,
  // Seconds until Enka refreshes this profile
  ttl?: number,
}

// Enka property ids for the stats discs can have
const PROPERTY_STATS: Record<number, ZzzStatsValues> = {
  11102: ZzzStats.HP_P,
  11103: ZzzStats.HP,
  12102: ZzzStats.ATK_P,
  12103: ZzzStats.ATK,
  13102: ZzzStats.DEF_P,
  13103: ZzzStats.DEF,
  12202: ZzzStats.IMPACT,
  20103: ZzzStats.CRIT_RATE,
  21103: ZzzStats.CRIT_DMG,
  23103: ZzzStats.PEN_RATIO,
  23203: ZzzStats.PEN,
  30502: ZzzStats.ENERGY_REGEN,
  31203: ZzzStats.ANOMALY_PROFICIENCY,
  31402: ZzzStats.ANOMALY_MASTERY,
  31503: ZzzStats.ELEMENT_DMG,
  31603: ZzzStats.ELEMENT_DMG,
  31703: ZzzStats.ELEMENT_DMG,
  31803: ZzzStats.ELEMENT_DMG,
  31903: ZzzStats.ELEMENT_DMG,
  32303: ZzzStats.ELEMENT_DMG,
}

// Stats Enka stores as hundredths of a percent (240 = 2.4%)
const PERCENT_STATS = new Set<ZzzStatsValues>([
  ZzzStats.HP_P,
  ZzzStats.ATK_P,
  ZzzStats.DEF_P,
  ZzzStats.IMPACT,
  ZzzStats.CRIT_RATE,
  ZzzStats.CRIT_DMG,
  ZzzStats.PEN_RATIO,
  ZzzStats.ENERGY_REGEN,
  ZzzStats.ANOMALY_MASTERY,
  ZzzStats.ELEMENT_DMG,
])

const RARITIES: Record<number, DiscRarity> = { 4: 'S', 3: 'A', 2: 'B' }
// Main stat growth per disc level by rarity, from Enka's docs: value = base x (1 + level x scale)
const MAIN_STAT_SCALE: Record<DiscRarity, number> = { S: 0.2, A: 0.25, B: 0.3 }

const ELEMENT_NAMES: Record<string, string> = {
  Physics: 'Physical',
  Fire: 'Fire',
  Ice: 'Ice',
  Elec: 'Electric',
  Ether: 'Ether',
  Wind: 'Wind',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function isEnkaZzzResponse(input: unknown): boolean {
  return isRecord(input) && isRecord(input.PlayerInfo)
}

export function elementOf(agentId: string, types: string[] | undefined): string {
  const known = AGENTS[agentId]?.element
  if (known) return known
  // Agents with a special element list the base one too (Miyabi: ["FireFrost", "Ice"])
  for (const type of [...(types ?? [])].reverse()) if (ELEMENT_NAMES[type]) return ELEMENT_NAMES[type]
  return types?.[0] ?? 'Unknown'
}

type RawStat = { stat: ZzzStatsValues, value: number, rolls: number }

function readStat(raw: unknown, warnings: ParseWarning[], discId: string): RawStat | undefined {
  if (!isRecord(raw)) return undefined
  const id = asNumber(raw.PropertyId)
  const value = asNumber(raw.PropertyValue)
  const stat = id !== undefined ? PROPERTY_STATS[id] : undefined
  if (!stat || value === undefined) {
    warnings.push({ code: 'UNKNOWN_STAT', message: `Unknown disc stat ${String(raw.PropertyId)}, skipped`, discId })
    return undefined
  }
  return { stat, value: PERCENT_STATS.has(stat) ? value / 100 : value, rolls: asNumber(raw.PropertyLevel) ?? 1 }
}

// Same slot, set, rarity, level, main stat and substat rolls: the same physical disc, whatever id it was saved under
function sameDisc(a: Disc, b: Disc): boolean {
  const subs = (disc: Disc) => disc.substats.map((s) => `${s.stat}:${s.rolls}`).sort().join('|')
  return a.slot === b.slot && a.setId === b.setId && a.rarity === b.rarity && a.level === b.level && a.main.stat === b.main.stat
    && Math.abs(a.main.value - b.main.value) < 0.05 && subs(a) === subs(b)
}

function parseDisc(slot: unknown, raw: unknown, agentId: string, store: EnkaZzzStore, existing: Disc[], warnings: ParseWarning[]): Disc | undefined {
  const equipment = isRecord(raw) ? raw : undefined
  const itemId = asNumber(equipment?.Id)
  const discId = `enka-${String(equipment?.Uid ?? itemId)}`
  const discSlot = asNumber(slot)
  const level = asNumber(equipment?.Level) ?? 0
  const item = itemId !== undefined ? store.equipments.Items[String(itemId)] : undefined
  if (!equipment || !discSlot || discSlot < 1 || discSlot > 6 || !item) {
    warnings.push({ code: 'MALFORMED_DISC', message: `Agent ${agentId}: a disc couldn't be read, skipped`, discId })
    return undefined
  }

  const rarity = RARITIES[item.Rarity] ?? 'S'
  const suitKey = store.equipments.Suits[String(item.SuitId)]?.Name
  const setName = (suitKey && store.locs[suitKey]) || `Set ${item.SuitId}`
  const mainList = Array.isArray(equipment.MainPropertyList) ? equipment.MainPropertyList : []
  const main = readStat(mainList[0], warnings, discId)
  if (!main) return undefined

  const substats: DiscSubstat[] = []
  for (const raw of Array.isArray(equipment.RandomPropertyList) ? equipment.RandomPropertyList : []) {
    const sub = readStat(raw, warnings, discId)
    if (sub) substats.push({ stat: sub.stat, rolls: sub.rolls })
  }

  const mainValue = main.value * (1 + level * MAIN_STAT_SCALE[rarity])
  const disc: Disc = {
    id: discId,
    slot: discSlot as DiscSlot,
    setId: slugifySetName(setName),
    setName,
    rarity,
    level,
    main: { stat: main.stat, value: round(mainValue, PERCENT_STATS.has(main.stat) ? 2 : 0) },
    substats,
    locked: equipment.IsLocked === true,
    equippedBy: agentId,
  }
  // Reuse the id of a disc that's already imported so it isn't added twice
  const match = existing.find((other) => sameDisc(other, disc))
  return match ? { ...disc, id: match.id } : disc
}

export function parseEnkaZzz(input: unknown, store: EnkaZzzStore, existing: { discs: Disc[], builds: ImportedBuild[] }): ParsedEnkaZzz {
  const warnings: ParseWarning[] = []
  if (!isEnkaZzzResponse(input)) {
    return { discs: [], builds: [], warnings: [{ code: 'INVALID_INPUT', message: 'This isn\'t an Enka.Network ZZZ profile' }] }
  }
  const response = input as Record<string, unknown>
  const showcase = isRecord((response.PlayerInfo as Record<string, unknown>).ShowcaseDetail)
    ? (response.PlayerInfo as Record<string, Record<string, unknown>>).ShowcaseDetail
    : undefined
  const avatarList = Array.isArray(showcase?.AvatarList) ? showcase.AvatarList : []
  if (avatarList.length === 0) {
    warnings.push({ code: 'INVALID_INPUT', message: 'The profile has no agents in its showcase. Add agents to your in-game showcase and try again' })
  }

  const discs: Disc[] = []
  const builds: ImportedBuild[] = []
  for (const raw of avatarList) {
    const agentId = isRecord(raw) ? String(raw.Id ?? '') : ''
    if (!isRecord(raw) || !agentId) {
      warnings.push({ code: 'MALFORMED_BUILD', message: 'A showcased agent couldn\'t be read, skipped' })
      continue
    }
    const info = store.avatars[agentId]
    const name = AGENTS[agentId]?.name ?? (info && store.locs[info.Name]) ?? `Agent ${agentId}`

    const discIds: Partial<Record<DiscSlot, string>> = {}
    for (const entry of Array.isArray(raw.EquippedList) ? raw.EquippedList : []) {
      const disc = isRecord(entry)
        ? parseDisc(entry.Slot, entry.Equipment, agentId, store, existing.discs, warnings)
        : parseDisc(undefined, undefined, agentId, store, existing.discs, warnings)
      if (!disc) continue
      discs.push(disc)
      discIds[disc.slot] = disc.id
    }

    const weapon = isRecord(raw.Weapon) ? raw.Weapon : undefined
    builds.push({
      // Refresh the agent's existing build instead of adding a second one
      id: existing.builds.find((b) => b.agentId === agentId)?.id ?? `enka-${agentId}`,
      agentId,
      name,
      element: elementOf(agentId, info?.ElementTypes),
      specialty: AGENTS[agentId]?.specialty ?? info?.ProfessionType ?? 'Unknown',
      level: asNumber(raw.Level) ?? 60,
      mindscapeLevel: asNumber(raw.TalentLevel) ?? 0,
      wEngineId: weapon?.Id !== undefined ? String(weapon.Id) : undefined,
      wEngineRefinement: asNumber(weapon?.UpgradeLevel) ?? 1,
      discIds,
    })
  }

  return {
    discs,
    builds,
    warnings,
    uid: response.uid !== undefined ? String(response.uid) : undefined,
    ttl: asNumber(response.ttl),
  }
}
