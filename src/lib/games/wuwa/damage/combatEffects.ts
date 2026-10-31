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
  // Inherent Skills and Forte buffs of the Resonators that had no kit yet (datamine 3.7 skill text, Oct 31 2026). "<Skill>
  // DMG is increased" for a named skill raises its lines like Lingyang's; for a whole attack type it is that type's DMG Bonus
  'yangyang': [{
    id: 'yangyang-lazuline-mercy',
    label: 'Lazuline Mercy: Aero DMG +8% for 8s after her Intro Skill',
    toggle: { kind: 'switch', label: 'After her Intro' },
    bonus: () => ({ aeroDmg: 8 }),
    confidence: 'sourced',
  }],
  'chixia': [
    {
      id: 'chixia-scorching-magazine',
      label: 'Scorching Magazine: Resonance Skill Boom Boom DMG +50%',
      lineScale: () => [{ labelStart: 'Boom Boom', scale: 0.5 }],
      confidence: 'sourced',
    },
    {
      id: 'chixia-numbingly-spicy',
      label: 'Numbingly Spicy!: ATK +1% per Thermobaric Bullet hit during DAKA DAKA!, up to 30',
      toggle: { kind: 'stacks', label: 'Bullet hits', max: 30 },
      bonus: ({ setting }) => ({ atkPct: stacks(setting) }),
      confidence: 'sourced',
    },
  ],
  'rover-spectro': [
    {
      id: 'rover-spectro-reticence',
      label: 'Reticence: Basic Attack Resonating Echoes DMG +60%',
      lineScale: () => [{ labelStart: 'Resonating Echoes', scale: 0.6 }],
      confidence: 'sourced',
    },
    {
      id: 'rover-spectro-silent-listener',
      label: 'Silent Listener: ATK +15% for 5s after Heavy Attack Resonance',
      toggle: { kind: 'switch', label: 'After Heavy Attack Resonance' },
      bonus: () => ({ atkPct: 15 }),
      confidence: 'sourced',
    },
  ],
  'sanhua': [
    {
      id: 'sanhua-condensation',
      label: 'Condensation: Resonance Skill DMG +20% for 8s after her Intro Skill',
      toggle: { kind: 'switch', label: 'After her Intro' },
      lineScale: () => [{ section: 'skill', scale: 0.2 }],
      confidence: 'sourced',
    },
    {
      id: 'sanhua-avalanche',
      label: 'Avalanche: Forte Circuit Ice Burst DMG +20% for 8s after Basic Attack 5',
      toggle: { kind: 'switch', label: 'After Basic Attack 5' },
      lineScale: () => [
        { labelStart: 'Glacier Burst', scale: 0.2 },
        { labelStart: 'Ice Prism Burst', scale: 0.2 },
        { labelStart: 'Ice Thorn Burst', scale: 0.2 },
      ],
      confidence: 'sourced',
    },
  ],
  'taoqi': [{
    id: 'taoqi-steadfast-protection',
    label: 'Steadfast Protection: DEF +15% while Resonance Skill Rocksteady Shield lasts',
    toggle: { kind: 'switch', label: 'Rocksteady Shield up' },
    bonus: () => ({ defPct: 15 }),
    confidence: 'sourced',
  }],
  'danjin': [
    {
      id: 'danjin-incinerating-will',
      label: 'Incinerating Will: her DMG to targets marked with Incinerating Will +20%',
      toggle: { kind: 'switch', label: 'Target marked' },
      amplify: () => ({ all: 20 }),
      confidence: 'sourced',
    },
    {
      id: 'danjin-overflow',
      label: 'Overflow: Heavy Attack DMG +30% for 5s after Resonance Skill Sanguine Pulse',
      toggle: { kind: 'switch', label: 'After Sanguine Pulse' },
      bonus: () => ({ heavyDmg: 30 }),
      confidence: 'sourced',
    },
  ],
  'mortefi': [
    {
      id: 'mortefi-harmonic-control',
      label: 'Harmonic Control: Fury Fugue DMG +25% for 8s after Resonance Skill Passionate Variation',
      toggle: { kind: 'switch', label: 'After Passionate Variation' },
      lineScale: () => [{ labelStart: 'Fury Fugue', scale: 0.25 }],
      confidence: 'sourced',
    },
    {
      id: 'mortefi-rhythmic-vibrato',
      label: 'Rhythmic Vibrato: each Marcato hit raises the next one\'s DMG 1.5%, up to 50 stacks during his Liberation',
      toggle: { kind: 'stacks', label: 'Average Marcato stacks', max: 50 },
      lineScale: ({ setting }) => [{ labelStart: 'Marcato', scale: 0.015 * stacks(setting) }],
      confidence: 'sourced',
    },
  ],
  'yuanwu': [{
    id: 'yuanwu-thunderous-determination',
    label: 'Thunderous Determination: Resonance Skill Thunder Uprising DMG Multiplier +40%',
    lineScale: () => [{ labelStart: 'Thunder Uprising', scale: 0.4 }],
    confidence: 'sourced',
  }],
  'rover-havoc': [{
    id: 'rover-havoc-metamorph',
    label: 'Metamorph: Havoc DMG +20% in the Dark Surge state',
    toggle: { kind: 'switch', label: 'Dark Surge' },
    bonus: () => ({ havocDmg: 20 }),
    confidence: 'sourced',
  }],
  'jianxin': [{
    id: 'jianxin-formless-release',
    label: 'Formless Release: Resonance Liberation Purification Force Field DMG +20%',
    lineScale: () => [{ section: 'liberation', scale: 0.2 }],
    confidence: 'sourced',
  }],
  'lumi': [
    {
      id: 'lumi-pathfinding',
      label: 'Pathfinding: Electro DMG +10% in Red Light Mode',
      toggle: { kind: 'switch', label: 'Red Light Mode' },
      bonus: () => ({ electroDmg: 10 }),
      confidence: 'sourced',
    },
    {
      id: 'lumi-expediting',
      label: 'Expediting: ATK +10% for 5s after Energized Pounce or Energized Rebound',
      toggle: { kind: 'switch', label: 'After Energized Pounce or Rebound' },
      bonus: () => ({ atkPct: 10 }),
      confidence: 'sourced',
    },
  ],
  'youhu': [{
    id: 'youhu-rare-find',
    label: 'Rare Find: Glacio DMG +15% for 14s after her Intro Skill',
    toggle: { kind: 'switch', label: 'After her Intro' },
    bonus: () => ({ glacioDmg: 15 }),
    confidence: 'sourced',
  }],
  'carlotta': [
    {
      id: 'carlotta-deconstruction',
      label: 'Deconstruction (Era of New Wave, Ars Gratia Artis): her DMG ignores 18% of the target\'s DEF',
      toggle: { kind: 'switch', label: 'Target has Deconstruction' },
      defIgnore: 18,
      confidence: 'sourced',
    },
    {
      id: 'carlotta-final-bow',
      label: 'Final Bow: Era of New Wave, Death Knell and Fatal Finale DMG Multipliers +80%',
      toggle: { kind: 'switch', label: 'Final Bow' },
      lineScale: () => [{ section: 'liberation', scale: 0.8 }],
      confidence: 'sourced',
    },
  ],
  'rover-aero': [{
    id: 'rover-aero-sand-in-the-storm',
    label: 'Sand in the Storm: ATK +20% for 10s after Intro Skill Relentless Squall',
    toggle: { kind: 'switch', label: 'After the Intro' },
    bonus: () => ({ atkPct: 20 }),
    confidence: 'sourced',
  }],
  'ciaccona': [
    {
      id: 'ciaccona-winds-of-rinascita',
      label: 'Winds of Rinascita: Heavy Attack - Quadruple Downbeat DMG +30%',
      lineScale: () => [{ labelStart: 'Quadruple Downbeat', scale: 0.3 }],
      confidence: 'sourced',
    },
    {
      id: 'ciaccona-solo-concert',
      label: 'Solo Concert: Aero DMG +24% for nearby Resonators, herself included',
      toggle: { kind: 'switch', label: 'Solo Concert' },
      bonus: () => ({ aeroDmg: 24 }),
      confidence: 'sourced',
    },
  ],
  'iuno': [{
    id: 'iuno-wan-light',
    label: 'Blessing of the Wan Light: all DMG Amplified 4% per stack, up to 10 (5 from her Intro Skill or Liberation)',
    toggle: { kind: 'stacks', label: 'Stacks', max: 10 },
    amplify: ({ setting }) => ({ all: 4 * stacks(setting) }),
    confidence: 'sourced',
  }],
  'lynae': [
    {
      id: 'lynae-adaptive-optics',
      label: 'Adaptive Optics: Spectro DMG +25% for 9s after her Intro Skill',
      toggle: { kind: 'switch', label: 'After her Intro' },
      bonus: () => ({ spectroDmg: 25 }),
      confidence: 'sourced',
    },
    {
      id: 'lynae-prismatic-overblast',
      label: 'Prismatic Overblast: DMG dealt by nearby Resonators +24% for 30s after her Liberation, herself included',
      toggle: { kind: 'switch', label: 'After her Liberation' },
      amplify: () => ({ all: 24 }),
      confidence: 'sourced',
    },
  ],
  'luuk-herssen': [{
    id: 'luuk-herssen-uncaused-diagnosis',
    label: 'Uncaused Diagnosis: ATK +25% for 20s after a teammate inflicts Tune Strain - Shifting or deals Tune Break DMG',
    toggle: { kind: 'switch', label: 'After Tune Strain - Shifting or Tune Break' },
    bonus: () => ({ atkPct: 25 }),
    confidence: 'sourced',
  }],
  'sigrika': [{
    id: 'sigrika-blessing-of-runes',
    label: 'True Names Aligned: Blessing of Runes, Aero DMG +3% per stack (up to 6, one per different Echo Skill cast), +30% more at 6',
    toggle: { kind: 'stacks', label: 'Blessing of Runes', max: 6 },
    bonus: ({ setting }) => ({ aeroDmg: 3 * stacks(setting) + (stacks(setting) >= 6 ? 30 : 0) }),
    confidence: 'sourced',
  }],
  'denia': [
    {
      id: 'denia-breakdown-form',
      label: 'Entropy Shift: Breakdown Form: ATK +30%',
      toggle: { kind: 'switch', label: 'Breakdown Form' },
      bonus: () => ({ atkPct: 30 }),
      confidence: 'sourced',
    },
    {
      id: 'denia-etched-colors',
      label: 'Etched Colors: Fusion DMG +30% for the team in an Entropy Shift state (Resonance Mode - Fusion Burst)',
      toggle: { kind: 'switch', label: 'Fusion Burst mode, Entropy Shift' },
      offByDefault: true,
      bonus: () => ({ fusionDmg: 30 }),
      confidence: 'sourced',
    },
  ],
  'lucilla': [
    {
      id: 'lucilla-clear-as-day',
      label: 'Clear As Day: Basic Attack DMG +30% for 10s after her Liberation',
      toggle: { kind: 'switch', label: 'After her Liberation' },
      bonus: () => ({ basicDmg: 30 }),
      confidence: 'sourced',
    },
    {
      id: 'lucilla-slow-motion',
      label: 'Slow Motion: Glacio RES -8% for 30s after Resonance Skill - Spotlight (Resonance Mode - Glacio Chafe)',
      toggle: { kind: 'switch', label: 'Glacio Chafe mode, after Spotlight' },
      offByDefault: true,
      resShred: () => 8,
      confidence: 'sourced',
    },
  ],
  'lucy': [
    {
      id: 'lucy-depths-of-blackwall',
      label: 'Depths of Blackwall: Spectro DMG +65% for 8s after Resonance Skill - Deadlock',
      toggle: { kind: 'switch', label: 'After Deadlock' },
      bonus: () => ({ spectroDmg: 65 }),
      confidence: 'sourced',
    },
    {
      id: 'lucy-network-backdoor',
      label: 'Function Cracking: Network Backdoor, all DMG Amplified 10% per stack (2 stacks: 25%) after a Botnet-marked boss is defeated',
      toggle: { kind: 'stacks', label: 'Network Backdoor stacks', max: 2 },
      offByDefault: true,
      amplify: ({ setting }) => ({ all: [0, 10, 25][stacks(setting)] ?? 0 }),
      confidence: 'sourced',
    },
  ],
  'hiyuki': [{
    id: 'hiyuki-fine-snow',
    label: 'Fine Snow: Crit DMG +40% with 1+ Snow Rust (a teammate applied Glacio Chafe or Havoc Bane)',
    toggle: { kind: 'switch', label: 'Snow Rust' },
    bonus: () => ({ critDmg: 40 }),
    confidence: 'sourced',
  }],
  'rover-electro': [
    {
      id: 'rover-electro-regression',
      label: 'Regression: Resonance Skill DMG +20% for 20s after holding Resonance Skill Overshock',
      toggle: { kind: 'switch', label: 'After a held Overshock' },
      bonus: () => ({ skillDmg: 20 }),
      confidence: 'sourced',
    },
    {
      id: 'rover-electro-myriad-omens',
      label: 'Myriad Omens\' Mandate: team ATK +10% for 20s after a tapped Overshock clears Electric Surge',
      toggle: { kind: 'switch', label: 'After a tapped Overshock' },
      offByDefault: true,
      bonus: () => ({ atkPct: 10 }),
      confidence: 'sourced',
    },
  ],
  'qingxiao': [{
    id: 'qingxiao-to-know-to-banish',
    label:
      'To Know, To Banish: Stringblade, Ephemeral Transcendence and Billows Beneath Heaven deal 2% more DMG per Mindlock stack, +5% more per stack for the first 7',
    toggle: { kind: 'stacks', label: 'Mindlock stacks (counted up to 7)', max: 7 },
    amplify: ({ setting }) => ({ all: 7 * stacks(setting) }),
    confidence: 'unverified',
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
