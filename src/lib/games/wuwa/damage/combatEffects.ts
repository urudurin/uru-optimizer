import type {
  HitType,
  LineScale,
} from 'lib/games/wuwa/damage/damage'
import type { Bonus } from 'lib/games/wuwa/stats/computeStats'

// What a Resonator's own kit does in combat (Inherent Skills, Forte states), on top of the stat screen: the buffs that
// make the rotation damage line up with the game. Read by hand from the datamine's skill text (Arikatsu/WutheringWaves_Data,
// BinData/skill/skill.json SkillDescribe + SkillDetailNum with the English MultiText), each entry quoting its skill.
// Each effect gives
//   - bonus: stat bonuses (ATK%, element DMG, Crit DMG...) for the stat calculator, like a team bonus
//   - amplify: DMG Amplified for every hit ('all') or one kind (Liberation DMG Amplified...)
//   - defIgnore / resShred: DEF ignored and RES ignored, added to the enemy card's
// Only the optimizer counts them, and only when ranking by rotation damage. The Resonators in the user's save and the
// common damage dealers. Personal, non-commercial use.

export type WuwaEffectToggle = { kind: 'switch', label: string } | { kind: 'stacks', label: string, max: number }

export type WuwaCombatContext = { sequence: number, setting: boolean | number }

export type WuwaCombatEffect = {
  id: string,
  label: string,
  toggle?: WuwaEffectToggle,
  // Starts off: the effect belongs to a mode or state the Resonator isn't usually in
  offByDefault?: boolean,
  minSequence?: number,
  bonus?: (context: WuwaCombatContext) => Bonus,
  amplify?: (context: WuwaCombatContext) => Partial<Record<HitType | 'all', number>>,
  defIgnore?: number,
  resShred?: (context: WuwaCombatContext) => number,
  // Raises some lines' multipliers (Jinhsi's Intro, Suoming's Unfurled Canopy)
  lineScale?: (context: WuwaCombatContext) => LineScale[],
  confidence: 'confirmed' | 'sourced' | 'unverified',
}

const stacks = (setting: boolean | number) => (typeof setting === 'number' ? setting : 0)

// By Resonator id
export const KIT_EFFECTS: Record<string, WuwaCombatEffect[]> = {
  'hsin': [
    {
      id: 'hsin-tides-atk',
      label: 'Tides of Succession: ATK +50% for 8s after Intro Skill - Manifold Unison (Resonance Mode - Unison)',
      toggle: { kind: 'switch', label: 'Unison, after Manifold Unison' },
      bonus: () => ({ atkPct: 50 }),
      confidence: 'sourced',
    },
    {
      id: 'hsin-tides-electro',
      label: 'Tides of Succession: Electro DMG +25% per Electro Flare inflicted by a teammate, up to 2 (Resonance Mode - Electro Flare)',
      toggle: { kind: 'stacks', label: 'Electro Flare stacks', max: 2 },
      offByDefault: true,
      bonus: ({ setting }) => ({ electroDmg: 25 * stacks(setting) }),
      confidence: 'sourced',
    },
  ],
  'suoming': [
    {
      id: 'suoming-covenant',
      label: 'Rain-Soaked Covenant: Electro DMG +50% for 15s after her Intro Skill',
      toggle: { kind: 'switch', label: 'After her Intro' },
      bonus: () => ({ electroDmg: 50 }),
      confidence: 'sourced',
    },
    {
      id: 'suoming-seal-master',
      label: 'Sunken Seal, Forged Lock: Seal Master: Crit DMG +100% and Basic Attack - Unfurled Canopy (and Whirling Thunder) DMG Multipliers +100% for 12s',
      toggle: { kind: 'switch', label: 'Seal Master' },
      offByDefault: true,
      bonus: () => ({ critDmg: 100 }),
      lineScale: () => [{ labelStart: 'Basic Attack - Unfurled Canopy', scale: 1 }],
      confidence: 'sourced',
    },
  ],
  'the-shorekeeper': [{
    id: 'shorekeeper-gravitation',
    label: 'Self Gravitation: Energy Regen +10% while the on-field Resonator is in a Stellarealm',
    toggle: { kind: 'switch', label: 'In a Stellarealm' },
    bonus: () => ({ energyRegen: 10 }),
    confidence: 'sourced',
  }],
  'jinhsi': [
    {
      id: 'jinhsi-radiant-surge',
      label: 'Radiant Surge: Spectro DMG +20%',
      bonus: () => ({ spectroDmg: 20 }),
      confidence: 'sourced',
    },
    {
      id: 'jinhsi-converged-flash',
      label: 'Converged Flash: Intro Skill Loong\'s Halo DMG Multiplier +50%',
      lineScale: () => [{ section: 'intro', scale: 0.5 }],
      confidence: 'sourced',
    },
  ],
  'changli': [
    {
      id: 'changli-strategist',
      label: 'Secret Strategist: Fusion DMG +5% per Enflamement stack when casting True Sight - Conquest or Charge',
      toggle: { kind: 'stacks', label: 'Enflamement stacks', max: 4 },
      bonus: ({ setting }) => ({ fusionDmg: 5 * stacks(setting) }),
      confidence: 'sourced',
    },
    {
      id: 'changli-sweeping-force',
      label: 'Sweeping Force: Fusion DMG +20% and 15% DEF ignored after Heavy Attack Flaming Sacrifice or her Liberation',
      toggle: { kind: 'switch', label: 'After Flaming Sacrifice or Liberation' },
      bonus: () => ({ fusionDmg: 20 }),
      defIgnore: 15,
      confidence: 'sourced',
    },
  ],
  'camellya': [{
    id: 'camellya-seedbed-epiphyte',
    label: 'Seedbed and Epiphyte: Havoc DMG +15% and Basic Attack DMG +15%',
    bonus: () => ({ havocDmg: 15, basicDmg: 15 }),
    confidence: 'sourced',
  }],
  'zani': [{
    id: 'zani-quick-response',
    label: 'Quick Response: Spectro DMG +12% for 14s after her Intro Skill',
    toggle: { kind: 'switch', label: 'After her Intro' },
    bonus: () => ({ spectroDmg: 12 }),
    confidence: 'sourced',
  }],
  'phoebe': [{
    id: 'phoebe-revelation',
    label: 'Revelation: Spectro DMG +12% in Absolution or Confession',
    toggle: { kind: 'switch', label: 'Absolution or Confession' },
    bonus: () => ({ spectroDmg: 12 }),
    confidence: 'sourced',
  }],
  'jiyan': [
    {
      id: 'jiyan-heavenly-balance',
      label: 'Heavenly Balance: ATK +10% for 15s after his Intro Skill',
      toggle: { kind: 'switch', label: 'After his Intro' },
      bonus: () => ({ atkPct: 10 }),
      confidence: 'sourced',
    },
    {
      id: 'jiyan-tempest-taming',
      label: 'Tempest Taming: Crit DMG +12% for 8s after his attacks hit',
      toggle: { kind: 'switch', label: 'After hitting' },
      bonus: () => ({ critDmg: 12 }),
      confidence: 'sourced',
    },
  ],
  'cartethyia': [{
    id: 'cartethyia-imprint',
    label: 'Wind\'s Indelible Imprint: targets with Aero Erosion take 30% more DMG from her, +10% per stack above 3 (up to 6)',
    toggle: { kind: 'stacks', label: 'Aero Erosion stacks', max: 6 },
    amplify: ({ setting }) => {
      const n = stacks(setting)
      return { all: n === 0 ? 0 : 30 + 10 * Math.max(0, Math.min(3, n - 3)) }
    },
    confidence: 'sourced',
  }],
  'encore': [{
    id: 'encore-woolies',
    label: 'Woolies Cheer Dance: Fusion DMG +10% for 10s after Flaming Woolies or Cosmos - Rampage',
    toggle: { kind: 'switch', label: 'After her Resonance Skill' },
    bonus: () => ({ fusionDmg: 10 }),
    confidence: 'sourced',
  }],
  'calcharo': [{
    id: 'calcharo-bloodshed',
    label: 'Bloodshed Awaken: Resonance Liberation DMG +10% for 15s after Heavy Attack Mercy',
    toggle: { kind: 'switch', label: 'After Mercy' },
    bonus: () => ({ libDmg: 10 }),
    confidence: 'sourced',
  }],
  'yinlin': [
    {
      id: 'yinlin-pain-immersion',
      label: 'Pain Immersion: Crit Rate +15% for 5s after Magnetic Roar',
      toggle: { kind: 'switch', label: 'After Magnetic Roar' },
      bonus: () => ({ critRate: 15 }),
      confidence: 'sourced',
    },
    {
      id: 'yinlin-deadly-focus',
      label: 'Deadly Focus: ATK +10% for 4s after Lightning Execution hits a target with Sinner\'s Mark',
      toggle: { kind: 'switch', label: 'After Lightning Execution' },
      bonus: () => ({ atkPct: 10 }),
      confidence: 'sourced',
    },
  ],
  'xiangli-yao': [{
    id: 'xiangli-yao-knowing',
    label: 'Knowing: Electro DMG +5% per Resonance Skill cast, up to 4',
    toggle: { kind: 'stacks', label: 'Stacks', max: 4 },
    bonus: ({ setting }) => ({ electroDmg: 5 * stacks(setting) }),
    confidence: 'sourced',
  }],
  'zhezhi': [{
    id: 'zhezhi-calligrapher',
    label: 'Calligrapher\'s Touch: ATK +6% per Stroke of Genius or Creation\'s Zenith, up to 3',
    toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
    bonus: ({ setting }) => ({ atkPct: 6 * stacks(setting) }),
    confidence: 'sourced',
  }],
  'roccia': [{
    id: 'roccia-immersive',
    label: 'Immersive Performance: ATK +20% for 12s after her Resonance Skill or Heavy Attack',
    toggle: { kind: 'switch', label: 'After Skill or Heavy Attack' },
    bonus: () => ({ atkPct: 20 }),
    confidence: 'sourced',
  }],
  'brant': [{
    id: 'brant-trial',
    label: 'Trial by Fire and Tide: Fusion DMG +15%',
    bonus: () => ({ fusionDmg: 15 }),
    confidence: 'sourced',
  }],
  'cantarella': [{
    id: 'cantarella-poison',
    label: '"Poison": Havoc DMG +6% per Echo Skill cast, up to 2',
    toggle: { kind: 'stacks', label: 'Stacks', max: 2 },
    bonus: ({ setting }) => ({ havocDmg: 6 * stacks(setting) }),
    confidence: 'sourced',
  }],
  'phrolova': [{
    id: 'phrolova-octet',
    label: 'Octet: Crit DMG +2.5% per Aftersound stack (10 on entering battle), +1% per stack past the max, up to +100% more',
    toggle: { kind: 'stacks', label: 'Stacks past 10 (0-100)', max: 100 },
    bonus: ({ setting }) => ({ critDmg: 25 + stacks(setting) }),
    confidence: 'sourced',
  }],
  'galbrena': [{
    id: 'galbrena-fated-end',
    label: 'Oathbound Hunt: DMG Amplified 5% per Fated End stack on the target, up to 4 (not Echo Skills)',
    toggle: { kind: 'stacks', label: 'Fated End stacks', max: 4 },
    amplify: ({ setting }) => {
      const value = 5 * stacks(setting)
      return { basic: value, heavy: value, skill: value, liberation: value, intro: value, outro: value }
    },
    confidence: 'sourced',
  }],
  'chisa': [{
    id: 'chisa-all-ends-here',
    label: 'All Ends Here: Havoc DMG +20% for 12s after her Intro Skill or Resonance Liberation',
    toggle: { kind: 'switch', label: 'After Intro or Liberation' },
    bonus: () => ({ havocDmg: 20 }),
    confidence: 'sourced',
  }],
  'lingyang': [{
    id: 'lingyang-lions-pride',
    label: 'Lion\'s Pride: Intro Skill Lion Awakens DMG +50%',
    lineScale: () => [{ section: 'intro', scale: 0.5 }],
    confidence: 'sourced',
  }],
  'qiuyuan': [{
    id: 'qiuyuan-flowing-panacea',
    label: 'Drink Away Woes Age-Old: ATK +10% for 20s from Flowing Panacea',
    toggle: { kind: 'switch', label: 'Flowing Panacea' },
    bonus: () => ({ atkPct: 10 }),
    confidence: 'sourced',
  }],
  'rebecca': [{
    id: 'rebecca-tag',
    label: 'Tag, You\'re It!: ATK +10% per stack, up to 2',
    toggle: { kind: 'stacks', label: 'Stacks', max: 2 },
    bonus: ({ setting }) => ({ atkPct: 10 * stacks(setting) }),
    confidence: 'sourced',
  }],
  'aemeath': [{
    id: 'aemeath-between-the-stars',
    label: 'Between the Stars: Crit DMG +20% per teammate inflicting Tune Rupture, up to 3 (Resonance Mode - Tune Rupture)',
    toggle: { kind: 'stacks', label: 'Stacks', max: 3 },
    offByDefault: true,
    bonus: ({ setting }) => ({ critDmg: 20 * stacks(setting) }),
    confidence: 'sourced',
  }],
  'yangyang-xuanling': [{
    id: 'xuanling-unbroken-vow',
    label: 'Unbroken Vow: her DMG Amplified 10% per Havoc Bane stack up to 3 (30%), 12% per stack from 4 to 6 (36%)',
    toggle: { kind: 'stacks', label: 'Havoc Bane stacks', max: 6 },
    amplify: ({ setting }) => {
      const n = stacks(setting)
      return { all: n === 0 ? 0 : n <= 3 ? 10 * n : Math.min(36, 12 * n) }
    },
    confidence: 'sourced',
  }],
  'lupa': [{
    id: 'lupa-glory',
    label: 'Glory: Fusion RES ignored 3% +3% per other Fusion Resonator (9% max), and 6% more with 3 Fusion Resonators',
    toggle: { kind: 'stacks', label: 'Other Fusion Resonators', max: 2 },
    resShred: ({ setting }) => [3, 6, 15][stacks(setting)] ?? 0,
    confidence: 'sourced',
  }],
}

export type WuwaAppliedEffect = { effect: WuwaCombatEffect, setting: boolean | number, counted: boolean, reason?: string }

export type WuwaResolvedCombat = {
  applied: WuwaAppliedEffect[],
  bonus: Bonus,
  amplify: Partial<Record<HitType | 'all', number>>,
  defIgnore: number,
  resShred: number,
  lineScale: LineScale[],
}

export function defaultEffectSetting(effect: WuwaCombatEffect): boolean | number {
  if (effect.offByDefault) return effect.toggle?.kind === 'stacks' ? 0 : false
  return effect.toggle?.kind === 'stacks' ? effect.toggle.max : true
}

export function resolveWuwaCombat(charId: string, sequence: number, settings: Record<string, boolean | number>): WuwaResolvedCombat {
  const resolved: WuwaResolvedCombat = { applied: [], bonus: {}, amplify: {}, defIgnore: 0, resShred: 0, lineScale: [] }
  for (const effect of KIT_EFFECTS[charId] ?? []) {
    const setting = settings[effect.id] ?? defaultEffectSetting(effect)
    if ((effect.minSequence ?? 0) > sequence) {
      resolved.applied.push({ effect, setting, counted: false, reason: `Needs Sequence ${effect.minSequence}` })
      continue
    }
    const counted = setting !== false && setting !== 0
    resolved.applied.push({ effect, setting, counted, reason: counted ? undefined : 'Turned off' })
    if (!counted) continue
    const context = { sequence, setting }
    for (const [stat, value] of Object.entries(effect.bonus?.(context) ?? {}) as [keyof Bonus, number][]) {
      resolved.bonus[stat] = (resolved.bonus[stat] ?? 0) + value
    }
    for (const [kind, value] of Object.entries(effect.amplify?.(context) ?? {}) as [HitType | 'all', number][]) {
      resolved.amplify[kind] = (resolved.amplify[kind] ?? 0) + value
    }
    resolved.defIgnore += effect.defIgnore ?? 0
    resolved.resShred += effect.resShred?.(context) ?? 0
    resolved.lineScale.push(...(effect.lineScale?.(context) ?? []))
  }
  return resolved
}
