import { CHARACTER_INFO } from 'lib/games/wuwa/data/characters'
import {
  CHARACTER_BASES,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import {
  mainStatValue,
  SECONDARY_MAIN,
  secondaryMainValue,
} from 'lib/games/wuwa/echoStats'
import type {
  CharacterState,
  Echo,
  ElementDmgKey,
  StatKey,
} from 'lib/games/wuwa/types'

// The numbers on the WuWa character overview screen, out of combat. Ported from the WuwaEchoScorer project.
// HP/ATK/DEF = base x (1 + percent) + flat, where base ATK is character + weapon. Crit, Energy Regen and DMG bonuses are
// added as points on top of the starting 5% Crit Rate, 150% Crit DMG and 100% Energy Regen.

export type WuwaStats = {
  hp: number,
  atk: number,
  def: number,
  critRate: number,
  critDmg: number,
  energyRegen: number,
  healingBonus: number,
  // DMG bonus for the character's own element, 0 when the element isn't known
  elementDmg: number,
  basicDmg: number,
  heavyDmg: number,
  skillDmg: number,
  libDmg: number,
}

export type WuwaStatsResult = {
  stats: WuwaStats,
  // Everything that kept the result from being complete, never silently ignored
  warnings: string[],
}

const STARTING: Partial<Record<StatKey, number>> = { critRate: 5, critDmg: 150, energyRegen: 100 }

// Linear interpolation between the nearest listed levels, clamped outside the range
export function atLevel(table: Record<string, number>, level: number): number {
  const levels = Object.keys(table).map(Number).sort((a, b) => a - b)
  if (levels.length === 0) return 0
  if (level <= levels[0]) return table[levels[0]]
  for (let i = 1; i < levels.length; i++) {
    const hi = levels[i]
    if (level <= hi) {
      const lo = levels[i - 1]
      return table[lo] + ((table[hi] - table[lo]) * (level - lo)) / (hi - lo)
    }
  }
  return table[levels[levels.length - 1]]
}

// Pieces per sonata set, counting distinct echoes: two copies of the same echo count once (unverified in this project)
export function setPieceCounts(echoes: Echo[]): Map<string, number> {
  const bySet = new Map<string, Set<string>>()
  for (const echo of echoes) {
    const defs = bySet.get(echo.setId) ?? new Set<string>()
    defs.add(echo.defId)
    bySet.set(echo.setId, defs)
  }
  return new Map([...bySet].map(([setId, defs]) => [setId, defs.size]))
}

type Bonus = Partial<Record<StatKey, number>>

function addTo(sums: Bonus, stats: Bonus) {
  for (const [stat, value] of Object.entries(stats)) sums[stat as StatKey] = (sums[stat as StatKey] ?? 0) + (value ?? 0)
}

// Everything that doesn't depend on echoes, worked out once per character
export type PreparedWuwaCharacter = {
  baseHp: number,
  // Character plus weapon base ATK
  baseAtk: number,
  baseDef: number,
  element?: ElementDmgKey,
  // Starting stats, minor fortes and weapon bonuses
  bonus: Bonus,
  warnings: string[],
}

export function prepareWuwaCharacter(character: CharacterState): PreparedWuwaCharacter {
  const warnings: string[] = []
  const sums: Bonus = { ...STARTING }
  const add = (stats: Bonus) => addTo(sums, stats)

  const base = CHARACTER_BASES[character.charId]
  if (!base) warnings.push(`No base stats for ${character.charId} in the game data, HP, ATK and DEF are missing their base`)
  const pick = (stat: 'hp' | 'atk' | 'def') =>
    base ? atLevel(Object.fromEntries(Object.entries(base.baseByLevel).map(([level, s]) => [level, s[stat]])), character.level) : 0

  const info = CHARACTER_INFO[character.charId]
  if (!info) warnings.push(`No element or minor forte data for ${character.charId} yet, those bonuses are left out`)
  else if (character.minorFortes) add(info.minorFortes)

  const weapon = character.weaponId ? WEAPONS[character.weaponId] : undefined
  if (character.weaponId && !weapon) warnings.push(`No data for weapon ${character.weaponId}, its ATK and secondary stat are left out`)
  if (weapon) {
    add({ [weapon.secondary.stat]: atLevel(weapon.secondary.byLevel, character.weaponLevel) })
    // Always-on passive bonuses do show on the stat screen (Unspoken Rue's 12% ATK on Suoming's screen)
    add(weapon.passiveStats?.[String(character.refinement)] ?? {})
  }

  const charAtk = pick('atk')
  const weaponAtk = weapon ? atLevel(weapon.baseAtkByLevel, character.weaponLevel) : 0
  return { baseHp: pick('hp'), baseAtk: charAtk + weaponAtk, baseDef: pick('def'), element: info?.element, bonus: sums, warnings }
}

// What one echo adds on its own: its two main stats and its substats
export function echoStats(echo: Echo): Bonus {
  const sums: Bonus = {}
  addTo(sums, { [echo.mainStat]: mainStatValue(echo.cost, echo.mainStat, echo.level) })
  addTo(sums, { [SECONDARY_MAIN[echo.cost].stat]: secondaryMainValue(echo.cost, echo.level) })
  for (const substat of echo.substats) addTo(sums, { [substat.stat]: substat.value })
  return sums
}

// The bonuses of the sonata sets these echoes complete
export function sonataBonus(setId: string, pieces: number): Bonus {
  const sums: Bonus = {}
  for (const bonus of SONATA_SETS[setId]?.bonuses ?? []) if (bonus.pieces <= pieces) addTo(sums, bonus.stats)
  return sums
}

// The overview screen from the prepared character plus echo and set bonuses (added into bonus by the caller)
export function finalizeWuwaStats(prepared: PreparedWuwaCharacter, bonus: Bonus): WuwaStats {
  const total = (stat: StatKey) => bonus[stat] ?? 0
  return {
    hp: prepared.baseHp * (1 + total('hpPct') / 100) + total('hpFlat'),
    atk: prepared.baseAtk * (1 + total('atkPct') / 100) + total('atkFlat'),
    def: prepared.baseDef * (1 + total('defPct') / 100) + total('defFlat'),
    critRate: total('critRate'),
    critDmg: total('critDmg'),
    energyRegen: total('energyRegen'),
    healingBonus: total('healingBonus'),
    elementDmg: prepared.element ? total(prepared.element) : 0,
    basicDmg: total('basicDmg'),
    heavyDmg: total('heavyDmg'),
    skillDmg: total('skillDmg'),
    libDmg: total('libDmg'),
  }
}

// extra: stat points to add on top, e.g. one more substat roll for the build analysis
export function computeWuwaStats(character: CharacterState, echoes: Echo[], extra: Bonus = {}): WuwaStatsResult {
  const prepared = prepareWuwaCharacter(character)
  const warnings = [...prepared.warnings]
  const sums: Bonus = { ...prepared.bonus }
  for (const echo of echoes) addTo(sums, echoStats(echo))
  addTo(sums, extra)
  for (const [setId, count] of setPieceCounts(echoes)) {
    if (!SONATA_SETS[setId] && count >= 2) warnings.push(`No data for sonata set ${setId}, its bonuses are left out`)
    addTo(sums, sonataBonus(setId, count))
  }
  return { stats: finalizeWuwaStats(prepared, sums), warnings }
}

// The game rounds shown values down, not to nearest: Blooming Jadehaven's 587.5 base ATK shows as 587.
// The small epsilon keeps a sum like 88.1 stored as 88.09999999 from dropping a tenth
function floorTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.floor(value * factor + 1e-6) / factor
}

export function toDisplayStats(stats: WuwaStats): WuwaStats {
  return {
    hp: floorTo(stats.hp, 0),
    atk: floorTo(stats.atk, 0),
    def: floorTo(stats.def, 0),
    critRate: floorTo(stats.critRate, 1),
    critDmg: floorTo(stats.critDmg, 1),
    energyRegen: floorTo(stats.energyRegen, 1),
    healingBonus: floorTo(stats.healingBonus, 1),
    elementDmg: floorTo(stats.elementDmg, 1),
    basicDmg: floorTo(stats.basicDmg, 1),
    heavyDmg: floorTo(stats.heavyDmg, 1),
    skillDmg: floorTo(stats.skillDmg, 1),
    libDmg: floorTo(stats.libDmg, 1),
  }
}
