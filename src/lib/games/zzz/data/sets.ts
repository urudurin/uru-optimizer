import type {
  SetData,
  StatEffect,
} from 'lib/games/zzz/data/dataTypes'
import {
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Keys are the set ids produced by slugifySetName in the importer. The five sets written out in full first were checked
// against the stat screen or the user's export; the rest follow genshin-optimizer's disc data (libs/zzz/consts disc2pEffect
// for 2-pieces, libs/zzz/formula/src/data/disc/sheets for 4-pieces; MIT, Copyright (c) 2020 frzyc). 4-piece effects
// that need something to happen in combat count as on in combat ('onField'), at full stacks, like Woodpecker Electro.
// Effects on some hits only (Basic Attack DMG, Anomaly DMG) are in damage/gearEffects.ts; team-wide 4-pieces in
// team/buffs.ts SET_4PC_BUFFS (their wearer's own share is here). Daze, Anomaly buildup, shields and damage taken aren't
// modelled.

function twoPiece(name: string, stat: ZzzStatsValues, value: number, element?: string): StatEffect[] {
  return [{ stat, value, ...(element ? { element } : {}), source: `${name} 2pc`, confidence: 'sourced' }]
}

function inCombat(name: string, stat: ZzzStatsValues, value: number, note: string, extra: Partial<StatEffect> = {}): StatEffect {
  return { stat, value, when: 'onField', ...extra, source: `${name} 4pc (${note})`, confidence: 'sourced' }
}

const GO_SETS: Record<string, SetData> = {
  'astral-voice': {
    id: 'astral-voice',
    name: 'Astral Voice',
    twoPiece: twoPiece('Astral Voice', ZzzStats.ATK_P, 10),
    fourPiece: [inCombat('Astral Voice', ZzzStats.ELEMENT_DMG, 24, '3 Astral stacks')],
    fourPieceModeled: true,
  },
  'bunny-in-wonderland': {
    id: 'bunny-in-wonderland',
    name: 'Bunny in Wonderland',
    twoPiece: twoPiece('Bunny in Wonderland', ZzzStats.HP_P, 10),
    // Its squad DMG Bonus needs a Defense wearer; team/buffs.ts
    fourPiece: [],
    fourPieceModeled: true,
  },
  'chaos-jazz': {
    id: 'chaos-jazz',
    name: 'Chaos Jazz',
    twoPiece: twoPiece('Chaos Jazz', ZzzStats.ANOMALY_PROFICIENCY, 30),
    fourPiece: [
      inCombat('Chaos Jazz', ZzzStats.ELEMENT_DMG, 15, 'Fire DMG', { element: 'Fire' }),
      inCombat('Chaos Jazz', ZzzStats.ELEMENT_DMG, 15, 'Electric DMG', { element: 'Electric' }),
    ],
    fourPieceModeled: true,
  },
  'chaotic-metal': {
    id: 'chaotic-metal',
    name: 'Chaotic Metal',
    twoPiece: twoPiece('Chaotic Metal', ZzzStats.ELEMENT_DMG, 10, 'Ether'),
    fourPiece: [inCombat('Chaotic Metal', ZzzStats.CRIT_DMG, 20 + 6 * 5.5, '20% plus 6 Corruption stacks of 5.5%')],
    fourPieceModeled: true,
  },
  'dawns-bloom': {
    id: 'dawns-bloom',
    name: 'Dawn\'s Bloom',
    // Basic Attack DMG, damage/gearEffects.ts
    twoPiece: [],
    fourPiece: [],
    fourPieceModeled: true,
  },
  'fanged-metal': {
    id: 'fanged-metal',
    name: 'Fanged Metal',
    twoPiece: twoPiece('Fanged Metal', ZzzStats.ELEMENT_DMG, 10, 'Physical'),
    fourPiece: [inCombat('Fanged Metal', ZzzStats.ELEMENT_DMG, 35, 'after inflicting Assault')],
    fourPieceModeled: true,
  },
  'feathered-fate': {
    id: 'feathered-fate',
    name: 'Feathered Fate',
    twoPiece: twoPiece('Feathered Fate', ZzzStats.ANOMALY_PROFICIENCY, 30),
    fourPiece: [inCombat('Feathered Fate', ZzzStats.ANOMALY_PROFICIENCY, 50, 'entering or on field')],
    fourPieceModeled: true,
  },
  'freedom-blues': {
    id: 'freedom-blues',
    name: 'Freedom Blues',
    twoPiece: twoPiece('Freedom Blues', ZzzStats.ANOMALY_PROFICIENCY, 30),
    // Lowers the enemy's Anomaly buildup RES: no damage effect
    fourPiece: [],
    fourPieceModeled: true,
  },
  'hormone-punk': {
    id: 'hormone-punk',
    name: 'Hormone Punk',
    twoPiece: twoPiece('Hormone Punk', ZzzStats.ATK_P, 10),
    fourPiece: [inCombat('Hormone Punk', ZzzStats.ATK_P, 25, 'entering combat')],
    fourPieceModeled: true,
  },
  'inferno-metal': {
    id: 'inferno-metal',
    name: 'Inferno Metal',
    twoPiece: twoPiece('Inferno Metal', ZzzStats.ELEMENT_DMG, 10, 'Fire'),
    fourPiece: [inCombat('Inferno Metal', ZzzStats.CRIT_RATE, 28, 'against Burning enemies')],
    fourPieceModeled: true,
  },
  'king-of-the-summit': {
    id: 'king-of-the-summit',
    name: 'King of the Summit',
    // Daze; the 4-piece's squad CRIT DMG is in team/buffs.ts
    twoPiece: [],
    fourPiece: [],
    fourPieceModeled: true,
  },
  'moonlight-lullaby': {
    id: 'moonlight-lullaby',
    name: 'Moonlight Lullaby',
    twoPiece: twoPiece('Moonlight Lullaby', ZzzStats.ENERGY_REGEN, 20),
    fourPiece: [inCombat('Moonlight Lullaby', ZzzStats.ELEMENT_DMG, 18, 'after an EX Special or Ultimate', { specialty: 'Support' })],
    fourPieceModeled: true,
  },
  'notes-from-the-chained': {
    id: 'notes-from-the-chained',
    name: 'Notes From the Chained',
    twoPiece: twoPiece('Notes From the Chained', ZzzStats.ELEMENT_DMG, 10, 'Ice'),
    // Anomaly and Disorder DMG, damage/gearEffects.ts; the Abloom part needs Lumiflux
    fourPiece: [],
    fourPieceModeled: true,
  },
  'phaethons-melody': {
    id: 'phaethons-melody',
    name: 'Phaethon\'s Melody',
    twoPiece: twoPiece('Phaethon\'s Melody', ZzzStats.ANOMALY_MASTERY, 8),
    fourPiece: [
      inCombat('Phaethon\'s Melody', ZzzStats.ANOMALY_PROFICIENCY, 45, 'a squad member uses an EX Special'),
      inCombat('Phaethon\'s Melody', ZzzStats.ELEMENT_DMG, 25, 'another squad member uses an EX Special', { element: 'Ether' }),
    ],
    fourPieceModeled: true,
  },
  'polar-metal': {
    id: 'polar-metal',
    name: 'Polar Metal',
    twoPiece: twoPiece('Polar Metal', ZzzStats.ELEMENT_DMG, 10, 'Ice'),
    // Basic Attack and Dash Attack DMG, damage/gearEffects.ts
    fourPiece: [],
    fourPieceModeled: true,
  },
  'proto-punk': {
    id: 'proto-punk',
    name: 'Proto Punk',
    // Shield
    twoPiece: [],
    fourPiece: [inCombat('Proto Punk', ZzzStats.ELEMENT_DMG, 15, 'after a Defensive or Evasive Assist')],
    fourPieceModeled: true,
  },
  'puffer-electro': {
    id: 'puffer-electro',
    name: 'Puffer Electro',
    twoPiece: twoPiece('Puffer Electro', ZzzStats.PEN_RATIO, 8),
    // Ultimate DMG is in damage/gearEffects.ts
    fourPiece: [inCombat('Puffer Electro', ZzzStats.ATK_P, 15, 'after launching an Ultimate')],
    fourPieceModeled: true,
  },
  'shining-aria': {
    id: 'shining-aria',
    name: 'Shining Aria',
    twoPiece: twoPiece('Shining Aria', ZzzStats.ELEMENT_DMG, 10, 'Ether'),
    // DMG against stunned enemies is in damage/gearEffects.ts
    fourPiece: [inCombat('Shining Aria', ZzzStats.ANOMALY_PROFICIENCY, 36, 'hitting an enemy')],
    fourPieceModeled: true,
  },
  'shockstar-disco': {
    id: 'shockstar-disco',
    name: 'Shockstar Disco',
    twoPiece: twoPiece('Shockstar Disco', ZzzStats.IMPACT, 6),
    // Daze
    fourPiece: [],
    fourPieceModeled: true,
  },
  'soul-rock': {
    id: 'soul-rock',
    name: 'Soul Rock',
    twoPiece: twoPiece('Soul Rock', ZzzStats.DEF_P, 16),
    // Damage taken
    fourPiece: [],
    fourPieceModeled: true,
  },
  'swing-jazz': {
    id: 'swing-jazz',
    name: 'Swing Jazz',
    twoPiece: twoPiece('Swing Jazz', ZzzStats.ENERGY_REGEN, 20),
    fourPiece: [inCombat('Swing Jazz', ZzzStats.ELEMENT_DMG, 15, 'after a Chain Attack or Ultimate')],
    fourPieceModeled: true,
  },
  'the-sky-ablaze': {
    id: 'the-sky-ablaze',
    name: 'The Sky Ablaze',
    twoPiece: twoPiece('The Sky Ablaze', ZzzStats.ELEMENT_DMG, 10, 'Ether'),
    fourPiece: [
      inCombat('The Sky Ablaze', ZzzStats.CRIT_DMG, 30, 'Ether agents', { element: 'Ether' }),
      inCombat('The Sky Ablaze', ZzzStats.ATK_P, 10, 'after an EX Special or Ultimate'),
    ],
    fourPieceModeled: true,
  },
  'thorned-rose': {
    id: 'thorned-rose',
    name: 'Thorned Rose',
    twoPiece: twoPiece('Thorned Rose', ZzzStats.DEF_P, 16),
    fourPiece: [
      inCombat('Thorned Rose', ZzzStats.ELEMENT_DMG, 15, 'DMG'),
      inCombat('Thorned Rose', ZzzStats.CRIT_RATE, 8, 'DEF 1000+', { minStat: { stat: 'def', atLeast: 1000 } }),
      inCombat('Thorned Rose', ZzzStats.CRIT_RATE, 8, 'DEF 1800+', { minStat: { stat: 'def', atLeast: 1800 } }),
    ],
    fourPieceModeled: true,
  },
  'thunder-metal': {
    id: 'thunder-metal',
    name: 'Thunder Metal',
    twoPiece: twoPiece('Thunder Metal', ZzzStats.ELEMENT_DMG, 10, 'Electric'),
    fourPiece: [inCombat('Thunder Metal', ZzzStats.ATK_P, 28, 'against Shocked enemies')],
    fourPieceModeled: true,
  },
  'wuthering-salon': {
    id: 'wuthering-salon',
    name: 'Wuthering Salon',
    twoPiece: twoPiece('Wuthering Salon', ZzzStats.ELEMENT_DMG, 10, 'Wind'),
    fourPiece: [
      inCombat('Wuthering Salon', ZzzStats.ANOMALY_PROFICIENCY, 50, '2 EX Special stacks'),
      inCombat('Wuthering Salon', ZzzStats.ELEMENT_DMG, 18, 'Wind agents after Windswept', { element: 'Wind' }),
    ],
    fourPieceModeled: true,
  },
}

export const SETS: Record<string, SetData> = {
  ...GO_SETS,
  'white-water-ballad': {
    id: 'white-water-ballad',
    name: 'White Water Ballad',
    twoPiece: [
      {
        stat: ZzzStats.ELEMENT_DMG,
        value: 10,
        element: 'Physical',
        source: 'White Water Ballad 2pc',
        confidence: 'sourced',
      },
    ],
    fourPiece: [
      {
        stat: ZzzStats.CRIT_RATE,
        value: 10,
        when: 'inEtherVeil',
        source: 'White Water Ballad 4pc (in Ether Veil)',
        confidence: 'confirmed',
      },
      {
        stat: ZzzStats.CRIT_RATE,
        value: 10,
        when: 'veilTriggered',
        specialty: 'Attack',
        source: 'White Water Ballad 4pc (Veil activated)',
        confidence: 'confirmed',
      },
      {
        stat: ZzzStats.ATK_P,
        value: 10,
        when: 'veilTriggered',
        specialty: 'Attack',
        source: 'White Water Ballad 4pc (Veil activated)',
        confidence: 'confirmed',
      },
    ],
    fourPieceModeled: true,
  },
  'branch-blade-song': {
    id: 'branch-blade-song',
    name: 'Branch & Blade Song',
    twoPiece: [
      {
        stat: ZzzStats.CRIT_DMG,
        value: 16,
        source: 'Branch & Blade Song 2pc',
        confidence: 'confirmed',
      },
    ],
    // In-game description: CRIT DMG +30% while Anomaly Mastery is at least 115, and CRIT Rate +12% for 15s when any
    // squad member applies Freeze or triggers Shatter. Combat effects, so off on the stat screen
    fourPiece: [
      {
        stat: ZzzStats.CRIT_DMG,
        value: 30,
        when: 'onField',
        minStat: { stat: 'anomalyMastery', atLeast: 115 },
        source: 'Branch & Blade Song 4pc (Anomaly Mastery 115+)',
        confidence: 'sourced',
      },
      {
        stat: ZzzStats.CRIT_RATE,
        value: 12,
        when: 'freezeOrShatter',
        source: 'Branch & Blade Song 4pc (Freeze or Shatter)',
        confidence: 'sourced',
      },
    ],
    fourPieceModeled: true,
  },
  'woodpecker-electro': {
    id: 'woodpecker-electro',
    name: 'Woodpecker Electro',
    twoPiece: [
      {
        stat: ZzzStats.CRIT_RATE,
        value: 8,
        source: 'Woodpecker Electro 2pc',
        confidence: 'confirmed',
      },
    ],
    // In-game description: a crit from a Basic Attack, Dodge Counter or EX Special Attack gives ATK +9% for 6s, each of
    // the three counted separately. Modeled as all three active in combat
    fourPiece: [
      {
        stat: ZzzStats.ATK_P,
        value: 27,
        when: 'onField',
        source: 'Woodpecker Electro 4pc (3 stacks)',
        confidence: 'sourced',
      },
    ],
    fourPieceModeled: true,
  },
  'shadow-harmony': {
    id: 'shadow-harmony',
    name: 'Shadow Harmony',
    // The 2pc boosts Aftershock and Dash Attack DMG, not a stat
    twoPiece: [],
    // 3 full stacks from Aftershock or Dash Attack hits
    fourPiece: [
      {
        stat: ZzzStats.ATK_P,
        value: 12,
        when: 'onField',
        source: 'Shadow Harmony 4pc (3 stacks)',
        confidence: 'sourced',
      },
      {
        stat: ZzzStats.CRIT_RATE,
        value: 12,
        when: 'onField',
        source: 'Shadow Harmony 4pc (3 stacks)',
        confidence: 'sourced',
      },
    ],
    fourPieceModeled: true,
  },
  'yunkui-tales': {
    id: 'yunkui-tales',
    name: 'Yunkui Tales',
    twoPiece: [
      {
        stat: ZzzStats.HP_P,
        value: 10,
        source: 'Yunkui Tales 2pc',
        confidence: 'sourced',
      },
    ],
    // 3 full stacks from EX Special Attacks, Chain Attacks or Ultimates. The Sheer DMG bonus at 3 stacks isn't a stat
    fourPiece: [
      {
        stat: ZzzStats.CRIT_RATE,
        value: 12,
        when: 'onField',
        source: 'Yunkui Tales 4pc (3 stacks)',
        confidence: 'sourced',
      },
    ],
    fourPieceModeled: true,
  },
}
