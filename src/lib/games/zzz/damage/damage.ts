import type { DamageLine } from 'lib/games/shared/damageBreakdown'
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
// multipliers). Burn, Shock and Corruption count their ticks over the standard 10 seconds. Checked against the
// community wiki's damage page (pasted by the user): the multipliers match, and like the wiki the level multiplier is
// truncated to 4 decimals and Disorder's time bonus counts whole ticks left (floored).
//
// Kit buffs to some hits only (Ultimate DMG +60%, damage/combatEffects.ts) go in as DamageSetup.bonusMultiplier: the
// sum over the rotation of count x hit multiplier x its extra DMG Bonus, so a hit's DMG Bonus is (1 + Element DMG + its
// own bonus) while the rest of the formula stays shared.
// Rupture agents deal Sheer damage with their skills, as genshin-optimizer has it (prep.ts sheerDmg): Sheer Force x
// multiplier x DMG Bonus x CRIT x RES x DMG taken x Stun, with no DEF multiplier. Their anomalies stay ATK-based.
// Armorer agents (Claret) deal Sharp damage (prep.ts sharpDmg): DEF x multiplier x DMG Bonus x DEF multiplier x RES x
// DMG taken x Stun x the Laceration multiplier, which takes CRIT's place: (1 + min(CRIT Rate, 100%) x Laceration DMG) x
// (1 + max(CRIT Rate - 100%, 0) x Laceration DMG), with 150% Laceration DMG to start (genshin-optimizer util.ts).
// Aftershock hits (genshin-optimizer's damageType2 'aftershock', listed below by agent) are skill hits like any other, but
// some kits buff only them: an Aftershock DMG Bonus goes in bonusMultiplier, and CRIT DMG or DEF ignore that only
// Aftershock gets puts those hits in their own group (DamageSetup.aftershock), with their own CRIT and DEF multipliers.
// Anomaly-specific bonuses follow GO's dmg.ts: a DMG Bonus of the anomaly's own (Shock DMG +18%) adds to DMG Bonus, a
// "buff" (Vivian's Corruption DMG +12%) is a multiplier of its own, extra Disorder multiplier (Yanagi's +250%) adds to
// Disorder's and Vortex's, and Jane's Assault can CRIT (anomaly CRIT Rate and CRIT DMG of its own).
// Wind (GO's util.ts): the anomaly is 1250% of ATK and its Disorder 100%. Vortex, which a Wind anomaly sets off on an
// enemy with another anomaly, is GO's vortex(): a base by attribute plus the anomaly's time multiplier x seconds left of
// a 30-second window. Windswept (an enemy hit by a Wind anomaly) gives direct DMG +10% and Frostbite CRIT DMG +10% when
// the squad has a Wind or Ice agent (GO's common/anomaly.ts); direct DMG here means skill hits, not anomalies.
// Not yet: Sheer and Sharp DMG Bonus stats, Alice's time-based Disorder bonus, Abloom, Polarity Disorder and hits of
// another attribute than the agent's. Personal, non-commercial use.

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
  // Enemy states that need a Wind or Ice agent in the squad: Windswept (direct DMG +10%), Frostbite (CRIT DMG +10%)
  windswept?: boolean,
  frostbite?: boolean,
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
  // Sum over the rotation of count x hit multiplier x the hit's own extra DMG Bonus (a fraction), in percent of ATK
  bonusMultiplier?: number,
  // What skill hits scale on: ATK, Sheer Force for Rupture agents (Sheer damage, which ignores DEF), or DEF for Armorer
  // agents (Sharp damage, with Laceration instead of CRIT)
  scaling?: 'atk' | 'sheer' | 'sharp',
  // Sharp damage: Laceration DMG in percent (150 to start), and CRIT Rate per point of CRIT DMG (Claret's Core Skill)
  lacerationDmg?: number,
  critRateFromCritDmg?: number,
  // Sheer or Sharp DMG Bonus in percent: a multiplier of its own on Sheer (Rupture) or Sharp (Armorer) skill hits (GO's
  // sheer_mult_ / sharp_mult_)
  sheerDmg?: number,
  sharpDmg?: number,
  // Aftershock hits, when kits give them CRIT DMG (a fraction of the agent's CRIT DMG) or DEF ignore (percent) of their
  // own; these hits are left out of multiplier and bonusMultiplier then
  aftershock?: { multiplier: number, bonusMultiplier: number, critDmgFromCritDmg: number, defIgnore: number },
  // Anomaly-specific bonuses: count x multiplier x the anomaly's own extra DMG Bonus (a fraction), and the anomalies
  // that can CRIT, as extra damage on top of anomalyMultiplier (CRIT Rate in percent, plus per point of Anomaly
  // Proficiency; CRIT DMG in percent)
  anomalyBonusMultiplier?: number,
  anomalyCrits?: AnomalyCrit[],
  // Anomaly damage that grows with Anomaly Proficiency, per point of it: atk in percent of ATK (Vivian's Abloom), flat as
  // damage (Yanagi's Polarity Disorder); the Bonus parts are their anomaly-only DMG Bonus like anomalyBonusMultiplier
  anomalyPerAp?: { atk: number, atkBonus: number, flat: number, flatBonus: number },
  agentLevel: number,
  enemy: EnemySettings,
  debuffs: EnemyDebuffs,
}

export type AnomalyCrit = { multiplier: number, bonusMultiplier: number, critRate: number, critRatePerAp: number, critDmg: number }

// DEF multiplier, with DEF ignore of some hits added to the team's shred (GO: DEF x (1 - DEF shred - DEF ignore))
function defMultiplier(stats: FinalStats, setup: Omit<DamageSetup, 'multiplier'>, defIgnore = 0): number {
  const factor = levelFactor(setup.agentLevel)
  const shred = Math.min(100, setup.debuffs.defShred + defIgnore) / 100
  const effectiveDef = Math.max(0, setup.enemy.def * (1 - shred) * (1 - stats.penRatio / 100) - stats.pen)
  return factor / (factor + effectiveDef)
}

// Each multiplier, for showing where the damage comes from
export function damageFactors(stats: FinalStats, setup: Omit<DamageSetup, 'multiplier'>) {
  const critRate = Math.min(100, Math.max(0, stats.critRate)) / 100
  const critDmg = (stats.critDmg + (setup.enemy.frostbite ? 10 : 0)) / 100
  return {
    dmgBonus: 1 + stats.elementDmg / 100,
    critRate,
    critDmg,
    crit: 1 + critRate * critDmg,
    def: defMultiplier(stats, setup),
    // Windswept: direct DMG (skill hits) +10%
    direct: setup.enemy.windswept ? 1.1 : 1,
    res: 1 - setup.enemy.res / 100 + setup.debuffs.resShred / 100,
    dmgTaken: 1 + setup.debuffs.dmgTaken / 100,
    stun: setup.enemy.stunned ? setup.enemy.stunMultiplier / 100 : 1,
  }
}

// Anomaly Level Multiplier: 1 + (level - 1) / 59, truncated to 4 decimals; 2 at level 60
export function anomalyLevelMultiplier(level: number): number {
  return Math.floor((1 + (level - 1) / 59) * 10000) / 10000
}

type Factors = ReturnType<typeof damageFactors>

// Skill hits of a summed multiplier: ATK, Sheer Force or DEF (Sharp) x DMG Bonus x CRIT (or Laceration) x DEF, with
// CRIT DMG and DEF ignore that only these hits get
function skillDamage(
  stats: FinalStats,
  setup: DamageSetup,
  f: Factors,
  multiplier: number,
  bonusMultiplier: number,
  critDmgFromCritDmg = 0,
  defIgnore = 0,
): number {
  if (multiplier === 0 && bonusMultiplier === 0) return 0
  const hits = (multiplier * f.dmgBonus + bonusMultiplier) / 100
  const crit = 1 + f.critRate * (f.critDmg + critDmgFromCritDmg * stats.critDmg / 100)
  const def = defIgnore ? defMultiplier(stats, setup, defIgnore) : f.def
  // Rupture agents' skill hits are Sheer damage: Sheer Force instead of ATK, and no DEF multiplier
  if (setup.scaling === 'sheer') return stats.sheerForce * hits * crit * (1 + (setup.sheerDmg ?? 0) / 100)
  if (setup.scaling === 'sharp') {
    const critRate = Math.max(0, stats.critRate + (setup.critRateFromCritDmg ?? 0) * stats.critDmg) / 100
    const laceration = (setup.lacerationDmg ?? 150) / 100
    return stats.def * def * hits * (1 + Math.min(critRate, 1) * laceration) * (1 + Math.max(critRate - 1, 0) * laceration)
      * (1 + (setup.sharpDmg ?? 0) / 100)
  }
  return stats.atk * def * hits * crit
}

// Average damage of the whole rotation (crits counted at their rate; anomalies crit only with a kit that says so)
export function rotationDamage(stats: FinalStats, setup: DamageSetup): number {
  const f = damageFactors(stats, setup)
  const shared = f.res * f.dmgTaken * f.stun
  const aftershock = setup.aftershock
  const standard = skillDamage(stats, setup, f, setup.multiplier, setup.bonusMultiplier ?? 0)
    + (aftershock
      ? skillDamage(stats, setup, f, aftershock.multiplier, aftershock.bonusMultiplier, aftershock.critDmgFromCritDmg, aftershock.defIgnore)
      : 0)
  let anomalyHits = (setup.anomalyMultiplier ?? 0) * f.dmgBonus + (setup.anomalyBonusMultiplier ?? 0)
  for (const crit of setup.anomalyCrits ?? []) {
    const rate = Math.min(1, Math.max(0, crit.critRate + crit.critRatePerAp * stats.anomalyProficiency) / 100)
    anomalyHits += (crit.multiplier * f.dmgBonus + crit.bonusMultiplier) * rate * crit.critDmg / 100
  }
  const ap = stats.anomalyProficiency
  const perAp = setup.anomalyPerAp
  if (perAp) anomalyHits += (perAp.atk * f.dmgBonus + perAp.atkBonus) * ap
  const flat = perAp ? (perAp.flat * f.dmgBonus + perAp.flatBonus) * ap : 0
  const anomaly = anomalyHits === 0 && flat === 0
    ? 0
    : (stats.atk * anomalyHits / 100 + flat) * f.def * (ap / 100) * anomalyLevelMultiplier(setup.agentLevel)
  return shared * (standard * f.direct + anomaly)
}

// Attribute Anomaly

export type AnomalyKind = 'assault' | 'burn' | 'shatter' | 'shock' | 'corruption' | 'wind' | 'disorder' | 'vortex' | 'abloom' | 'polarity'
type AttributeAnomaly = Exclude<AnomalyKind, 'disorder' | 'vortex' | 'abloom' | 'polarity'>

// What the agent's attribute triggers
const ATTRIBUTE_ANOMALY: Record<string, AttributeAnomaly> = {
  Physical: 'assault',
  Fire: 'burn',
  Ice: 'shatter',
  Electric: 'shock',
  Ether: 'corruption',
  Wind: 'wind',
}

// genshin-optimizer's anomalyMultipliers (per tick for the ones that tick), and the ticks in 10 seconds
const ANOMALY_HIT: Record<AttributeAnomaly, { label: string, perHit: number, ticks: number }> = {
  assault: { label: 'Assault', perHit: 713, ticks: 1 },
  burn: { label: 'Burn (10s, 20 ticks of 50%)', perHit: 50, ticks: 20 },
  shatter: { label: 'Shatter', perHit: 500, ticks: 1 },
  shock: { label: 'Shock (10s, 10 ticks of 125%)', perHit: 125, ticks: 10 },
  corruption: { label: 'Corruption (10s, 20 ticks of 62.5%)', perHit: 62.5, ticks: 20 },
  wind: { label: 'Wind anomaly', perHit: 1250, ticks: 1 },
}

// Disorder: base + per tick x whole ticks left of the anomaly it ends, floor((duration - time passed) x ticks per
// second). Burn and Corruption tick twice a second, the rest once. Miyabi's Frost (20 seconds, 600% + floor(t) x 75%)
// is genshin-optimizer's, and matches zerozoneshop.com's damage formula guide (read once by hand, user's link). Wind's
// Disorder is 100% with no time part (GO)
const DISORDER: Record<string, { base: number, perTick: number, ticksPerSecond: number, duration: number }> = {
  Physical: { base: 450, perTick: 7.5, ticksPerSecond: 1, duration: 10 },
  Fire: { base: 450, perTick: 50, ticksPerSecond: 2, duration: 10 },
  Ice: { base: 450, perTick: 7.5, ticksPerSecond: 1, duration: 10 },
  Electric: { base: 450, perTick: 125, ticksPerSecond: 1, duration: 10 },
  Ether: { base: 450, perTick: 62.5, ticksPerSecond: 2, duration: 10 },
  Frost: { base: 600, perTick: 75, ticksPerSecond: 1, duration: 20 },
  Wind: { base: 100, perTick: 0, ticksPerSecond: 1, duration: 10 },
}

// Vortex (GO's vortexMultipliers and disorderTimeMultipliers): base + per second x seconds left of 30, not floored
const VORTEX: Record<string, { base: number, perSecond: number }> = {
  Physical: { base: 800, perSecond: 7.5 },
  Fire: { base: 900, perSecond: 100 },
  Ice: { base: 1300, perSecond: 7.5 },
  Electric: { base: 650, perSecond: 125 },
  Ether: { base: 650, perSecond: 125 },
  Frost: { base: 0, perSecond: 75 },
}
const VORTEX_SECONDS = 30

const MIYABI_ID = '1091'
const VIVIAN_ID = '1331'
const YANAGI_ID = '1221'

// Vivian's Abloom (GO's Vivian sheet and util.ts abloomDmgInst): an anomaly's single-hit multiplier (GO's
// anomalyMultipliers) times her Core Skill's per-attribute rate per 10 Anomaly Proficiency, at Core Skill F. Its
// multiplier grows with Anomaly Proficiency, so the rotation keeps it per point of AP (DamageSetup.anomalyPerAp)
const ABLOOM: Record<string, { perHit: number, per10Ap: number }> = {
  Physical: { perHit: 713, per10Ap: 0.0075 },
  Fire: { perHit: 50, per10Ap: 0.08 },
  Ice: { perHit: 500, per10Ap: 0.0108 },
  Electric: { perHit: 125, per10Ap: 0.032 },
  Ether: { perHit: 62.5, per10Ap: 0.0615 },
  Wind: { perHit: 1250, per10Ap: 0.0032 },
}

// Abloom multiplier in percent of ATK per point of Anomaly Proficiency
export function abloomPerAp(attribute: string): number {
  const abloom = ABLOOM[attribute]
  return abloom ? abloom.perHit * abloom.per10Ap / 10 : 0
}

// Yanagi's Polarity Disorder (GO's Yanagi sheet): 15% of her Disorder (anom_base_ -85%) plus (500% + 225% per level of
// the skill that sets it off) of Anomaly Proficiency as flat damage, which also gets the Anomaly Proficiency and level
// multipliers (GO prep.ts anom_flat_dmg). Taken at the rotation's skill level, before Mindscape 2
export const POLARITY_SHARE = 0.15

export function polarityFlatPerAp(skillLevel: number): number {
  return 5 + 2.25 * skillLevel
}

// attribute: the anomaly a Vortex comes from
export type AnomalyHit = { key: string, kind: AnomalyKind, label: string, attribute?: string }

// The anomalies an agent of this attribute triggers, as rotation lines. A Wind agent can set off Vortex from every other
// anomaly; others only their own, and only with a Wind agent in the squad
export function anomalyHits(agentId: string, element: string, teamElements: string[] = []): AnomalyHit[] {
  const kind = ATTRIBUTE_ANOMALY[element]
  if (!kind) return []
  const own = agentId === MIYABI_ID ? 'Frost' : element
  const vortex = element === 'Wind'
    ? ['Physical', 'Fire', 'Ice', 'Electric', 'Ether', 'Frost']
    : teamElements.includes('Wind')
    ? [own]
    : []
  return [
    { key: `anomaly:${kind}`, kind, label: ANOMALY_HIT[kind].label },
    { key: 'anomaly:disorder', kind: 'disorder', label: agentId === MIYABI_ID ? 'Disorder (Frostbite)' : 'Disorder' },
    ...(agentId === YANAGI_ID ? [{ key: 'anomaly:polarity', kind: 'polarity', label: 'Polarity Disorder' } satisfies AnomalyHit] : []),
    ...vortex.map((attribute): AnomalyHit => ({ key: `anomaly:vortex:${attribute}`, kind: 'vortex', label: `Vortex (${attribute})`, attribute })),
    ...(agentId === VIVIAN_ID
      ? Object.keys(ABLOOM).map((attribute): AnomalyHit => ({ key: `anomaly:abloom:${attribute}`, kind: 'abloom', label: `Abloom (${attribute})`, attribute }))
      : []),
  ]
}

// One anomaly's multiplier in percent of ATK; Disorder and Vortex with the seconds that had passed of the anomaly they end
export function anomalyMultiplier(agentId: string, element: string, kind: AnomalyKind, disorderAfter = 0, attribute?: string): number {
  // Abloom's grows with Anomaly Proficiency (abloomPerAp); Polarity Disorder's ATK part is a share of Disorder's
  if (kind === 'abloom') return 0
  if (kind === 'polarity') return POLARITY_SHARE * anomalyMultiplier(agentId, element, 'disorder', disorderAfter)
  if (kind === 'vortex') {
    const vortex = VORTEX[attribute ?? element]
    return vortex ? vortex.base + vortex.perSecond * Math.max(0, VORTEX_SECONDS - disorderAfter) : 0
  }
  if (kind !== 'disorder') return ANOMALY_HIT[kind].perHit * ANOMALY_HIT[kind].ticks
  const disorder = DISORDER[agentId === MIYABI_ID ? 'Frost' : element]
  if (!disorder) return 0
  return disorder.base + disorder.perTick * Math.floor(Math.max(0, disorder.duration - disorderAfter) * disorder.ticksPerSecond)
}

// Bonuses to some anomalies only, in percent: dmg adds to DMG Bonus, buff is a multiplier of its own (1 + buff), add
// goes on the multiplier (Disorder's, which Vortex gets too), and an anomaly that can CRIT has a CRIT Rate (plus per
// point of Anomaly Proficiency) and CRIT DMG. addPerSecondLeft adds to Disorder's multiplier per second the anomaly
// had left of 10 (Alice). 'anomaly' is every attribute anomaly and Abloom (not Disorder, Polarity Disorder or Vortex)
export type AnomalyBonus = {
  dmg?: number,
  buff?: number,
  add?: number,
  addPerSecondLeft?: number,
  critRate?: number,
  critRatePerAp?: number,
  critDmg?: number,
}
export type AnomalyBonuses = Partial<Record<AnomalyKind | 'anomaly', AnomalyBonus>>

export function addAnomalyBonuses(into: AnomalyBonuses, from: AnomalyBonuses): AnomalyBonuses {
  for (const [key, bonus] of Object.entries(from) as [keyof AnomalyBonuses, AnomalyBonus][]) {
    const current: Record<string, number> = { ...into[key] }
    for (const [field, value] of Object.entries(bonus)) current[field] = (current[field] ?? 0) + value
    into[key] = current
  }
  return into
}

function bonusFor(kind: AnomalyKind, bonuses: AnomalyBonuses): AnomalyBonus {
  // Polarity Disorder is a Disorder
  if (kind === 'polarity') return bonusFor('disorder', bonuses)
  const parts = [bonuses[kind], kind === 'disorder' || kind === 'vortex' ? undefined : bonuses.anomaly]
  const total: AnomalyBonus = {}
  for (const part of parts) {
    for (const [field, value] of Object.entries(part ?? {}) as [keyof AnomalyBonus, number][]) total[field] = (total[field] ?? 0) + value
  }
  // Extra Disorder multiplier counts for Vortex too
  if (kind === 'vortex') total.add = (total.add ?? 0) + (bonuses.disorder?.add ?? 0)
  return total
}

// The rotation's anomalies for DamageSetup: summed multipliers, the part from anomaly-only DMG Bonus, and the anomalies
// that can CRIT
export function rotationAnomaly(
  agentId: string,
  element: string,
  rotation: Rotation,
  teamElements: string[] = [],
  bonuses: AnomalyBonuses = {},
): Pick<DamageSetup, 'anomalyMultiplier' | 'anomalyBonusMultiplier' | 'anomalyCrits' | 'anomalyPerAp'> {
  let multiplier = 0
  let bonusMultiplier = 0
  const crits: AnomalyCrit[] = []
  const perAp = { atk: 0, atkBonus: 0, flat: 0, flatBonus: 0 }
  const secondsLeft = Math.max(0, 10 - (rotation.disorderAfter ?? 0))
  for (const hit of anomalyHits(agentId, element, teamElements)) {
    const count = rotation.counts[hit.key] ?? 0
    if (!count) continue
    const bonus = bonusFor(hit.kind, bonuses)
    const buff = 1 + (bonus.buff ?? 0) / 100
    const add = (bonus.add ?? 0) + (hit.kind === 'disorder' || hit.kind === 'polarity' ? (bonus.addPerSecondLeft ?? 0) * secondsLeft : 0)
    if (hit.kind === 'abloom') {
      perAp.atk += count * abloomPerAp(hit.attribute ?? element) * buff
      perAp.atkBonus += count * abloomPerAp(hit.attribute ?? element) * buff * (bonus.dmg ?? 0) / 100
      continue
    }
    if (hit.kind === 'polarity') {
      perAp.flat += count * polarityFlatPerAp(rotation.skillLevel) * buff
      perAp.flatBonus += count * polarityFlatPerAp(rotation.skillLevel) * buff * (bonus.dmg ?? 0) / 100
    }
    const total = count * (anomalyMultiplier(agentId, element, hit.kind, rotation.disorderAfter, hit.attribute)
      + (hit.kind === 'polarity' ? POLARITY_SHARE : 1) * add)
      * buff
    multiplier += total
    bonusMultiplier += total * (bonus.dmg ?? 0) / 100
    if (bonus.critDmg) {
      crits.push({
        multiplier: total,
        bonusMultiplier: total * (bonus.dmg ?? 0) / 100,
        critRate: bonus.critRate ?? 0,
        critRatePerAp: bonus.critRatePerAp ?? 0,
        critDmg: bonus.critDmg,
      })
    }
  }
  const anyPerAp = perAp.atk !== 0 || perAp.flat !== 0
  return { anomalyMultiplier: multiplier, anomalyBonusMultiplier: bonusMultiplier, anomalyCrits: crits, ...(anyPerAp ? { anomalyPerAp: perAp } : {}) }
}

export function rotationAnomalyMultiplier(agentId: string, element: string, rotation: Rotation, teamElements: string[] = []): number {
  return rotationAnomaly(agentId, element, rotation, teamElements).anomalyMultiplier ?? 0
}

// Skills

// What a hit counts as, for kit DMG Bonuses: from the skill's name, or its category when the name doesn't say
export type HitKind = 'basic' | 'dash' | 'dodgeCounter' | 'special' | 'exSpecial' | 'chain' | 'ult' | 'quickAssist' | 'assist' | 'assistFollowUp'

const KIND_PREFIXES: [string, HitKind][] = [
  ['BasicAttack', 'basic'],
  ['DashAttack', 'dash'],
  ['DodgeCounter', 'dodgeCounter'],
  ['EXSpecialAttack', 'exSpecial'],
  ['SpecialAttack', 'special'],
  ['ChainAttack', 'chain'],
  ['Ultimate', 'ult'],
  ['QuickAssist', 'quickAssist'],
  ['AssistFollowUp', 'assistFollowUp'],
  ['DefensiveAssist', 'assist'],
  ['EvasiveAssist', 'assist'],
]
const CATEGORY_KINDS: Record<string, HitKind> = { basic: 'basic', dodge: 'dash', special: 'special', chain: 'chain', assist: 'assistFollowUp' }

export function hitKind(skill: string, category: string): HitKind {
  return KIND_PREFIXES.find(([prefix]) => skill.startsWith(prefix))?.[1] ?? CATEGORY_KINDS[category] ?? 'basic'
}

export type SkillHit = {
  skill: string,
  category: string,
  kind: HitKind,
  // An Aftershock hit, for Aftershock DMG Bonuses
  aftershock: boolean,
  index: number,
  label: string,
  base: number,
  growth: number,
}

// Aftershock hits by agent id, as hit keys: genshin-optimizer's sheets mark them damageType2 'aftershock'. Soldier 0 -
// Anby's Chain Attack and Ultimate are Aftershock with a Stun or Support agent in the squad (her Additional Ability)
const AFTERSHOCK_HITS: Record<string, string[]> = {
  // Orphie & Magus
  '1301': [
    'BasicAttackHighPressureFlamethrower:5',
    'SpecialAttackCorrosiveFlash:0',
    'EXSpecialAttackWatchYourStep:0',
    'EXSpecialAttackCrimsonVortex:0',
    'EXSpecialAttackHeatCharge:0',
    'EXSpecialAttackFieryEruption:0',
    'ChainAttackOverheatedBarrel:0',
    'UltimateDanceWithFire:0',
  ],
  // Pulchra
  '1351': ['SpecialAttackRendingClawNightmareShadow:0'],
  // Trigger
  '1361': ['BasicAttackHarmonizingShot:0', 'BasicAttackHarmonizingShotTartarus:1'],
  // Soldier 0 - Anby
  '1381': ['ChainAttackLeapingThunderstrike:0', 'UltimateVoidstrike:0'],
  // Ju Fufu
  '1391': ['ChainAttackSuppressingTigerCauldron:0'],
  // Yuzuha
  '1411': ['BasicAttackHardCandyShot:0'],
  // Lucia
  '1451': ['SpecialAttackSymphonyOfTheReaperStorm:2'],
}

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
      kind: hitKind(skill.key, skill.category),
      aftershock: AFTERSHOCK_HITS[agentId]?.includes(`${skill.key}:${index}`) ?? false,
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

// DMG Bonus by kind of hit; 'aftershock' goes on top of the hit's own kind
export type KindBonus = Partial<Record<HitKind | 'aftershock', number>>

type HitFilter = (hit: SkillHit) => boolean

// Sum of count x hit multiplier x the hit's extra DMG Bonus (kind and skill bonuses, in percent), for DamageSetup
export function rotationBonusMultiplier(
  agentId: string,
  rotation: Rotation,
  kindBonus: KindBonus,
  skillBonus: Record<string, number>,
  only: HitFilter = () => true,
): number {
  return agentHits(agentId).filter(only).reduce((sum, hit) => {
    const bonus = (kindBonus[hit.kind] ?? 0) + (hit.aftershock ? kindBonus.aftershock ?? 0 : 0) + (skillBonus[hit.skill] ?? 0)
    return sum + (rotation.counts[hitKey(hit)] ?? 0) * hitMultiplier(hit, rotation.skillLevel) * bonus / 100
  }, 0)
}

export function rotationMultiplier(agentId: string, rotation: Rotation, only: HitFilter = () => true): number {
  return agentHits(agentId).filter(only).reduce((sum, hit) => sum + (rotation.counts[hitKey(hit)] ?? 0) * hitMultiplier(hit, rotation.skillLevel), 0)
}

// The rotation's skill hits for DamageSetup; Aftershock hits get their own group when a kit gives them CRIT DMG or DEF
// ignore of their own
export function rotationSkills(
  agentId: string,
  rotation: Rotation,
  kindBonus: KindBonus,
  skillBonus: Record<string, number>,
  aftershock: { critDmgFromCritDmg: number, defIgnore: number } = { critDmgFromCritDmg: 0, defIgnore: 0 },
): Pick<DamageSetup, 'multiplier' | 'bonusMultiplier' | 'aftershock'> {
  if (!aftershock.critDmgFromCritDmg && !aftershock.defIgnore) {
    return { multiplier: rotationMultiplier(agentId, rotation), bonusMultiplier: rotationBonusMultiplier(agentId, rotation, kindBonus, skillBonus) }
  }
  const isAftershock: HitFilter = (hit) => hit.aftershock
  const notAftershock: HitFilter = (hit) => !hit.aftershock
  return {
    multiplier: rotationMultiplier(agentId, rotation, notAftershock),
    bonusMultiplier: rotationBonusMultiplier(agentId, rotation, kindBonus, skillBonus, notAftershock),
    aftershock: {
      multiplier: rotationMultiplier(agentId, rotation, isAftershock),
      bonusMultiplier: rotationBonusMultiplier(agentId, rotation, kindBonus, skillBonus, isAftershock),
      ...aftershock,
    },
  }
}

// What a hit's skill category is called, for the Rotation card and the damage breakdown
export const HIT_CATEGORY_LABELS: Record<string, string> = {
  basic: 'Basic Attack',
  dodge: 'Dodge',
  special: 'Special Attack',
  chain: 'Chain Attack & Ultimate',
  assist: 'Assist',
}

// The rotation's counted lines, for the damage breakdown (shared/damageBreakdown.ts)
export function rotationLines(agentId: string, element: string, rotation: Rotation, teamElements: string[] = []): DamageLine[] {
  return [
    ...agentHits(agentId).map((hit) => ({
      key: hitKey(hit),
      label: hit.label,
      group: HIT_CATEGORY_LABELS[hit.category] ?? hit.category,
      count: rotation.counts[hitKey(hit)] ?? 0,
    })),
    ...anomalyHits(agentId, element, teamElements).map((hit) => ({
      key: hit.key,
      label: hit.label,
      group: 'Attribute Anomaly',
      count: rotation.counts[hit.key] ?? 0,
    })),
  ]
}

// The rotation with only one line in it
export function singleLineRotation(rotation: Rotation, line: DamageLine): Rotation {
  return { ...rotation, counts: { [line.key]: line.count } }
}
