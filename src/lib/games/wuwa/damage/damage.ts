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
// A rotation is a count of each damage line. Lines sum per type and scaling stat, so the rotation's damage is, per
// group, the summed multipliers times the stat, times the rest. Not yet: Echo Skill damage, Resonators' own buffs from
// their kit, and team DEF ignore or RES shred (set them on the enemy by hand). Personal, non-commercial use.

export type ScalingStat = 'atk' | 'hp' | 'def'
export type HitType = 'basic' | 'heavy' | 'skill' | 'liberation' | 'intro' | 'outro' | 'none'
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
}

export type DamageSetup = {
  charId: string,
  characterLevel: number,
  rotation: Rotation,
  enemy: EnemySettings,
}

export function hasSkillData(charId: string): boolean {
  return DATA[charId] !== undefined
}

export function characterHits(charId: string): SkillHit[] {
  return (DATA[charId]?.hits ?? []).map((hit, i) => ({
    key: `${hit.section}:${i}`,
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
  none: 'Other',
}

type Group = { bonus?: keyof WuwaStats, stat: ScalingStat, multiplier: number }
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
  const groups = new Map<string, Group>()
  for (const hit of characterHits(setup.charId)) {
    const count = rotation.counts[hit.key] ?? 0
    if (count <= 0) continue
    for (const [type, stat, values] of hit.terms) {
      const key = `${type}:${stat}`
      const group = groups.get(key) ?? { bonus: TYPE_BONUS[type], stat, multiplier: 0 }
      group.multiplier += count * (values[levelIndex(rotation.skillLevel)] ?? 0)
      groups.set(key, group)
    }
  }
  const own = 800 + 8 * setup.characterLevel
  const enemyDef = (8 * enemy.level + 792) * Math.max(0, 1 - enemy.defIgnore / 100)
  const factor = own / (own + enemyDef) * resMultiplier((enemy.res - enemy.resShred) / 100) * (1 + enemy.amplify / 100)
  const result = { groups: [...groups.values()], factor }
  prepared.set(setup, result)
  return result
}

export function rotationDamage(stats: WuwaStats, setup: DamageSetup): number {
  const { groups, factor } = prepare(setup)
  const crit = 1 + Math.min(Math.max(stats.critRate, 0), 100) / 100 * (stats.critDmg - 100) / 100
  let total = 0
  for (const group of groups) {
    total += group.multiplier / 100 * stats[group.stat] * (1 + (stats.elementDmg + (group.bonus ? stats[group.bonus] : 0)) / 100)
  }
  return total * crit * factor
}
