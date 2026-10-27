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
// Attribute Anomaly damage (Assault, Burn, Shatter, Shock, Corruption, Disorder) follows genshin-optimizer's prep.ts:
//   ATK x anomaly multiplier x DMG Bonus x DEF x RES x DMG taken x Stun x Anomaly Proficiency / 100
//   x (1 + (agent level - 1) / 59)
// with no CRIT, and the anomaly multipliers from GO's data/char/util.ts (anomalyMultipliers, Disorder's base and time
// multipliers). Burn, Shock and Corruption count their ticks over the standard 10 seconds.
//
// Not yet: Sheer damage, skill-type DMG Bonuses (e.g. Basic Attack DMG), anomaly-specific bonuses (Burn DMG...) and hits
// of another attribute than the agent's. Personal, non-commercial use.

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
  // Sum over the rotation of count x anomaly multiplier, in percent of ATK (0 without anomalies)
  anomalyMultiplier?: number,
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

// genshin-optimizer's Anomaly Level Multiplier: 1 + (level - 1) / 59, so 2 at level 60
export function anomalyLevelMultiplier(level: number): number {
  return 1 + (level - 1) / 59
}

// Average damage of the whole rotation (crits counted at their rate; anomalies don't crit)
export function rotationDamage(stats: FinalStats, setup: DamageSetup): number {
  const f = damageFactors(stats, setup)
  const shared = stats.atk * f.dmgBonus * f.def * f.res * f.dmgTaken * f.stun
  const standard = (setup.multiplier / 100) * f.crit
  const anomaly = ((setup.anomalyMultiplier ?? 0) / 100) * (stats.anomalyProficiency / 100) * anomalyLevelMultiplier(setup.agentLevel)
  return shared * (standard + anomaly)
}

// Attribute Anomaly

export type AnomalyKind = 'assault' | 'burn' | 'shatter' | 'shock' | 'corruption' | 'disorder'

// What the agent's attribute triggers. Wind (Windswept) isn't modelled
const ATTRIBUTE_ANOMALY: Record<string, Exclude<AnomalyKind, 'disorder'>> = {
  Physical: 'assault',
  Fire: 'burn',
  Ice: 'shatter',
  Electric: 'shock',
  Ether: 'corruption',
}

// genshin-optimizer's anomalyMultipliers (per tick for the ones that tick), and the ticks in 10 seconds
const ANOMALY_HIT: Record<Exclude<AnomalyKind, 'disorder'>, { label: string, perHit: number, ticks: number }> = {
  assault: { label: 'Assault', perHit: 713, ticks: 1 },
  burn: { label: 'Burn (10s, 20 ticks of 50%)', perHit: 50, ticks: 20 },
  shatter: { label: 'Shatter', perHit: 500, ticks: 1 },
  shock: { label: 'Shock (10s, 10 ticks of 125%)', perHit: 125, ticks: 10 },
  corruption: { label: 'Corruption (10s, 20 ticks of 62.5%)', perHit: 62.5, ticks: 20 },
}

// Disorder: base + time multiplier x seconds left of the anomaly it ends (genshin-optimizer's disorderTimeMultipliers;
// Miyabi's Frostbite lasts 20 seconds and has its own numbers)
const DISORDER: Record<string, { base: number, perSecond: number, duration: number }> = {
  Physical: { base: 450, perSecond: 7.5, duration: 10 },
  Fire: { base: 450, perSecond: 100, duration: 10 },
  Ice: { base: 450, perSecond: 7.5, duration: 10 },
  Electric: { base: 450, perSecond: 125, duration: 10 },
  Ether: { base: 450, perSecond: 125, duration: 10 },
  Frost: { base: 600, perSecond: 75, duration: 20 },
}

const MIYABI_ID = '1091'

export type AnomalyHit = { key: string, kind: AnomalyKind, label: string }

// The anomalies an agent of this attribute triggers, as rotation lines
export function anomalyHits(agentId: string, element: string): AnomalyHit[] {
  const kind = ATTRIBUTE_ANOMALY[element]
  if (!kind) return []
  return [
    { key: `anomaly:${kind}`, kind, label: ANOMALY_HIT[kind].label },
    { key: 'anomaly:disorder', kind: 'disorder', label: agentId === MIYABI_ID ? 'Disorder (Frostbite)' : 'Disorder' },
  ]
}

// One anomaly's multiplier in percent of ATK; Disorder with the seconds that had passed of the anomaly it ends
export function anomalyMultiplier(agentId: string, element: string, kind: AnomalyKind, disorderAfter = 0): number {
  if (kind !== 'disorder') return ANOMALY_HIT[kind].perHit * ANOMALY_HIT[kind].ticks
  const disorder = DISORDER[agentId === MIYABI_ID ? 'Frost' : element]
  if (!disorder) return 0
  return disorder.base + disorder.perSecond * Math.max(0, disorder.duration - disorderAfter)
}

export function rotationAnomalyMultiplier(agentId: string, element: string, rotation: Rotation): number {
  return anomalyHits(agentId, element).reduce(
    (sum, hit) => sum + (rotation.counts[hit.key] ?? 0) * anomalyMultiplier(agentId, element, hit.kind, rotation.disorderAfter),
    0,
  )
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
  // How many times each hit lands, by hitKey, and each anomaly by its AnomalyHit key
  counts: Record<string, number>,
  skillLevel: number,
  // Seconds of the anomaly that had passed when Disorder ends it (0: right away, the most damage)
  disorderAfter?: number,
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
