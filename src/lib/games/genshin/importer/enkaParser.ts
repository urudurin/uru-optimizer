import type {
  Artifact,
  ArtifactSlot,
  ArtifactSubstat,
  Element,
  GenshinCharacter,
  GenshinStatKey,
  GenshinWeapon,
} from 'lib/games/genshin/types'

// Converts an Enka.Network Genshin showcase response (https://enka.network/api/uid/<uid>) into characters and the
// artifacts they wear. Enka only has the characters in the player's showcase, not the whole inventory. Character stats
// are the game's own final values (fightPropMap), so they match the in-game character screen.
// Names come from Enka's store files (store/gi), loaded at import time. Never throws: bad parts are skipped with a warning.

export type EnkaGenshinStore = {
  avatars: Record<string, { Element?: string, NameTextMapHash?: number | string }>,
  // English names by text hash or key
  locs: Record<string, string>,
  // relics.json "Sets": set id -> name hash
  sets: Record<string, { Name: string }>,
  // affixes.json: substat roll id -> the numeric property it rolled
  affixes: Record<string, { PropType: number }>,
}

export type ParsedEnkaGenshin = {
  characters: GenshinCharacter[],
  artifacts: Artifact[],
  warnings: string[],
  uid?: string,
  ttl?: number,
}

// Stat names Enka uses on artifacts and weapons
const FIGHT_PROPS: Record<string, GenshinStatKey> = {
  FIGHT_PROP_HP: 'hp',
  FIGHT_PROP_HP_PERCENT: 'hpPct',
  FIGHT_PROP_ATTACK: 'atk',
  FIGHT_PROP_ATTACK_PERCENT: 'atkPct',
  FIGHT_PROP_DEFENSE: 'def',
  FIGHT_PROP_DEFENSE_PERCENT: 'defPct',
  FIGHT_PROP_CRITICAL: 'critRate',
  FIGHT_PROP_CRITICAL_HURT: 'critDmg',
  FIGHT_PROP_CHARGE_EFFICIENCY: 'energyRecharge',
  FIGHT_PROP_ELEMENT_MASTERY: 'elementalMastery',
  FIGHT_PROP_HEAL_ADD: 'healingBonus',
  FIGHT_PROP_PHYSICAL_ADD_HURT: 'physicalDmg',
  FIGHT_PROP_FIRE_ADD_HURT: 'pyroDmg',
  FIGHT_PROP_WATER_ADD_HURT: 'hydroDmg',
  FIGHT_PROP_WIND_ADD_HURT: 'anemoDmg',
  FIGHT_PROP_ELEC_ADD_HURT: 'electroDmg',
  FIGHT_PROP_GRASS_ADD_HURT: 'dendroDmg',
  FIGHT_PROP_ICE_ADD_HURT: 'cryoDmg',
  FIGHT_PROP_ROCK_ADD_HURT: 'geoDmg',
}

// The same stats as numeric ids, used by substat rolls in affixes.json
const NUMERIC_PROPS: Record<number, GenshinStatKey> = {
  2: 'hp',
  3: 'hpPct',
  5: 'atk',
  6: 'atkPct',
  8: 'def',
  9: 'defPct',
  20: 'critRate',
  22: 'critDmg',
  23: 'energyRecharge',
  28: 'elementalMastery',
}

// Final character stats in fightPropMap. Percent stats are fractions there (0.2055 = 20.55%)
const FINAL_STATS: [string, GenshinStatKey, boolean][] = [
  ['2000', 'hp', false],
  ['2001', 'atk', false],
  ['2002', 'def', false],
  ['28', 'elementalMastery', false],
  ['20', 'critRate', true],
  ['22', 'critDmg', true],
  ['23', 'energyRecharge', true],
  ['26', 'healingBonus', true],
  ['30', 'physicalDmg', true],
  ['40', 'pyroDmg', true],
  ['41', 'electroDmg', true],
  ['42', 'hydroDmg', true],
  ['43', 'dendroDmg', true],
  ['44', 'anemoDmg', true],
  ['45', 'geoDmg', true],
  ['46', 'cryoDmg', true],
]

const SLOTS: Record<string, ArtifactSlot> = {
  EQUIP_BRACER: 'flower',
  EQUIP_NECKLACE: 'plume',
  EQUIP_SHOES: 'sands',
  EQUIP_RING: 'goblet',
  EQUIP_DRESS: 'circlet',
}

const ELEMENTS: Record<string, Element> = {
  Fire: 'Pyro',
  Water: 'Hydro',
  Wind: 'Anemo',
  Electric: 'Electro',
  Grass: 'Dendro',
  Ice: 'Cryo',
  Rock: 'Geo',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

export function isEnkaGenshinResponse(input: unknown): boolean {
  return isRecord(input) && isRecord(input.playerInfo)
}

// Enka has no id for an artifact, so it's named after its contents: unchanged artifacts keep their id across imports
function artifactId(parts: (string | number)[]): string {
  let hash = 5381
  for (const char of parts.join('|')) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0
  return `gi-${hash.toString(36)}`
}

function readStat(raw: unknown, idKey: string): { stat: GenshinStatKey, value: number } | undefined {
  if (!isRecord(raw)) return undefined
  const stat = FIGHT_PROPS[String(raw[idKey])]
  const value = asNumber(raw.statValue)
  return stat && value !== undefined ? { stat, value } : undefined
}

function parseArtifact(item: Record<string, unknown>, characterId: string, store: EnkaGenshinStore, warnings: string[]): Artifact | undefined {
  const flat = isRecord(item.flat) ? item.flat : {}
  const reliquary = isRecord(item.reliquary) ? item.reliquary : {}
  const slot = SLOTS[String(flat.equipType)]
  const main = readStat(flat.reliquaryMainstat, 'mainPropId')
  if (!slot || !main) {
    warnings.push(`Character ${characterId}: an artifact couldn't be read, skipped`)
    return undefined
  }

  // Count each substat's rolls from the roll ids
  const rollCounts = new Map<GenshinStatKey, number>()
  for (const affixId of Array.isArray(reliquary.appendPropIdList) ? reliquary.appendPropIdList : []) {
    const stat = NUMERIC_PROPS[store.affixes[String(affixId)]?.PropType ?? -1]
    if (stat) rollCounts.set(stat, (rollCounts.get(stat) ?? 0) + 1)
  }
  const substats: ArtifactSubstat[] = []
  for (const raw of Array.isArray(flat.reliquarySubstats) ? flat.reliquarySubstats : []) {
    const sub = readStat(raw, 'appendPropId')
    if (sub) substats.push({ ...sub, rolls: rollCounts.get(sub.stat) ?? 1 })
    else warnings.push(`Character ${characterId}: an artifact substat couldn't be read, skipped`)
  }

  const setId = String(flat.setId ?? '')
  const setNameHash = store.sets[setId]?.Name
  const setName = (setNameHash && store.locs[setNameHash]) || store.locs[String(flat.setNameTextMapHash)] || `Set ${setId}`
  const level = Math.max(0, (asNumber(reliquary.level) ?? 1) - 1)
  const rarity = asNumber(flat.rankLevel) ?? 5
  return {
    id: artifactId([setId, slot, rarity, level, main.stat, main.value, ...substats.map((s) => `${s.stat}:${s.value}`)]),
    slot,
    setId,
    setName,
    rarity,
    level,
    main,
    substats,
    equippedBy: characterId,
  }
}

function parseWeapon(item: Record<string, unknown>, store: EnkaGenshinStore): GenshinWeapon {
  const flat = isRecord(item.flat) ? item.flat : {}
  const weapon = isRecord(item.weapon) ? item.weapon : {}
  const stats = Array.isArray(flat.weaponStats) ? flat.weaponStats : []
  const baseAtk = stats.find((s) => isRecord(s) && s.appendPropId === 'FIGHT_PROP_BASE_ATTACK')
  const secondary = stats.map((s) => readStat(s, 'appendPropId')).find((s) => s !== undefined)
  // affixMap holds refinement - 1; 1 and 2 star weapons have none
  const affix = isRecord(weapon.affixMap) ? Object.values(weapon.affixMap).map(asNumber)[0] : undefined
  return {
    id: String(item.itemId ?? ''),
    name: store.locs[String(flat.nameTextMapHash)] ?? `Weapon ${String(item.itemId)}`,
    rarity: asNumber(flat.rankLevel) ?? 1,
    level: asNumber(weapon.level) ?? 1,
    refinement: (affix ?? 0) + 1,
    baseAtk: isRecord(baseAtk) ? asNumber(baseAtk.statValue) ?? 0 : 0,
    ...(secondary ? { secondary } : {}),
  }
}

export function parseEnkaGenshin(input: unknown, store: EnkaGenshinStore, importedOn: string): ParsedEnkaGenshin {
  if (!isEnkaGenshinResponse(input)) return { characters: [], artifacts: [], warnings: ['This isn\'t an Enka.Network Genshin profile'] }
  const response = input as Record<string, unknown>
  const warnings: string[] = []
  const list = Array.isArray(response.avatarInfoList) ? response.avatarInfoList : []
  if (list.length === 0) warnings.push('The profile has no characters in its showcase, or "Show Character Details" is off in the game')

  const characters: GenshinCharacter[] = []
  const artifacts: Artifact[] = []
  for (const raw of list) {
    const id = isRecord(raw) && raw.avatarId !== undefined ? String(raw.avatarId) : ''
    if (!isRecord(raw) || !id) {
      warnings.push('A showcased character couldn\'t be read, skipped')
      continue
    }
    // Traveler variants are keyed by avatar id and element (skill depot)
    const info = store.avatars[`${id}-${String(raw.skillDepotId)}`] ?? store.avatars[id]
    const name = (info?.NameTextMapHash !== undefined && store.locs[String(info.NameTextMapHash)]) || `Character ${id}`

    const props = isRecord(raw.propMap) ? raw.propMap : {}
    const levelProp = isRecord(props['4001']) ? props['4001'] : {}
    const fight = isRecord(raw.fightPropMap) ? raw.fightPropMap : {}
    const stats: Partial<Record<GenshinStatKey, number>> = {}
    for (const [key, stat, isPercent] of FINAL_STATS) {
      const value = asNumber(fight[key])
      if (value !== undefined) stats[stat] = isPercent ? value * 100 : value
    }

    const artifactIds: Partial<Record<ArtifactSlot, string>> = {}
    let weapon: GenshinWeapon | undefined
    for (const item of Array.isArray(raw.equipList) ? raw.equipList : []) {
      if (!isRecord(item)) continue
      const type = isRecord(item.flat) ? item.flat.itemType : undefined
      if (type === 'ITEM_WEAPON') {
        weapon = parseWeapon(item, store)
      } else if (type === 'ITEM_RELIQUARY') {
        const artifact = parseArtifact(item, id, store, warnings)
        if (!artifact) continue
        artifacts.push(artifact)
        artifactIds[artifact.slot] = artifact.id
      }
    }

    characters.push({
      id,
      name,
      element: info?.Element ? ELEMENTS[info.Element] : undefined,
      level: asNumber(levelProp.val) ?? 1,
      constellation: Array.isArray(raw.talentIdList) ? raw.talentIdList.length : 0,
      ...(weapon ? { weapon } : {}),
      artifactIds,
      stats,
      statsDate: importedOn,
    })
  }

  return {
    characters,
    artifacts,
    warnings,
    uid: response.uid !== undefined ? String(response.uid) : undefined,
    ttl: asNumber(response.ttl),
  }
}
