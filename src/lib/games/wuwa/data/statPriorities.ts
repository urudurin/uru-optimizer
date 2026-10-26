// Which stats each Resonator's echo substats are scored on (stats/echoScore.ts), like the fixed per-character weights
// behind Fribbels' HSR relic scores and genshin/data/statPriorities.ts. Each entry says what the Resonator's damage,
// healing or buffs scale on, whether crits count, how much Energy Regen matters and which skill-type DMG bonuses they
// use. Our own table, edited by hand: from the in-game skill descriptions, or from the substat priority on Kuro's own
// guide site (wuwaguide.kurogames.com, read one page at a time; each entry cites its guide by role_id). Never copied from
// third-party guide sites. Resonators not listed are scored as ATK crit damage dealers with no skill-type DMG.
//
// From a guide's priority line: stats before ATK% outrank it; Energy Regen right after ATK% is 0.5, after the DMG
// bonuses 0.25; a guide that puts Energy Regen first (up to a threshold) gets more than the scaling stat.
//
// confidence: 'guide' = from Kuro's guide site; 'sourced' = read from the skill descriptions; 'unverified' = not
// checked yet, review it.
// Reviewed: 2026-10-26

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
  confidence: 'guide' | 'sourced' | 'unverified',
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
const guide = (dmgTypes: DmgType[], extra: Partial<StatPriority> = {}): StatPriority => ({ ...dps(dmgTypes, extra), confidence: 'guide' })

export const STAT_PRIORITIES: Record<string, StatPriority> = {
  // From the in-game skill descriptions
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
  'zani': dps(['heavyDmg']),
  'lingyang': dps(['basicDmg']),
  'sanhua': dps(['skillDmg'], { er: 0.5 }),
  'mortefi': dps(['libDmg'], { er: 0.5 }),
  'danjin': dps(['heavyDmg']),
  'cartethyia': { scaling: 'hp', crit: true, dmgTypes: ['basicDmg'], confidence: 'sourced' },
  'verina': support('atk', { er: 1 }),
  'baizhi': support('hp', { er: 1 }),
  'taoqi': support('def', { er: 0.5 }),

  // From Kuro's guide site, quoting each guide's substat priority
  // role_id=1312 Suoming (Void Enigma): "Energy Regen >= 118% > Crit DMG / Crit Rate > ATK > Basic Attack DMG Bonus"
  'suoming': guide(['basicDmg'], { er: 0.75 }),
  // role_id=1311 Hsin: Moonlit Mechanism (Void Enigma): "Energy Regen >= 118% > Crit DMG / Crit Rate > ATK > Resonance
  // Skill DMG Bonus"
  'hsin': guide(['skillDmg'], { er: 0.75 }),
  // role_id=1505 The Shorekeeper (Krow): "Energy Regen (Until 250) > HP% > FLAT HP (Crit. DMG only for Damage focused
  // builds)"
  'the-shorekeeper': { scaling: 'hp', crit: false, er: 1.25, confidence: 'guide' },
  // role_id=1506 Phoebe (WW Echoes): "Crit. Rate/Crit. DMG > ATK% > Heavy Attack DMG Bonus > Energy Regen"
  'phoebe': guide(['heavyDmg']),
  // role_id=1303 Yuanwu (WW Echoes): "Crit. Rate/Crit. DMG > DEF% > Energy Regen > Resonance Skill DMG Bonus/Resonance
  // Liberation DMG Bonus"
  'yuanwu': guide(['skillDmg', 'libDmg'], { scaling: 'def', er: 0.5 }),
  // role_id=1202 Chixia (WW Echoes): "Crit. Rate/Crit. DMG > ATK% > Resonance Skill DMG Bonus/Resonance Liberation DMG
  // Bonus > Energy Regen"
  'chixia': guide(['skillDmg', 'libDmg']),
  // role_id=1403 Aalto (WW Echoes): "Crit. Rate/Crit. DMG > ATK% > Resonance Skill DMG Bonus/Resonance Liberation DMG
  // Bonus/Basic Attack DMG Bonus"
  'aalto': guide(['skillDmg', 'libDmg', 'basicDmg']),
  // role_id=1405 Jianxin (WW Echoes): "Crit. Rate/Crit. DMG > ATK% > Energy Regen > Resonance Liberation DMG"
  'jianxin': guide(['libDmg'], { er: 0.5 }),
  // role_id=1606 Roccia (WW Echoes): "Crit. Rate > Crit. DMG > Heavy Attack DMG Bonus > ATK% > Energy Regen"
  'roccia': guide(['heavyDmg']),
  // role_id=1402 Yangyang (WW Echoes): "Crit. Rate/Crit. DMG > ATK% > Energy Regen"
  'yangyang': guide([], { er: 0.5 }),
  // role_id=1106 Youhu (Krow): "Energy Regeneration(until 160)> ATK% > Flat ATK ( Crit. Rate / Crit. DMG for dmg)"
  'youhu': { scaling: 'atk', crit: false, er: 1.25, confidence: 'guide' },
  // role_id=1502 Spectro Rover (WW Echoes): "Crit. Rate/Crit. DMG > ATK% > Resonance Skill DMG Bonus > Resonance
  // Liberation DMG Bonus"
  'rover-spectro': guide(['skillDmg', 'libDmg']),
  // role_id=1604 Havoc Rover (WW Echoes): "Crit. Rate/Crit. DMG > ATK% > Resonance Liberation DMG Bonus > Basic
  // Attack/Heavy Attack DMG Bonus"
  'rover-havoc': guide(['libDmg', 'basicDmg', 'heavyDmg']),
  // role_id=1408 Aero Rover (WW Echoes): "Crit. Rate/Crit. DMG>ATK%>Resonance Skill DMG Bonus>Energy Regen"
  'rover-aero': guide(['skillDmg']),
}

export function statPriority(charId: string): StatPriority {
  return STAT_PRIORITIES[charId] ?? DEFAULT_PRIORITY
}
