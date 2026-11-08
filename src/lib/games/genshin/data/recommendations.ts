import type { MainStatSlot } from 'lib/games/genshin/optimizer/artifactOptimizer'
import type { GenshinStatKey } from 'lib/games/genshin/types'
import type { SimulationTeammate } from 'lib/games/shared/characterMetadata'

// Our own build recommendations per character (data/metadata.ts reads them): ideal main stats, the artifact sets the
// DPS score's benchmark may use (each option a list of set ids worn together: one id = 4-piece, two = 2 + 2), and for
// some a Default scoring team. Hand-written from general game knowledge, never copied from a guide site (CLAUDE.md);
// guide builds belong in the user's imported presets file, which wins over these. Every entry is unverified until the
// user reviews it. Characters not listed keep "any main stat" and their own sets.
//
// Teams list teammates whose buffs we model (team/buffs.ts) where we can; a teammate's fourPiece is the set they wear
// in the score (a teammate override). Teammates come from the roster, with their own gear, weapon and constellation.

export type GenshinRecommendation = {
  parts: Partial<Record<MainStatSlot, GenshinStatKey[]>>,
  sets: string[][],
  teammates?: SimulationTeammate[],
}

export const RECOMMENDATIONS_REVIEWED = '2026-11-07'

const CRIT: GenshinStatKey[] = ['critRate', 'critDmg']
const bennett: SimulationTeammate = { id: 'Bennett', fourPiece: 'NoblesseOblige' }
const sucrose: SimulationTeammate = { id: 'Sucrose', fourPiece: 'ViridescentVenerer' }
const kazuha: SimulationTeammate = { id: 'KaedeharaKazuha', fourPiece: 'ViridescentVenerer' }
const geoCore: SimulationTeammate[] = [{ id: 'Gorou' }, { id: 'Albedo' }, { id: 'Zhongli' }]

export const GENSHIN_RECOMMENDATIONS: Record<string, GenshinRecommendation> = {
  // Pyro
  Xiangling: {
    parts: { sands: ['atkPct', 'energyRecharge', 'elementalMastery'], goblet: ['pyroDmg'], circlet: CRIT },
    sets: [['EmblemOfSeveredFate'], ['CrimsonWitchOfFlames'], ['GladiatorsFinale', 'CrimsonWitchOfFlames']],
    teammates: [bennett, { id: 'Xingqiu' }, sucrose],
  },
  Arlecchino: {
    parts: { sands: ['atkPct'], goblet: ['pyroDmg'], circlet: CRIT },
    sets: [['FragmentOfHarmonicWhimsy'], ['GladiatorsFinale']],
    teammates: [{ id: 'Yelan' }, bennett, kazuha],
  },
  Mavuika: {
    parts: { sands: ['atkPct'], goblet: ['pyroDmg'], circlet: CRIT },
    sets: [['ObsidianCodex']],
    teammates: [bennett, { id: 'Xilonen' }, { id: 'Citlali' }],
  },
  Gaming: {
    parts: { sands: ['atkPct', 'elementalMastery'], goblet: ['pyroDmg'], circlet: CRIT },
    sets: [['MarechausseeHunter']],
    teammates: [bennett, { id: 'Furina' }, { id: 'Xianyun' }],
  },

  // Hydro
  Xingqiu: {
    parts: { sands: ['atkPct', 'energyRecharge'], goblet: ['hydroDmg'], circlet: CRIT },
    sets: [['EmblemOfSeveredFate']],
    teammates: [{ id: 'Xiangling' }, bennett, sucrose],
  },
  Yelan: {
    parts: { sands: ['hpPct', 'energyRecharge'], goblet: ['hydroDmg'], circlet: CRIT },
    sets: [['EmblemOfSeveredFate']],
    teammates: [{ id: 'Xiangling' }, bennett, { id: 'Xingqiu' }],
  },
  KamisatoAyato: {
    parts: { sands: ['atkPct'], goblet: ['hydroDmg'], circlet: CRIT },
    sets: [['EchoesOfAnOffering'], ['HeartOfDepth']],
    teammates: [{ id: 'Xiangling' }, bennett, kazuha],
  },
  SangonomiyaKokomi: {
    parts: { sands: ['hpPct', 'energyRecharge'], goblet: ['hpPct', 'hydroDmg'], circlet: ['healingBonus'] },
    sets: [['OceanHuedClam'], ['TenacityOfTheMillelith']],
  },
  Nilou: {
    parts: { sands: ['hpPct'], goblet: ['hpPct'], circlet: ['hpPct'] },
    sets: [['TenacityOfTheMillelith'], ['VourukashasGlow']],
  },

  // Electro
  Beidou: {
    parts: { sands: ['atkPct', 'energyRecharge'], goblet: ['electroDmg'], circlet: CRIT },
    sets: [['EmblemOfSeveredFate']],
    teammates: [{ id: 'Xingqiu' }, { id: 'Xiangling' }, bennett],
  },
  Razor: {
    parts: { sands: ['atkPct'], goblet: ['physicalDmg'], circlet: CRIT },
    sets: [['PaleFlame'], ['BloodstainedChivalry']],
  },
  Varesa: {
    parts: { sands: ['atkPct'], goblet: ['electroDmg'], circlet: CRIT },
    sets: [['LongNightsOath']],
  },

  // Geo
  AratakiItto: {
    parts: { sands: ['defPct'], goblet: ['geoDmg'], circlet: CRIT },
    sets: [['HuskOfOpulentDreams']],
    teammates: geoCore,
  },
  Noelle: {
    parts: { sands: ['defPct'], goblet: ['geoDmg'], circlet: CRIT },
    sets: [['HuskOfOpulentDreams']],
    teammates: geoCore,
  },
  Albedo: {
    parts: { sands: ['defPct'], goblet: ['geoDmg'], circlet: CRIT },
    sets: [['HuskOfOpulentDreams'], ['GoldenTroupe']],
    teammates: [{ id: 'AratakiItto' }, { id: 'Gorou' }, { id: 'Zhongli' }],
  },
  Navia: {
    parts: { sands: ['atkPct'], goblet: ['geoDmg'], circlet: CRIT },
    sets: [['NighttimeWhispersInTheEchoingWoods']],
    teammates: [{ id: 'Furina' }, bennett, { id: 'Xiangling' }],
  },

  // Cryo
  Chongyun: {
    parts: { sands: ['atkPct'], goblet: ['cryoDmg'], circlet: CRIT },
    sets: [['EmblemOfSeveredFate'], ['BlizzardStrayer']],
  },
  Skirk: {
    parts: { sands: ['atkPct'], goblet: ['cryoDmg'], circlet: CRIT },
    sets: [['FinaleOfTheDeepGalleries']],
  },

  // Dendro
  Kinich: {
    parts: { sands: ['atkPct'], goblet: ['dendroDmg'], circlet: CRIT },
    sets: [['ObsidianCodex']],
  },
  Emilie: {
    parts: { sands: ['atkPct'], goblet: ['dendroDmg'], circlet: CRIT },
    sets: [['UnfinishedReverie']],
  },

  // Anemo
  YumemizukiMizuki: {
    parts: { sands: ['elementalMastery'], goblet: ['elementalMastery'], circlet: ['elementalMastery'] },
    sets: [['ViridescentVenerer']],
  },
}
