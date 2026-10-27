import skillData from 'lib/games/zzz/data/generated/skills.json'
import type { FinalStats } from 'lib/games/zzz/stats/computeStats'

// ZZZ damage, after genshin-optimizer's ZZZ formula (libs/zzz/formula/src/data/common/dmg.ts, MIT, Copyright (c) 2020
// frzyc): one hit is
//   ATK x multiplier x DMG Bonus x CRIT x DEF x RES x DMG taken x Stun
// with the DEF multiplier levelFactor / (levelFactor + max(0, DEF x (1 - DEF shred) x (1 - PEN Ratio) - PEN)) and the
// agent's level factor from the same file (794 at level 60). A rotation is a count of each skill hit; every hit goes
// through the same multipliers here, so its damage is the sum of the hits' multipliers times one 100% hit.
// Skill multipliers come from data/generated/skills.json (src/scripts/zzz/extractSkills.mjs).
//
// Not yet: Anomaly damage (Assault, Shatter, Disorder...), Sheer damage, skill-type DMG Bonuses (e.g. Basic Attack DMG)
// and hits of another attribute than the agent's. Personal, non-commercial use.

// genshin-optimizer's defLevelFactor, by agent level
const LEVEL_FACTOR = [
  -1,
  50,
  54,
  58,
  62,
  66,
  71,
  76,
  82,
  88,
  94,
  100,
  107,
  114,
  121,
  129,
  137,
  145,
  153,
  162,
  172,
  181,
  191,
  201,
  211,
  222,
  233,
  245,
  256,
  268,
  281,
  293,
  306,
  319,
  333,
  347,
  361,
  375,
  390,
  405,
  421,
  436,
  452,
  469,
  485,
  502,
  519,
  537,
  555,
  573,
  592,
  610,
  629,
  649,
  669,
  689,
  709,
  730,
  751,
  772,
  794,
]

export function levelFactor(level: number): number {
  return LEVEL_FACTOR[Math.max(1, Math.min(60, Math.round(level)))]
}

export type EnemySettings = {
  def: number,
  // Against the agent's attribute, in percent (20 = 20% RES, negative for a weakness)
  res: number,
  stunned: boolean,
  // The Stun DMG multiplier while stunned, in percent (150 for most enemies)
  stunMultiplier: number,
}

// genshin-optimizer's test enemy: DEF 635, no RES, 150% when stunned. Set your own enemy's numbers
export const DEFAULT_ENEMY: EnemySettings = { def: 635, res: 0, stunned: false, stunMultiplier: 150 }

// What the team does to the enemy (team/teamBuffs.ts), in percent
export type EnemyDebuffs = { defShred: number, resShred: number, dmgTaken: number }

export const NO_DEBUFFS: EnemyDebuffs = { defShred: 0, resShred: 0, dmgTaken: 0 }

export type DamageSetup = {
  // Sum over the rotation of count x hit multiplier, in percent of ATK
  multiplier: number,
  agentLevel: number,
  enemy: EnemySettings,
  debuffs: EnemyDebuffs,
}

// Each multiplier, for showing where the damage comes from
export function damageFactors(stats: FinalStats, setup: Omit<DamageSetup, 'multiplier'>) {
  const factor = levelFactor(setup.agentLevel)
  const effectiveDef = Math.max(0, setup.enemy.def * (1 - setup.debuffs.defShred / 100) * (1 - stats.penRatio / 100) - stats.pen)
  return {
    dmgBonus: 1 + stats.elementDmg / 100,
    crit: 1 + (Math.min(100, Math.max(0, stats.critRate)) / 100) * (stats.critDmg / 100),
    def: factor / (factor + effectiveDef),
    res: 1 - setup.enemy.res / 100 + setup.debuffs.resShred / 100,
    dmgTaken: 1 + setup.debuffs.dmgTaken / 100,
    stun: setup.enemy.stunned ? setup.enemy.stunMultiplier / 100 : 1,
  }
}

// Average damage of the whole rotation (crits counted at their rate)
export function rotationDamage(stats: FinalStats, setup: DamageSetup): number {
  const f = damageFactors(stats, setup)
  return stats.atk * (setup.multiplier / 100) * f.dmgBonus * f.crit * f.def * f.res * f.dmgTaken * f.stun
}

// Skills

export type SkillHit = { skill: string, category: string, index: number, label: string, base: number, growth: number }

type SkillEntry = { key: string, category: string, hits: number[][] }
// hits: [multiplier at level 1, growth per level]
const AGENT_SKILLS = (skillData as { agents: Record<string, { name: string, skills: SkillEntry[] }> }).agents

// "EXSpecialAttackHisetsu" -> "EX Special Attack Hisetsu"
function readable(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

// Every damaging hit of an agent's skills, in the game's order
export function agentHits(agentId: string): SkillHit[] {
  return (AGENT_SKILLS[agentId]?.skills ?? []).flatMap((skill) =>
    skill.hits.map(([base, growth], index) => ({
      skill: skill.key,
      category: skill.category,
      index,
      label: skill.hits.length > 1 ? `${readable(skill.key)} ${index + 1}` : readable(skill.key),
      base,
      growth,
    }))
  )
}

export function hitKey(hit: { skill: string, index: number }): string {
  return `${hit.skill}:${hit.index}`
}

// A skill's multiplier at a skill level (1-16; 12 is the most without Mindscape 3 or 5)
export function hitMultiplier(hit: SkillHit, skillLevel: number): number {
  return hit.base + hit.growth * (skillLevel - 1)
}

export type Rotation = {
  // How many times each hit lands, by hitKey
  counts: Record<string, number>,
  skillLevel: number,
}

export const DEFAULT_SKILL_LEVEL = 12

// A starting point: every hit of the Ultimate, Chain Attack and EX Special once
export function defaultRotation(agentId: string): Rotation {
  const counts: Record<string, number> = {}
  for (const hit of agentHits(agentId)) {
    if (hit.category === 'chain' || hit.skill.startsWith('EXSpecial')) counts[hitKey(hit)] = 1
  }
  return { counts, skillLevel: DEFAULT_SKILL_LEVEL }
}

export function rotationMultiplier(agentId: string, rotation: Rotation): number {
  return agentHits(agentId).reduce((sum, hit) => sum + (rotation.counts[hitKey(hit)] ?? 0) * hitMultiplier(hit, rotation.skillLevel), 0)
}
