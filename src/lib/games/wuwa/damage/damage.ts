import type { DamageLine } from 'lib/games/shared/damageBreakdown'
import { characterName } from 'lib/games/wuwa/data/gameData'
import echoSkillData from 'lib/games/wuwa/data/generated/echoSkills.json'
import skillData from 'lib/games/wuwa/data/generated/skills.json'
import type { WuwaStats } from 'lib/games/wuwa/stats/computeStats'

// WuWa damage, from the game's damage formula as the community has worked it out. One hit is
//   (multiplier x scaling stat) x (1 + element DMG + the hit's type DMG) x CRIT (average) x DEF x RES x (1 + amplify)
// with
//   DEF = (800 + 8 x Resonator level) / (800 + 8 x Resonator level + enemy DEF x (1 - DEF ignore)),
//         enemy DEF = 8 x enemy level + 792
//   RES = 1 - res / 2 below 0, 1 - res below 80%, 1 / (1 + 5 res) above
// The hit's type (Basic Attack, Heavy Attack, Resonance Skill, Liberation...) is what the datamine says it counts as, so
// it takes that type's DMG bonus. Skill multipliers come from data/generated/skills.json
// (src/scripts/wuwa/extractSkills.mjs).
//
// Echo Skill hits (data/generated/echoSkills.json, src/scripts/wuwa/extractEchoSkills.mjs) count as Echo Skill DMG at the
// echo's highest rank, and only take the element DMG Bonus when the echo's element is the Resonator's.
// DMG Amplified adds up per hit: the enemy card's (for everything) plus the kit's, for everything or one kind of hit.
// A rotation is a count of each damage line. Lines sum per type and scaling stat, so the rotation's damage is, per
// group, the summed multipliers times the stat, times the rest. Coordinated Attacks (lines named "... Coordinated
// Attack ...": Verina's, Yuanwu's Thunder Wedge) keep their type and also take Coordinated Attack DMG Bonus
// (DamageSetup.coordinatedDmg, from main echoes like Hecate). Personal, non-commercial use.

export type ScalingStat = 'atk' | 'hp' | 'def'
export type HitType = 'basic' | 'heavy' | 'skill' | 'liberation' | 'intro' | 'outro' | 'echo' | 'none'
export type Section = 'normal' | 'skill' | 'liberation' | 'intro' | 'forte' | 'outro'

export type SkillHit = {
  key: string,
  label: string,
  section: Section,
  // [counts as, scaling stat, percent at skill levels 1-10]
  terms: [HitType, ScalingStat, number[]][],
}

type SkillFile = { characters: Record<string, { hits: { label: string, section: string, terms: (string | number[])[][] }[] }> }
const DATA = (skillData as unknown as SkillFile).characters

export const MAX_SKILL_LEVEL = 10
export const DEFAULT_SKILL_LEVEL = 10

// The DMG bonus stat each type takes, on top of the element's
const TYPE_BONUS: Partial<Record<HitType, keyof WuwaStats>> = {
  basic: 'basicDmg',
  heavy: 'heavyDmg',
  skill: 'skillDmg',
  liberation: 'libDmg',
}

export type EnemySettings = {
  level: number,
  // Percent, for the Resonator's element
  res: number,
  // DEF ignore and RES shred from the team, set by hand
  defIgnore: number,
  resShred: number,
  // DMG Amplified from the team; the same for every build, so it only changes the numbers shown
  amplify: number,
}

export const DEFAULT_ENEMY: EnemySettings = { level: 100, res: 10, defIgnore: 0, resShred: 0, amplify: 0 }

export type Rotation = {
  // Times each damage line lands, by hit key
  counts: Record<string, number>,
  skillLevel: number,
  // The main echo whose Echo Skill is in the rotation, and how many times each of its hits lands (by hit index)
  echo?: { id: string, counts: Record<string, number> },
}

export type DamageSetup = {
  charId: string,
  characterLevel: number,
  rotation: Rotation,
  enemy: EnemySettings,
  // The Resonator's element DMG stat ('fusionDmg'...), so an echo of another element doesn't get it
  element?: string,
  // DMG Amplified from the kit (damage/combatEffects.ts), for every hit ('all') or one kind, in percent
  amplify?: Partial<Record<HitType | 'all', number>>,
  // DMG Bonus for one kind of hit that has no stat (Echo Skill DMG from the main echo), in percent
  typeBonus?: Partial<Record<HitType, number>>,
  // Raises the multiplier of some lines (Jinhsi's Intro +50%), by section or label start, as a fraction
  lineScale?: LineScale[],
  // Coordinated Attack DMG Bonus, in percent, for lines named Coordinated Attack
  coordinatedDmg?: number,
}

export function isCoordinatedAttack(hit: { label: string }): boolean {
  return hit.label.includes('Coordinated Attack')
}

export type LineScale = { section?: Section, labelStart?: string, scale: number }

function lineScaleFor(hit: SkillHit, scales: LineScale[] | undefined): number {
  let scale = 1
  for (const entry of scales ?? []) {
    if (entry.section && entry.section !== hit.section) continue
    if (entry.labelStart && !hit.label.startsWith(entry.labelStart)) continue
    scale += entry.scale
  }
  return scale
}

type EchoSkillFile = {
  echoes: Record<
    string,
    {
      name: string,
      description: string,
      values: string[],
      mainSlot?: Record<string, number>,
      // Main-slot bonuses for named Resonators only (Aemeath's Sigillum), by Resonator name
      mainSlotFor?: Record<string, Record<string, number>>,
      hits: { index: number, multiplier: number, stat: string, element: string | null }[],
    }
  >,
}
const ECHO_SKILLS = (echoSkillData as unknown as EchoSkillFile).echoes

export type EchoSkillHit = { key: string, index: number, multiplier: number, stat: ScalingStat, element: string | null }

// An echo's Echo Skill damage hits, keyed by their place in the skill text
export function echoSkillHits(echoId: string): EchoSkillHit[] {
  return (ECHO_SKILLS[echoId]?.hits ?? []).map((hit) => ({ ...hit, key: String(hit.index), stat: hit.stat as ScalingStat }))
}

// The echo's skill text with its numbers filled in, for showing what each hit is
export function echoSkillText(echoId: string): string {
  const echo = ECHO_SKILLS[echoId]
  if (!echo) return ''
  return echo.description.replace(/\{(\d+)\}/g, (token, i: string) => echo.values[Number(i)] ?? token)
}

// What an echo gives in the main slot (stats for the calculator, and Echo Skill and Coordinated Attack DMG Bonus for the
// damage), from the "equipped in the main slot gains..." sentence of its skill text, plus what it gives this Resonator
// by name ("When equipped in the main slot by Aemeath...")
export function mainEchoBonus(
  echoId: string | undefined,
  charId?: string,
): { stats: Partial<Record<string, number>>, echoDmg: number, coordinatedDmg: number } {
  const echo = echoId ? ECHO_SKILLS[echoId] : undefined
  const all: Record<string, number> = { ...echo?.mainSlot }
  for (const [stat, value] of Object.entries((charId && echo?.mainSlotFor?.[characterName(charId)]) || {})) all[stat] = (all[stat] ?? 0) + value
  const { echoDmg = 0, coordinatedDmg = 0, ...stats } = all
  return { stats, echoDmg, coordinatedDmg }
}

export function hasEchoSkill(echoId: string): boolean {
  return ECHO_SKILLS[echoId] !== undefined
}

export function hasSkillData(charId: string): boolean {
  return DATA[charId] !== undefined
}

// A hit's key: its section and name, with " #2" and so on when a name repeats, so saved rotations survive the data being
// regenerated (keys used to be the hit's position in the data file, "section:12")
function hitKeys(hits: { section: string, label: string }[]): string[] {
  const seen = new Map<string, number>()
  return hits.map((hit) => {
    const base = `${hit.section}:${hit.label}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n > 1 ? `${base} #${n}` : base
  })
}

// Saved rotation counts with old position keys ("section:12") turned into name keys; other keys stay as they are
export function migrateRotationCounts(id: string, counts: Record<string, number>): Record<string, number> {
  const hits = DATA[id]?.hits ?? []
  const keys = hitKeys(hits)
  return Object.fromEntries(
    Object.entries(counts).map(([key, count]) => {
      const old = /^(\w+):(\d+)$/.exec(key)
      const index = old ? Number(old[2]) : -1
      return [old && hits[index]?.section === old[1] ? keys[index] : key, count]
    }),
  )
}

export function characterHits(charId: string): SkillHit[] {
  const hits = DATA[charId]?.hits ?? []
  const keys = hitKeys(hits)
  return hits.map((hit, i) => ({
    key: keys[i],
    label: hit.label,
    section: hit.section as Section,
    terms: hit.terms as [HitType, ScalingStat, number[]][],
  }))
}

// Every Resonance Skill and Liberation line once
export function defaultRotation(charId: string): Rotation {
  const counts: Record<string, number> = {}
  for (const hit of characterHits(charId)) if (hit.section === 'skill' || hit.section === 'liberation') counts[hit.key] = 1
  return { counts, skillLevel: DEFAULT_SKILL_LEVEL }
}

function levelIndex(level: number): number {
  return Math.max(1, Math.min(MAX_SKILL_LEVEL, level)) - 1
}

// The line's multiplier at this level, all its parts together
export function hitMultiplier(hit: SkillHit, level: number): number {
  return hit.terms.reduce((sum, [, , values]) => sum + (values[levelIndex(level)] ?? 0), 0)
}

// What a line counts as and scales on, e.g. "Basic · ATK" or "Skill + Liberation · HP"
export function describeHit(hit: SkillHit): string {
  const types = [...new Set(hit.terms.map(([type]) => TYPE_LABELS[type]))].join(' + ')
  const stats = [...new Set(hit.terms.map(([, stat]) => stat.toUpperCase()))].join(' + ')
  return `${types} · ${stats}`
}

const TYPE_LABELS: Record<HitType, string> = {
  basic: 'Basic',
  heavy: 'Heavy',
  skill: 'Skill',
  liberation: 'Liberation',
  intro: 'Intro',
  outro: 'Outro',
  echo: 'Echo Skill',
  none: 'Other',
}

// elemental: takes the element DMG Bonus; extra: DMG Bonus with no stat behind it; amplify: DMG Amplified, in percent
type Group = { bonus?: keyof WuwaStats, stat: ScalingStat, multiplier: number, elemental: boolean, extra: number, amplify: number }
type Prepared = { groups: Group[], factor: number }

function resMultiplier(res: number): number {
  if (res < 0) return 1 - res / 2
  if (res < 0.8) return 1 - res
  return 1 / (1 + 5 * res)
}

// Worked out once per setup, since every build of a search shares it
const prepared = new WeakMap<DamageSetup, Prepared>()

function prepare(setup: DamageSetup): Prepared {
  const cached = prepared.get(setup)
  if (cached) return cached
  const { rotation, enemy } = setup
  const amplifyFor = (type: HitType) => enemy.amplify + (setup.amplify?.all ?? 0) + (setup.amplify?.[type] ?? 0)
  const groups = new Map<string, Group>()
  for (const hit of characterHits(setup.charId)) {
    const count = rotation.counts[hit.key] ?? 0
    if (count <= 0) continue
    const coordinated = isCoordinatedAttack(hit)
    for (const [type, stat, values] of hit.terms) {
      const key = `${type}:${stat}:${coordinated}`
      const extra = (setup.typeBonus?.[type] ?? 0) + (coordinated ? setup.coordinatedDmg ?? 0 : 0)
      const group = groups.get(key) ?? { bonus: TYPE_BONUS[type], stat, multiplier: 0, elemental: true, extra, amplify: amplifyFor(type) }
      group.multiplier += count * (values[levelIndex(rotation.skillLevel)] ?? 0) * lineScaleFor(hit, setup.lineScale)
      groups.set(key, group)
    }
  }
  if (rotation.echo) {
    for (const hit of echoSkillHits(rotation.echo.id)) {
      const count = rotation.echo.counts[hit.key] ?? 0
      if (count <= 0) continue
      const elemental = !hit.element || !setup.element || `${hit.element}Dmg` === setup.element
      const key = `echo:${hit.stat}:${elemental}`
      const group = groups.get(key) ?? { stat: hit.stat, multiplier: 0, elemental, extra: setup.typeBonus?.echo ?? 0, amplify: amplifyFor('echo') }
      group.multiplier += count * hit.multiplier
      groups.set(key, group)
    }
  }
  const own = 800 + 8 * setup.characterLevel
  const enemyDef = (8 * enemy.level + 792) * Math.max(0, 1 - enemy.defIgnore / 100)
  const factor = own / (own + enemyDef) * resMultiplier((enemy.res - enemy.resShred) / 100)
  const result = { groups: [...groups.values()], factor }
  prepared.set(setup, result)
  return result
}

export function rotationDamage(stats: WuwaStats, setup: DamageSetup): number {
  const { groups, factor } = prepare(setup)
  const crit = 1 + Math.min(Math.max(stats.critRate, 0), 100) / 100 * (stats.critDmg - 100) / 100
  let total = 0
  for (const group of groups) {
    const dmgBonus = (group.elemental ? stats.elementDmg : 0) + (group.bonus ? stats[group.bonus] : 0) + group.extra
    total += group.multiplier / 100 * stats[group.stat] * (1 + dmgBonus / 100) * (1 + group.amplify / 100)
  }
  return total * crit * factor
}

// What a line's skill section is called, for the Rotation card and the damage breakdown
export const SECTION_LABELS: Record<string, string> = {
  normal: 'Normal Attack',
  skill: 'Resonance Skill',
  liberation: 'Resonance Liberation',
  intro: 'Intro Skill',
  forte: 'Forte Circuit',
  outro: 'Outro Skill',
}

const ECHO_LINE = 'echo:'

// The rotation's counted lines, skill lines and the main echo's Echo Skill hits (keyed echo:<index>), for the damage
// breakdown (shared/damageBreakdown.ts)
export function rotationLines(charId: string, rotation: Rotation): DamageLine[] {
  const echo = rotation.echo
  return [
    ...characterHits(charId).map((hit) => ({
      key: hit.key,
      label: hit.label,
      group: SECTION_LABELS[hit.section] ?? hit.section,
      count: rotation.counts[hit.key] ?? 0,
    })),
    ...(echo
      ? echoSkillHits(echo.id).map((hit) => ({
        key: `${ECHO_LINE}${hit.key}`,
        label: `Echo Skill hit {${hit.index}}`,
        group: 'Echo Skill',
        count: echo.counts[hit.key] ?? 0,
      }))
      : []),
  ]
}

// The rotation with only one line in it
export function singleLineRotation(rotation: Rotation, line: DamageLine): Rotation {
  if (line.key.startsWith(ECHO_LINE) && rotation.echo) {
    return { ...rotation, counts: {}, echo: { ...rotation.echo, counts: { [line.key.slice(ECHO_LINE.length)]: line.count } } }
  }
  return { ...rotation, counts: { [line.key]: line.count }, ...(rotation.echo ? { echo: { ...rotation.echo, counts: {} } } : {}) }
}
