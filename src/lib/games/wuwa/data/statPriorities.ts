// Which stats each Resonator's echo substats are scored on (stats/echoScore.ts), like the fixed per-character weights
// behind Fribbels' HSR relic scores and genshin/data/statPriorities.ts. Each entry says what the Resonator's damage,
// healing or buffs scale on, whether crits count, how much Energy Regen matters and which skill-type DMG bonuses they
// use. Our own table from the in-game skill descriptions, edited by hand: never copied from guide sites. Resonators not
// listed are scored as ATK crit damage dealers with no skill-type DMG.
//
// confidence: 'sourced' = read from the skill descriptions; 'unverified' = not checked against the game yet, review it.
// Reviewed: 2026-10-26 (needs the user's review)

export type ScalingStat = 'atk' | 'hp' | 'def'
export type DmgType = 'basicDmg' | 'heavyDmg' | 'skillDmg' | 'libDmg'

export type StatPriority = {
  scaling: ScalingStat,
  // Whether Crit Rate and Crit DMG count
  crit: boolean,
  // Energy Regen's weight, against Crit at 1 (default 0.25 for crit Resonators, 0.5 otherwise)
  er?: number,
  // Skill types most of their damage comes from, weighted 0.5 each
  dmgTypes?: DmgType[],
  confidence: 'sourced' | 'unverified',
}

export const STAT_REVIEWED = '2026-10-26'

export const DEFAULT_PRIORITY: StatPriority = { scaling: 'atk', crit: true, confidence: 'unverified' }

const dps = (dmgTypes: DmgType[], extra: Partial<StatPriority> = {}): StatPriority => ({
  scaling: 'atk',
  crit: true,
  dmgTypes,
  confidence: 'sourced',
  ...extra,
})
// Supports whose heals, shields and buffs don't crit
const support = (scaling: ScalingStat, extra: Partial<StatPriority> = {}): StatPriority => ({ scaling, crit: false, confidence: 'sourced', ...extra })
const unverified = (extra: Partial<StatPriority> = {}): StatPriority => ({ ...DEFAULT_PRIORITY, ...extra, confidence: 'unverified' })

export const STAT_PRIORITIES: Record<string, StatPriority> = {
  // Damage dealers
  'jiyan': dps(['heavyDmg'], { er: 0.5 }),
  'calcharo': dps(['libDmg']),
  'encore': dps(['basicDmg']),
  'yinlin': dps(['skillDmg'], { er: 0.5 }),
  'changli': dps(['skillDmg']),
  'jinhsi': dps(['skillDmg']),
  'camellya': dps(['basicDmg']),
  'zhezhi': dps(['skillDmg'], { er: 0.5 }),
  'xiangli-yao': dps(['libDmg']),
  'carlotta': dps(['skillDmg']),
  'phoebe': dps(['heavyDmg']),
  'zani': dps(['heavyDmg']),
  'lingyang': dps(['basicDmg']),
  'sanhua': dps(['skillDmg'], { er: 0.5 }),
  'mortefi': dps(['libDmg'], { er: 0.5 }),
  'danjin': dps(['heavyDmg']),
  'cartethyia': { scaling: 'hp', crit: true, dmgTypes: ['basicDmg'], confidence: 'sourced' },
  // Kuro's official guide site (wuwaguide.kurogames.com, Suoming guide): "Energy Regen >= 118% > Crit DMG / Crit Rate >
  // ATK > Basic Attack DMG Bonus"
  'suoming': dps(['basicDmg'], { er: 0.75 }),

  // Supports
  'verina': support('atk', { er: 1 }),
  'baizhi': support('hp', { er: 1 }),
  'the-shorekeeper': support('hp', { er: 1 }),
  'taoqi': support('def', { er: 0.5 }),

  // Not checked against the game yet
  'yuanwu': unverified({ scaling: 'def', dmgTypes: ['skillDmg'] }),
  'chixia': unverified({ dmgTypes: ['skillDmg'] }),
  'aalto': unverified({ dmgTypes: ['basicDmg'] }),
  'jianxin': unverified({ dmgTypes: ['heavyDmg'] }),
  'roccia': unverified({ dmgTypes: ['heavyDmg'], er: 0.5 }),
  'yangyang': unverified({ crit: false, er: 0.75 }),
  'youhu': unverified({ crit: false, er: 0.5 }),
  'rover-aero': unverified({ crit: false, er: 0.5 }),
  'rover-spectro': unverified({ dmgTypes: ['basicDmg'] }),
  'rover-havoc': unverified({ dmgTypes: ['basicDmg'] }),
}

export function statPriority(charId: string): StatPriority {
  return STAT_PRIORITIES[charId] ?? DEFAULT_PRIORITY
}
