import type { SetData } from 'lib/games/zzz/data/dataTypes'
import { ZzzStats } from 'lib/games/zzz/types'

// Keys are the set ids produced by slugifySetName in the importer
export const SETS: Record<string, SetData> = {
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
    // The 4pc depends on Anomaly Mastery and on Freeze/Shatter from teammates
    fourPiece: [],
    fourPieceModeled: false,
  },
  'woodpecker-electro': {
    id: 'woodpecker-electro',
    name: 'Woodpecker Electro',
    twoPiece: [
      {
        stat: ZzzStats.CRIT_RATE,
        value: 8,
        source: 'Woodpecker Electro 2pc',
        confidence: 'sourced',
      },
    ],
    // The 4pc stacks ATK on crits from specific skills
    fourPiece: [],
    fourPieceModeled: false,
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
