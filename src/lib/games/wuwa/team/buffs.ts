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
// Phase 1 covers buffs to stats the calculator has that can change which loadout ranks best: ATK%, Crit, Energy Regen,
// element and skill-type DMG Bonus. "DMG Amplified" buffs (Verina's and Buling's Outros, Mortefi, Sanhua...) are a
// separate multiplier that scales every loadout the same, so they never change the ranking and aren't here; nor are
// Echo Skill DMG Bonuses (Qiuyuan, Lucilla), which the calculator doesn't have.

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

export type WuwaTeamBuff = {
  id: string,
  label: string,
  stat: StatKey,
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
