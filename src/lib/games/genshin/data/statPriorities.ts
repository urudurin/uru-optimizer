// Which stats each character's artifact substats are scored on (stats/artifactScore.ts), like the fixed per-character
// weights behind Fribbels' HSR relic scores. Each entry says what the character's damage, healing or shields scale on
// and whether crits matter, from the in-game talent descriptions. Our own table, edited by hand: never copied from guide
// sites. Characters not listed are scored as ATK crit damage dealers.
//
// confidence: 'sourced' = read from the talent descriptions; 'unverified' = not checked against the game yet, review it.
// Reviewed: 2026-10-26 (needs the user's review)

export type ScalingStat = 'atk' | 'hp' | 'def' | 'em'

export type StatPriority = {
  scaling: ScalingStat,
  // Whether CRIT Rate and CRIT DMG count
  crit: boolean,
  // Energy Recharge's weight, against CRIT at 1 (default 0.25 for crit characters, 0.5 otherwise)
  er?: number,
  // Elemental Mastery's weight for characters who scale on something else but react a lot
  em?: number,
  confidence: 'sourced' | 'unverified',
}

export const STAT_REVIEWED = '2026-10-26'

export const DEFAULT_PRIORITY: StatPriority = { scaling: 'atk', crit: true, confidence: 'unverified' }

const atkCrit = (extra: Partial<StatPriority> = {}): StatPriority => ({ scaling: 'atk', crit: true, confidence: 'sourced', ...extra })
const hpCrit = (extra: Partial<StatPriority> = {}): StatPriority => ({ scaling: 'hp', crit: true, confidence: 'sourced', ...extra })
const defCrit = (extra: Partial<StatPriority> = {}): StatPriority => ({ scaling: 'def', crit: true, confidence: 'sourced', ...extra })
// Supports whose buffs, heals or shields don't crit
const support = (scaling: ScalingStat, extra: Partial<StatPriority> = {}): StatPriority => ({ scaling, crit: false, confidence: 'sourced', ...extra })

export const STAT_PRIORITIES: Record<string, StatPriority> = {
  // HP scalers
  HuTao: hpCrit({ em: 0.5 }),
  Yelan: hpCrit({ er: 0.5 }),
  Neuvillette: hpCrit(),
  Furina: hpCrit({ er: 0.5 }),
  Zhongli: hpCrit(),
  Mualani: hpCrit(),
  Sigewinne: hpCrit(),
  Nilou: support('hp'),
  SangonomiyaKokomi: support('hp'),
  Baizhu: support('hp'),
  Candace: support('hp'),
  Dori: support('hp'),
  Layla: support('hp'),
  Kirara: support('hp'),
  Barbara: support('hp'),
  Diona: support('hp', { er: 0.75 }),
  Yaoyao: support('hp'),
  Chevreuse: support('hp'),
  Bennett: support('hp', { er: 1 }),
  Columbina: { scaling: 'hp', crit: true, confidence: 'unverified' },

  // DEF scalers
  Noelle: defCrit(),
  AratakiItto: defCrit(),
  Albedo: defCrit(),
  Chiori: defCrit(),
  Gorou: support('def', { er: 0.75 }),
  YunJin: support('def', { er: 0.75 }),
  Xilonen: support('def', { er: 0.5 }),

  // Elemental Mastery
  Nahida: { scaling: 'em', crit: true, confidence: 'sourced' },
  KaedeharaKazuha: support('em', { er: 0.5 }),
  Sucrose: support('em', { er: 0.5 }),
  KukiShinobu: support('em'),
  Sayu: support('em', { er: 0.5 }),
  YumemizukiMizuki: { scaling: 'em', crit: true, confidence: 'sourced' },
  Citlali: support('em', { er: 0.5 }),
  Lauma: { scaling: 'em', crit: false, confidence: 'unverified' },
  Nefer: { scaling: 'em', crit: true, confidence: 'unverified' },

  // ATK supports: buffs, heals and shields from ATK that don't crit
  Shenhe: support('atk', { er: 0.75 }),
  Faruzan: support('atk', { er: 1 }),
  KujouSara: support('atk', { er: 0.75 }),
  Xianyun: support('atk', { er: 0.75 }),
  Qiqi: support('atk'),
  LanYan: support('atk', { er: 0.5 }),
  Iansan: support('atk', { er: 0.75 }),

  // ATK damage dealers who also want ER or EM
  RaidenShogun: atkCrit({ er: 0.75 }),
  Xingqiu: atkCrit({ er: 0.5 }),
  Xiangling: atkCrit({ er: 0.5, em: 0.5 }),
  Mona: atkCrit({ er: 0.5 }),
  Beidou: atkCrit({ er: 0.5 }),
  Fischl: atkCrit(),
  Cyno: atkCrit({ em: 0.5 }),
  Tighnari: atkCrit({ em: 0.5 }),
  Gaming: atkCrit({ em: 0.5 }),
  ShikanoinHeizou: atkCrit({ em: 0.5 }),
  Jean: atkCrit({ er: 0.5 }),
  Rosaria: atkCrit({ er: 0.5 }),
  Venti: atkCrit({ er: 0.5, em: 0.5 }),
  Lisa: atkCrit({ em: 0.5 }),
  Collei: atkCrit({ em: 0.5 }),
  Dehya: atkCrit(),
  Ineffa: atkCrit(),
  Flins: atkCrit(),

  // Not checked yet: scored as ATK crit until reviewed
  Aino: { scaling: 'atk', crit: true, confidence: 'unverified' },
  Durin: { scaling: 'atk', crit: true, confidence: 'unverified' },
  Illuga: { scaling: 'atk', crit: true, confidence: 'unverified' },
  Zibai: { scaling: 'atk', crit: true, confidence: 'unverified' },
  Linnea: { scaling: 'atk', crit: true, confidence: 'unverified' },
  Sandrone: { scaling: 'atk', crit: true, confidence: 'unverified' },
  Odette: { scaling: 'atk', crit: true, confidence: 'unverified' },
  Alyosha: { scaling: 'atk', crit: true, confidence: 'unverified' },
  Vodyanitsa: { scaling: 'atk', crit: true, confidence: 'unverified' },
  Vesna: { scaling: 'atk', crit: true, confidence: 'unverified' },
}

export function statPriority(characterId: string): StatPriority {
  return STAT_PRIORITIES[characterId] ?? DEFAULT_PRIORITY
}
