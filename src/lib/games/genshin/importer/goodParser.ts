import {
  estimateRolls,
  GOOD_STATS,
  nameFromGoodKey,
  NUMERIC_STAT_IDS,
  toGoodKey,
} from 'lib/games/genshin/goodKeys'
import {
  artifactId,
  type EnkaGenshinStore,
} from 'lib/games/genshin/importer/enkaParser'
import {
  type Artifact,
  type ArtifactSlot,
  type ArtifactSubstat,
  type Element,
  type GenshinCharacter,
  type GenshinWeapon,
  PERCENT_STATS,
} from 'lib/games/genshin/types'

// Converts a GOOD file (Genshin Open Object Description, https://frzyc.github.io/genshin-optimizer/#/doc), the export
// format of artifact scanners like Inventory Kamera and Irminsul, into the whole artifact inventory and every character.
// GOOD has no final character stats (those come from Enka) and no main stat values, which are looked up from Enka's
// main stat table (relic_levels.json). Names come from Enka's store files. Never throws: bad parts are skipped with a warning.

export type ParsedGood = {
  characters: GenshinCharacter[],
  artifacts: Artifact[],
  warnings: string[],
  source?: string,
}

const SLOTS = new Set<string>(['flower', 'plume', 'sands', 'goblet', 'circlet'])

const ELEMENTS: Record<string, Element> = {
  Fire: 'Pyro',
  Water: 'Hydro',
  Wind: 'Anemo',
  Electric: 'Electro',
  Grass: 'Dendro',
  Ice: 'Cryo',
  Rock: 'Geo',
}

const TRAVELER_ELEMENTS = new Set<string>(Object.values(ELEMENTS))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function isGoodFile(input: unknown): boolean {
  return isRecord(input) && input.format === 'GOOD'
}

// GOOD key -> English name (and element, for characters), from Enka's store files
function nameTables(store: EnkaGenshinStore) {
  const characters = new Map<string, { name: string, element?: Element }>()
  for (const [id, avatar] of Object.entries(store.avatars)) {
    const name = avatar.NameTextMapHash !== undefined ? store.locs[String(avatar.NameTextMapHash)] : undefined
    // Traveler variants ("10000005-504") are keyed by element in GOOD, see characterInfo
    if (name && !id.includes('-')) characters.set(toGoodKey(name), { name, element: avatar.Element ? ELEMENTS[avatar.Element] : undefined })
  }
  const sets = new Map<string, string>()
  for (const set of Object.values(store.sets)) {
    const name = store.locs[set.Name]
    if (name) sets.set(toGoodKey(name), name)
  }
  const weapons = new Map<string, { name: string, rarity?: number }>()
  for (const weapon of Object.values(store.weapons)) {
    const name = weapon.NameTextMapHash !== undefined ? store.locs[String(weapon.NameTextMapHash)] : undefined
    if (name) weapons.set(toGoodKey(name), { name, rarity: weapon.Rarity })
  }
  return { characters, sets, weapons }
}

function characterInfo(key: string, tables: ReturnType<typeof nameTables>): { name: string, element?: Element } {
  const travelerElement = key.startsWith('Traveler') ? key.slice('Traveler'.length) : undefined
  if (travelerElement !== undefined) {
    const element = TRAVELER_ELEMENTS.has(travelerElement) ? travelerElement as Element : undefined
    return { name: `Traveler${element ? ` (${element})` : ''}`, element }
  }
  return tables.characters.get(key) ?? { name: nameFromGoodKey(key) }
}

// The main stat at this rarity and level, as the game shows it
function mainStatValue(store: EnkaGenshinStore, rarity: number, level: number, stat: keyof typeof NUMERIC_STAT_IDS): number | undefined {
  const raw = store.relicLevels[String(rarity)]?.[String(level + 1)]?.[String(NUMERIC_STAT_IDS[stat])]
  if (raw === undefined) return undefined
  return PERCENT_STATS.has(stat) ? Math.round(raw * 1000) / 10 : Math.round(raw)
}

function parseArtifact(raw: unknown, index: number, store: EnkaGenshinStore, tables: ReturnType<typeof nameTables>, warnings: string[]): Artifact | undefined {
  const where = `Artifact ${index + 1}`
  if (!isRecord(raw)) {
    warnings.push(`${where} couldn't be read, skipped`)
    return undefined
  }
  const slot = String(raw.slotKey)
  const mainStat = GOOD_STATS[String(raw.mainStatKey)]
  const setKey = typeof raw.setKey === 'string' ? raw.setKey : ''
  const rarity = asNumber(raw.rarity) ?? 5
  const level = asNumber(raw.level) ?? 0
  if (!SLOTS.has(slot) || !mainStat || !setKey) {
    warnings.push(`${where} has an unknown set, slot or main stat, skipped`)
    return undefined
  }
  const mainValue = mainStatValue(store, rarity, level, mainStat)
  if (mainValue === undefined) warnings.push(`${where}: no main stat value for a ${rarity}★ +${level} ${mainStat}, shown as 0`)

  const substats: ArtifactSubstat[] = []
  for (const sub of Array.isArray(raw.substats) ? raw.substats : []) {
    // Scanners leave empty substat rows as { key: '', value: 0 }
    if (isRecord(sub) && sub.key === '') continue
    const stat = isRecord(sub) ? GOOD_STATS[String(sub.key)] : undefined
    const value = isRecord(sub) ? asNumber(sub.value) : undefined
    if (stat && value !== undefined) substats.push({ stat, value, rolls: estimateRolls(stat, value, rarity) })
    else warnings.push(`${where}: a substat couldn't be read, skipped`)
  }

  const artifact = {
    slot: slot as ArtifactSlot,
    setId: setKey,
    setName: tables.sets.get(setKey) ?? nameFromGoodKey(setKey),
    rarity,
    level,
    main: { stat: mainStat, value: mainValue ?? 0 },
    substats,
  }
  return { id: artifactId(artifact), ...artifact }
}

function parseWeapon(raw: Record<string, unknown>, tables: ReturnType<typeof nameTables>): GenshinWeapon {
  const key = String(raw.key)
  const known = tables.weapons.get(key)
  return {
    id: key,
    name: known?.name ?? nameFromGoodKey(key),
    rarity: known?.rarity ?? 1,
    level: asNumber(raw.level) ?? 1,
    ascension: asNumber(raw.ascension) ?? 0,
    refinement: asNumber(raw.refinement) ?? 1,
  }
}

export function parseGood(input: unknown, store: EnkaGenshinStore, importedOn: string): ParsedGood {
  if (!isGoodFile(input)) return { characters: [], artifacts: [], warnings: ['This isn\'t a GOOD file'] }
  const file = input as Record<string, unknown>
  const warnings: string[] = []
  const tables = nameTables(store)

  const characters: GenshinCharacter[] = []
  for (const raw of Array.isArray(file.characters) ? file.characters : []) {
    if (!isRecord(raw) || typeof raw.key !== 'string' || !raw.key) {
      warnings.push('A character couldn\'t be read, skipped')
      continue
    }
    const info = characterInfo(raw.key, tables)
    characters.push({
      id: raw.key,
      name: info.name,
      ...(info.element ? { element: info.element } : {}),
      level: asNumber(raw.level) ?? 1,
      ascension: asNumber(raw.ascension) ?? 0,
      constellation: asNumber(raw.constellation) ?? 0,
      artifactIds: {},
      // GOOD has no final stats; an Enka import fills them in (and a GOOD import keeps them, see mergeGenshinData)
      stats: {},
      statsDate: importedOn,
    })
  }
  const characterById = new Map(characters.map((c) => [c.id, c]))
  // GOOD uses "Traveler" as the location for whichever element the Traveler is
  const owner = (location: unknown): GenshinCharacter | undefined => {
    if (typeof location !== 'string' || !location) return undefined
    if (location === 'Traveler') return characters.find((c) => c.id.startsWith('Traveler'))
    return characterById.get(location)
  }

  const artifacts: Artifact[] = []
  const seen = new Map<string, number>()
  const rawArtifacts = Array.isArray(file.artifacts) ? file.artifacts : []
  rawArtifacts.forEach((raw, index) => {
    const artifact = parseArtifact(raw, index, store, tables, warnings)
    if (!artifact) return
    // Two artifacts with exactly the same contents (fresh +0 ones, usually) still need their own ids
    const copies = seen.get(artifact.id) ?? 0
    seen.set(artifact.id, copies + 1)
    if (copies > 0) artifact.id = `${artifact.id}-${copies + 1}`

    const wearer = owner(isRecord(raw) ? raw.location : undefined)
    if (wearer) {
      artifact.equippedBy = wearer.id
      wearer.artifactIds[artifact.slot] = artifact.id
    }
    artifacts.push(artifact)
  })

  for (const raw of Array.isArray(file.weapons) ? file.weapons : []) {
    if (!isRecord(raw) || typeof raw.key !== 'string') continue
    const wearer = owner(raw.location)
    if (wearer) wearer.weapon = parseWeapon(raw, tables)
  }

  return { characters, artifacts, warnings, ...(typeof file.source === 'string' ? { source: file.source } : {}) }
}
