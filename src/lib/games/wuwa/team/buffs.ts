import type { HitType } from 'lib/games/wuwa/damage/damage'
import type { WuwaStats } from 'lib/games/wuwa/stats/computeStats'
import type {
  CharacterState,
  ElementDmgKey,
  StatKey,
} from 'lib/games/wuwa/types'

// Buffs a WuWa Resonator gives the team, like genshin/team/buffs.ts and zzz/team/buffs.ts. Read from the skill text and
// numbers in the community datamine we already use (Arikatsu/WutheringWaves_Data, branch 3.7: BinData/skill/skill.json
// SkillDescribe + SkillDetailNum, text from Textmaps/en/multi_text/MultiText.json); each entry quotes it. Personal,
// non-commercial use.
//
// Buffs to stats the calculator has (ATK%, Crit, Energy Regen, element and skill-type DMG Bonus) go to the stat
// calculator; DMG Amplified from Outro Skills (OUTRO_BUFFS: for everything, one element, or one kind of hit) and DEF
// ignore / RES shred go to rotation damage only. Amplification of one kind of hit changes which loadout ranks best
// (Sanhua's Basic Attack 38% favours Basic Attack DMG Bonus). Not here: Coordinated Attack, Fusion Burst, Glacio Chafe,
// Aero Erosion and Frazzle amplification, which our rotation has no lines for.

export type WuwaBuffToggle =
  | { kind: 'switch', label: string }
  | { kind: 'stacks', label: string, max: number }

export type WuwaBuffSetting = boolean | number

export type WuwaBuffContext = {
  giver: CharacterState,
  // The giver's own overview screen (their saved echoes), shown values (Energy Regen 250 = 250%)
  giverStats: WuwaStats,
  receiver: CharacterState,
  setting: WuwaBuffSetting,
}

// DMG Amplified for every hit or one kind, and enemy DEF ignore / RES shred, in percent: rotation damage only
export type AmplifyKey = 'amplify:all' | `amplify:${Exclude<HitType, 'none'>}`
export type WuwaDamageKey = AmplifyKey | 'defIgnore' | 'resShred'

export type WuwaTeamBuff = {
  id: string,
  label: string,
  stat: StatKey | WuwaDamageKey,
  // Starts off: the buff needs a mode or state the giver isn't usually in
  offByDefault?: boolean,
  // Only counts for Resonators of this element
  element?: ElementDmgKey,
  value: (context: WuwaBuffContext) => number,
  toggle?: WuwaBuffToggle,
  confidence: 'confirmed' | 'sourced' | 'unverified',
}

const on = (context: WuwaBuffContext) => context.setting !== false
const stacks = (context: WuwaBuffContext) => (typeof context.setting === 'number' ? context.setting : 0)

// By the datamine's character id
export const RESONATOR_BUFFS: Record<string, WuwaTeamBuff[]> = {
  // End Loop (Resonance Liberation): "for every 0.2% of Shorekeeper's Energy Regen, all party members gain a 0.01%
  // increase of Crit. Rate, up to 12.5%" (Inner Stellarealm) and "for every 0.1% ... Crit. DMG, up to 25%" (Supernal)
  'the-shorekeeper': [
    {
      id: 'inner-stellarealm',
      label: 'Inner Stellarealm: Crit Rate from her Energy Regen',
      stat: 'critRate',
      toggle: { kind: 'switch', label: 'In the Inner Stellarealm' },
      value: (c) => (on(c) ? Math.min(12.5, c.giverStats.energyRegen / 20) : 0),
      confidence: 'sourced',
    },
    {
      id: 'supernal-stellarealm',
      label: 'Supernal Stellarealm: Crit DMG from her Energy Regen',
      stat: 'critDmg',
      toggle: { kind: 'switch', label: 'In the Supernal Stellarealm' },
      value: (c) => (on(c) ? Math.min(25, c.giverStats.energyRegen / 10) : 0),
      confidence: 'sourced',
    },
  ],
  // Gift of Nature: "all team members' ATK are increased by 20% for 20s"
  'verina': [{
    id: 'gift-of-nature',
    label: 'Gift of Nature: ATK',
    stat: 'atkPct',
    toggle: { kind: 'switch', label: 'After her Heavy Attack, Liberation or Outro' },
    value: (c) => (on(c) ? 20 : 0),
    confidence: 'sourced',
  }],
  // Left an Opening!: "the ATK of all nearby Resonators in the team is increased by 20% for 30s"
  'rebecca': [{
    id: 'party-til-dawn',
    label: 'Left an Opening!: ATK after her Resonance Liberation',
    stat: 'atkPct',
    toggle: { kind: 'switch', label: 'After her Resonance Liberation' },
    value: (c) => (on(c) ? 20 : 0),
    confidence: 'sourced',
  }],
  // Quadruple Time Steps: "give 24% Aero DMG Bonus to all nearby Resonators in the team"
  'ciaccona': [{
    id: 'solo-concert',
    label: 'Solo Concert: Aero DMG Bonus',
    stat: 'aeroDmg',
    element: 'aeroDmg',
    toggle: { kind: 'switch', label: 'During Solo Concert' },
    value: (c) => (on(c) ? 24 : 0),
    confidence: 'sourced',
  }],
  // Etched Colors: "Resonance Mode - Fusion Burst: All Resonators in the team gain 30% Fusion DMG Bonus"
  'denia': [{
    id: 'etched-colors',
    label: 'Etched Colors: Fusion DMG Bonus (Fusion Burst, Entropy Shift)',
    stat: 'fusionDmg',
    element: 'fusionDmg',
    toggle: { kind: 'switch', label: 'In Entropy Shift' },
    value: (c) => (on(c) ? 30 : 0),
    confidence: 'sourced',
  }],
  // Thunder Begets Life: "Yin and Yang grants 10% Resonance Skill DMG Bonus ... Heaven, Earth, Mind grants 25%"
  'buling': [{
    id: 'thunder-spell',
    label: 'Thunder Spell: Resonance Skill DMG Bonus (1: Yin and Yang 10%, 2: Heaven, Earth, Mind 25%)',
    stat: 'skillDmg',
    toggle: { kind: 'stacks', label: 'Thunder Spell (0-2)', max: 2 },
    value: (c) => [0, 10, 25][stacks(c)] ?? 0,
    confidence: 'sourced',
  }],
  // Sunken Seal, Forged Lock: "her Outro Skill grants the incoming Resonator 30% Electro DMG Bonus, plus an additional
  // 20% for each stack of Unison Boon they have, up to 40%"
  'suoming': [{
    id: 'aligned-seals',
    label: 'Outro with Aligned Seals: Electro DMG Bonus, +20% per Unison Boon stack',
    stat: 'electroDmg',
    element: 'electroDmg',
    toggle: { kind: 'stacks', label: 'Unison Boon stacks (0-2)', max: 2 },
    value: (c) => 30 + 20 * Math.min(2, stacks(c)),
    confidence: 'sourced',
  }],
  // Applause of Victory, Glory: "Attacks of all Resonators in the team ignore 3% of the target's Fusion RES. For each Fusion
  // Resonator in the team other than Lupa, this effect increases by 3%, up to the maximum of 9%. When there are 3 Fusion
  // Resonators in the team, Resonators' attacks further ignore 6% Fusion RES."
  'lupa': [{
    id: 'glory-res',
    label: 'Glory: Fusion RES ignored',
    stat: 'resShred',
    element: 'fusionDmg',
    toggle: { kind: 'stacks', label: 'Fusion Resonators besides Lupa (0-2)', max: 2 },
    value: (c) => [3, 6, 15][stacks(c)] ?? 0,
    confidence: 'sourced',
  }],
  // True Names Aligned: "Each stack of Blessing of Runes grants the active Resonator in the team 3% Aero DMG Bonus"
  'sigrika': [{
    id: 'blessing-of-runes',
    label: 'Blessing of Runes: Aero DMG Bonus per stack',
    stat: 'aeroDmg',
    element: 'aeroDmg',
    toggle: { kind: 'stacks', label: 'Blessing of Runes (0-6)', max: 6 },
    value: (c) => 3 * stacks(c),
    confidence: 'sourced',
  }],
}

// Outro Skills: what the giver's Outro gives the incoming (or every) Resonator, from the same skill text. An element's
// DMG Amplified counts for every hit of a Resonator of that element
type Outro = { id: string, label: string, amplify: AmplifyKey, value: number, element?: ElementDmgKey, toggle?: WuwaBuffToggle, offByDefault?: boolean }

function outro(entries: Outro[]): WuwaTeamBuff[] {
  return entries.map(({ amplify, value, ...entry }) => ({
    ...entry,
    stat: amplify,
    value: (c) => (on(c) ? value : 0),
    toggle: entry.toggle ?? { kind: 'switch', label: 'After their Outro' },
    confidence: 'sourced',
  }))
}

// Same for each "<element> DMG Amplified by 20% and <kind> DMG Amplified by 25%" Outro
function elementAndKind(name: string, element: ElementDmgKey, kind: AmplifyKey, kindLabel: string): WuwaTeamBuff[] {
  const elementName = element.replace('Dmg', '')
  return outro([
    {
      id: 'outro-element',
      label: `${name}: ${elementName.charAt(0).toUpperCase()}${elementName.slice(1)} DMG Amplified 20%`,
      amplify: 'amplify:all',
      value: 20,
      element,
    },
    { id: 'outro-kind', label: `${name}: ${kindLabel} DMG Amplified 25%`, amplify: kind, value: 25 },
  ])
}

export const OUTRO_BUFFS: Record<string, WuwaTeamBuff[]> = {
  'verina': outro([{ id: 'outro-all', label: 'Blossom: all DMG Amplified 15%', amplify: 'amplify:all', value: 15 }]),
  'baizhi': outro([{ id: 'outro-all', label: 'Rejuvinating Flow: all DMG Amplified 15% (6s after healing)', amplify: 'amplify:all', value: 15 }]),
  'the-shorekeeper': outro([{ id: 'outro-all', label: 'Binary Butterfly: all DMG Amplified 15%', amplify: 'amplify:all', value: 15 }]),
  'buling': outro([{ id: 'outro-all', label: 'Exorcism Spell: all DMG Amplified 15%', amplify: 'amplify:all', value: 15 }]),
  'augusta': outro([{ id: 'outro-all', label: 'Battlesong of the Unyielding: all DMG Amplified 15%', amplify: 'amplify:all', value: 15 }]),
  'mornye': outro([{ id: 'outro-all', label: 'Recursion: all DMG Amplified 25%', amplify: 'amplify:all', value: 25 }]),
  'suisui': outro([{ id: 'outro-all', label: 'Rippling Waters: all DMG Amplified 25%', amplify: 'amplify:all', value: 25 }]),
  'lynae': outro([
    { id: 'outro-all', label: 'Let\'s Hit the Road!: all DMG Amplified 15%', amplify: 'amplify:all', value: 15 },
    { id: 'outro-liberation', label: 'Let\'s Hit the Road!: Resonance Liberation DMG Amplified 25%', amplify: 'amplify:liberation', value: 25 },
  ]),
  'rebecca': outro([
    { id: 'outro-all', label: 'Preem Choom: all DMG Amplified 15% (Edgerunner Bonds)', amplify: 'amplify:all', value: 15 },
    { id: 'outro-heavy', label: 'Preem Choom: Heavy Attack DMG Amplified up to 35% (Overlimit)', amplify: 'amplify:heavy', value: 35 },
  ]),
  'sanhua': outro([{ id: 'outro-basic', label: 'Silversnow: Basic Attack DMG Amplified 38%', amplify: 'amplify:basic', value: 38 }]),
  'taoqi': outro([{ id: 'outro-skill', label: 'Iron Will: Resonance Skill DMG Amplified 38%', amplify: 'amplify:skill', value: 38 }]),
  'lumi': outro([{ id: 'outro-skill', label: 'Escorting: Resonance Skill DMG Amplified 38%', amplify: 'amplify:skill', value: 38 }]),
  'mortefi': outro([{ id: 'outro-heavy', label: 'Rage Transposition: Heavy Attack DMG Amplified 38%', amplify: 'amplify:heavy', value: 38 }]),
  'jianxin': outro([{ id: 'outro-liberation', label: 'Transcendence: Resonance Liberation DMG Amplified 38%', amplify: 'amplify:liberation', value: 38 }]),
  'iuno': outro([{ id: 'outro-heavy', label: 'From Gloom to Gleam: Heavy Attack DMG Amplified 50%', amplify: 'amplify:heavy', value: 50 }]),
  'lucy': outro([{ id: 'outro-basic', label: 'Countermeasure Program: Basic Attack DMG Amplified 25%', amplify: 'amplify:basic', value: 25 }]),
  'qiuyuan': outro([{ id: 'outro-echo', label: 'Strike Before Ready: Echo Skill DMG Amplified 50%', amplify: 'amplify:echo', value: 50 }]),
  'lucilla': outro([{
    id: 'outro-echo',
    label: 'Montage: Echo Skill DMG Amplified 50% (Resonance Mode - Echo)',
    amplify: 'amplify:echo',
    value: 50,
    toggle: { kind: 'switch', label: 'Echo mode Outro' },
    offByDefault: true,
  }]),
  'danjin': outro([{ id: 'outro-element', label: 'Duality: Havoc DMG Amplified 23%', amplify: 'amplify:all', value: 23, element: 'havocDmg' }]),
  'aalto': outro([{ id: 'outro-element', label: 'Dissolving Mist: Aero DMG Amplified 23%', amplify: 'amplify:all', value: 23, element: 'aeroDmg' }]),
  'yinlin': elementAndKind('Strategist', 'electroDmg', 'amplify:liberation', 'Resonance Liberation'),
  'changli': elementAndKind('Strategy of Duality', 'fusionDmg', 'amplify:liberation', 'Resonance Liberation'),
  'zhezhi': elementAndKind('Carve and Draw', 'glacioDmg', 'amplify:skill', 'Resonance Skill'),
  'roccia': elementAndKind('Applause, Please!', 'havocDmg', 'amplify:basic', 'Basic Attack'),
  'brant': elementAndKind('The Course is Set!', 'fusionDmg', 'amplify:skill', 'Resonance Skill'),
  'cantarella': elementAndKind('Gentle Tentacles', 'havocDmg', 'amplify:skill', 'Resonance Skill'),
  'lupa': elementAndKind('Stand by Me, Warrior', 'fusionDmg', 'amplify:basic', 'Basic Attack'),
  'phrolova': elementAndKind('Unfinished Piece', 'havocDmg', 'amplify:heavy', 'Heavy Attack'),
  'suoming': outro([
    { id: 'outro-element', label: 'Canopy Rumble: Electro DMG Amplified 20%', amplify: 'amplify:all', value: 20, element: 'electroDmg' },
    {
      id: 'outro-skill',
      label: 'Canopy Rumble: Resonance Skill DMG Amplified 25% with Unison Boon',
      amplify: 'amplify:skill',
      value: 25,
      toggle: { kind: 'switch', label: 'With Unison Boon' },
    },
  ]),
  'zani': outro([{
    id: 'outro-element',
    label: 'Beacon For the Future: Spectro DMG Amplified 20% against targets with Heliacal Ember',
    amplify: 'amplify:all',
    value: 20,
    element: 'spectroDmg',
  }]),
  'hiyuki': outro([{
    id: 'outro-element',
    label: 'Snowlight Blessing: Glacio DMG Amplified 20% against targets with Glacio Chafe',
    amplify: 'amplify:all',
    value: 20,
    element: 'glacioDmg',
  }]),
  'cartethyia': outro([{
    id: 'outro-element',
    label: 'Wind\'s Divine Blessing: Aero DMG Amplified 17.5% against targets with Negative Statuses',
    amplify: 'amplify:all',
    value: 17.5,
    element: 'aeroDmg',
  }]),
  'yangyang-xuanling': outro([{
    id: 'outro-element',
    label: 'As the Wind Wills: Havoc DMG Amplified 20% after inflicting Havoc Bane',
    amplify: 'amplify:all',
    value: 20,
    element: 'havocDmg',
  }]),
  'rover-electro': outro([{
    id: 'outro-all',
    label: 'Rumbling Thunders: all DMG Amplified 25% after inflicting a Negative Status',
    amplify: 'amplify:all',
    value: 25,
  }]),
  'aemeath': outro([{
    id: 'outro-all',
    label: 'Silent Protection: all DMG Amplified 10% (20% after Tune Rupture - Shifting or Fusion Burst: set 20 by hand on the enemy)',
    amplify: 'amplify:all',
    value: 10,
  }]),
  'denia': outro([{
    id: 'outro-all',
    label: 'Unfinished Lies: all DMG Amplified 15% (Resonance Mode - Tune Strain)',
    amplify: 'amplify:all',
    value: 15,
    toggle: { kind: 'switch', label: 'Tune Strain Outro' },
    offByDefault: true,
  }]),
  'hsin': outro([{
    id: 'outro-all',
    label: 'Herself a Thousand Lanterns: all DMG Amplified 20% with Shared Light (Resonance Mode - Unison)',
    amplify: 'amplify:all',
    value: 20,
  }]),
  // Confession Enhancement: "reducing the Spectro RES of nearby targets by 10%"
  'phoebe': [{
    id: 'outro-res',
    label: 'Attentive Heart (Confession): Spectro RES -10%',
    stat: 'resShred',
    element: 'spectroDmg',
    toggle: { kind: 'switch', label: 'Confession Outro' },
    offByDefault: true,
    value: (c) => (on(c) ? 10 : 0),
    confidence: 'sourced',
  }],
}
