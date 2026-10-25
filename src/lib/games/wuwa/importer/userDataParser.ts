import {
  CHARACTER_BASES,
  ECHO_DEFINITIONS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import {
  validateEcho,
  validateLoadout,
} from 'lib/games/wuwa/echoRules'
import {
  type CharacterState,
  type Cost,
  type Echo,
  MAX_LOADOUT_ECHOES,
  type SavedTeam,
  STAT_LABELS,
  type StatKey,
  type Substat,
  type SubstatKey,
} from 'lib/games/wuwa/types'

// Reads the save file of the user's WuwaEchoScorer project (user-data.json, version 1):
// { version: 1, echoes: { id: Echo }, characters: { charId: CharacterState }, teams: [], overrides: {},
//   priority?: [], savedBuilds?: {} }
// Never throws: anything it can't use is skipped and reported as a warning. Echoes that break a game rule (impossible
// main stat or roll) are skipped too, so the stats and optimizer never see impossible gear.

export const USER_DATA_VERSION = 1

export type ParsedWuwaData = {
  echoes: Echo[],
  characters: CharacterState[],
  teams: SavedTeam[],
  // Character ids, highest priority first
  priority: string[],
  warnings: string[],
}

const EMPTY: Omit<ParsedWuwaData, 'warnings'> = { echoes: [], characters: [], teams: [], priority: [] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isStatKey(value: unknown): value is StatKey {
  return typeof value === 'string' && Object.hasOwn(STAT_LABELS, value)
}

function parseEcho(raw: unknown, key: string, warnings: string[]): Echo | undefined {
  const label = `Echo ${key}`
  if (!isRecord(raw)) {
    warnings.push(`${label}: not an object, skipped`)
    return undefined
  }
  const id = asString(raw.id) ?? key
  const defId = asString(raw.defId)
  const cost = asNumber(raw.cost)
  const setId = asString(raw.setId)
  const level = asNumber(raw.level)
  if (!defId || !setId || level === undefined || (cost !== 1 && cost !== 3 && cost !== 4) || !isStatKey(raw.mainStat)) {
    warnings.push(`${label}: missing or invalid echo, cost, set, main stat or level, skipped`)
    return undefined
  }

  const substats: Substat[] = []
  for (const sub of Array.isArray(raw.substats) ? raw.substats : []) {
    const value = isRecord(sub) ? asNumber(sub.value) : undefined
    if (isRecord(sub) && isStatKey(sub.stat) && value !== undefined) substats.push({ stat: sub.stat as SubstatKey, value })
    else warnings.push(`${label}: unreadable substat, skipped`)
  }

  const echo: Echo = { id, defId, cost: cost as Cost, setId, mainStat: raw.mainStat, level, substats }

  // An echo newer than the datamine copy can't be checked against its own definition, so only the stat rules apply
  const definition = ECHO_DEFINITIONS[defId] ?? { cost: echo.cost, setIds: [setId] }
  if (!ECHO_DEFINITIONS[defId]) warnings.push(`${label}: "${defId}" isn't in the game data yet, its cost and set aren't checked`)
  const problems = validateEcho(echo, definition)
  if (problems.length > 0) {
    warnings.push(`${label} (${defId}): ${problems.join('; ')}, skipped`)
    return undefined
  }
  return echo
}

function parseCharacter(raw: unknown, key: string, echoIds: Set<string>, warnings: string[]): CharacterState | undefined {
  if (!isRecord(raw)) {
    warnings.push(`Character ${key}: not an object, skipped`)
    return undefined
  }
  const charId = asString(raw.charId) ?? key
  const label = `Character ${charId}`
  if (!CHARACTER_BASES[charId]) warnings.push(`${label}: not in the game data yet, stats won't be available`)

  const weaponId = asString(raw.weaponId)
  if (weaponId && !WEAPONS[weaponId]) warnings.push(`${label}: weapon "${weaponId}" isn't in the game data yet`)

  const slots: (string | null)[] = Array.isArray(raw.echoIds) ? raw.echoIds.slice(0, MAX_LOADOUT_ECHOES) : []
  const equipped = Array.from({ length: MAX_LOADOUT_ECHOES }, (_, i) => {
    const echoId = slots[i]
    if (echoId === null || echoId === undefined) return null
    if (typeof echoId === 'string' && echoIds.has(echoId)) return echoId
    warnings.push(`${label}: equipped echo ${String(echoId)} wasn't imported, its slot is left empty`)
    return null
  })

  return {
    charId,
    level: asNumber(raw.level) ?? 90,
    sequence: asNumber(raw.sequence) ?? 0,
    ...(weaponId ? { weaponId } : {}),
    weaponLevel: asNumber(raw.weaponLevel) ?? 90,
    refinement: asNumber(raw.refinement) ?? 1,
    minorFortes: raw.minorFortes !== false,
    echoIds: equipped,
  }
}

function parseTeam(raw: unknown, warnings: string[]): SavedTeam | undefined {
  const members = isRecord(raw) && Array.isArray(raw.members) ? raw.members : []
  if (!isRecord(raw) || !asString(raw.id) || members.length !== 3 || !members.every((m) => typeof m === 'string')) {
    warnings.push('A saved team is unreadable, skipped')
    return undefined
  }
  return { id: raw.id as string, name: asString(raw.name) ?? 'Team', members: members as [string, string, string] }
}

export function parseWuwaUserData(input: unknown): ParsedWuwaData {
  const warnings: string[] = []
  if (!isRecord(input)) return { ...EMPTY, warnings: ['Expected a WuwaEchoScorer user-data file (an object)'] }
  if (input.version !== USER_DATA_VERSION) {
    return { ...EMPTY, warnings: [`Expected "version": ${USER_DATA_VERSION}, found ${JSON.stringify(input.version)}`] }
  }

  const echoes: Echo[] = []
  for (const [key, raw] of Object.entries(isRecord(input.echoes) ? input.echoes : {})) {
    const echo = parseEcho(raw, key, warnings)
    if (echo) echoes.push(echo)
  }
  const echoIds = new Set(echoes.map((echo) => echo.id))
  const echoById = new Map(echoes.map((echo) => [echo.id, echo]))

  const characters: CharacterState[] = []
  for (const [key, raw] of Object.entries(isRecord(input.characters) ? input.characters : {})) {
    const character = parseCharacter(raw, key, echoIds, warnings)
    if (!character) continue
    const loadout = character.echoIds.flatMap((id) => {
      const echo = id ? echoById.get(id) : undefined
      return echo ? [echo] : []
    })
    for (const problem of validateLoadout(loadout)) warnings.push(`Character ${character.charId}: ${problem}`)
    characters.push(character)
  }

  const teams = (Array.isArray(input.teams) ? input.teams : []).flatMap((raw) => parseTeam(raw, warnings) ?? [])
  const priority = Array.isArray(input.priority) ? input.priority.filter((id): id is string => typeof id === 'string') : []

  // Score overrides and saved optimizer builds belong to features that aren't ported yet
  if (isRecord(input.overrides) && Object.keys(input.overrides).length > 0) warnings.push('Score overrides aren\'t supported yet, left out')
  if (isRecord(input.savedBuilds) && Object.keys(input.savedBuilds).length > 0) warnings.push('Saved builds aren\'t supported yet, left out')

  return { echoes, characters, teams, priority, warnings }
}

export function parseWuwaUserDataJson(text: string): ParsedWuwaData {
  try {
    return parseWuwaUserData(JSON.parse(text))
  } catch {
    return { ...EMPTY, warnings: ['The file isn\'t valid JSON'] }
  }
}
