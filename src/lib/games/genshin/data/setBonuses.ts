import type { GenshinStatKey } from 'lib/games/genshin/types'

// Artifact set 2-piece bonuses that show on the character screen, by GOOD set key. Sets whose 2-piece is something the
// screen doesn't list (skill or burst DMG, shield strength, elemental RES, plunging DMG) are in NO_SCREEN_BONUS.
// Source: the in-game set descriptions; the newer sets were checked against genshin-optimizer's set sheets
// (https://github.com/frzyc/genshin-optimizer, libs/gi/sheets/src/Artifacts, MIT). Confidence: 'sourced'.
// Personal, non-commercial use.

export const SET_2PC_BONUSES: Record<string, Partial<Record<GenshinStatKey, number>>> = {
  // 4-star and lower
  Adventurer: { hp: 1000 },
  LuckyDog: { def: 100 },
  BraveHeart: { atkPct: 18 },
  ResolutionOfSojourner: { atkPct: 18 },
  DefendersWill: { defPct: 30 },
  Berserker: { critRate: 12 },
  Instructor: { elementalMastery: 80 },
  TheExile: { energyRecharge: 20 },
  Scholar: { energyRecharge: 20 },

  // 5-star
  GladiatorsFinale: { atkPct: 18 },
  WanderersTroupe: { elementalMastery: 80 },
  BloodstainedChivalry: { physicalDmg: 25 },
  PaleFlame: { physicalDmg: 25 },
  MaidenBeloved: { healingBonus: 15 },
  OceanHuedClam: { healingBonus: 15 },
  SongOfDaysPast: { healingBonus: 15 },
  ViridescentVenerer: { anemoDmg: 15 },
  DesertPavilionChronicle: { anemoDmg: 15 },
  ThunderingFury: { electroDmg: 15 },
  CrimsonWitchOfFlames: { pyroDmg: 15 },
  ArchaicPetra: { geoDmg: 15 },
  BlizzardStrayer: { cryoDmg: 15 },
  FinaleOfTheDeepGalleries: { cryoDmg: 15 },
  HeartOfDepth: { hydroDmg: 15 },
  NymphsDream: { hydroDmg: 15 },
  DeepwoodMemories: { dendroDmg: 15 },
  TenacityOfTheMillelith: { hpPct: 20 },
  VourukashasGlow: { hpPct: 20 },
  ShimenawasReminiscence: { atkPct: 18 },
  VermillionHereafter: { atkPct: 18 },
  EchoesOfAnOffering: { atkPct: 18 },
  NighttimeWhispersInTheEchoingWoods: { atkPct: 18 },
  FragmentOfHarmonicWhimsy: { atkPct: 18 },
  UnfinishedReverie: { atkPct: 18 },
  ADayCarvedFromRisingWinds: { atkPct: 18 },
  ScarletProof: { atkPct: 18 },
  HeartOfTheFurnace: { atkPct: 18 },
  DisenchantmentInDeepShadow: { atkPct: 18 },
  EmblemOfSeveredFate: { energyRecharge: 20 },
  SilkenMoonsSerenade: { energyRecharge: 20 },
  CelestialGift: { energyRecharge: 20 },
  HuskOfOpulentDreams: { defPct: 30 },
  GildedDreams: { elementalMastery: 80 },
  FlowerOfParadiseLost: { elementalMastery: 80 },
  NightOfTheSkysUnveiling: { elementalMastery: 80 },
  AubadeOfMorningstarAndMoon: { elementalMastery: 80 },
}

export const NO_SCREEN_BONUS = new Set([
  'NoblesseOblige',
  'Thundersoother',
  'Lavawalker',
  'RetracingBolide',
  'MarechausseeHunter',
  'GoldenTroupe',
  'ScrollOfTheHeroOfCinderCity',
  'ObsidianCodex',
  'LongNightsOath',
  'TinyMiracle',
  'Gambler',
  'MartialArtist',
  'TravelingDoctor',
])
