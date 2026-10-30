import type {
  Specialty,
  StatEffect,
} from 'lib/games/zzz/data/dataTypes'
import {
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'

// Stat parts of W-Engine passives for engines that only come from Enka's store (data/enkaGameData.ts gives them these),
// from genshin-optimizer's W-Engine sheets and the R1-R5 values in its generated stats (libs/zzz/formula/src/data/wengine/
// sheets, libs/zzz/stats/src/allStat_gen.json; MIT, Copyright (c) 2020 frzyc). Like the hand-written engines in
// wEngines.ts they never show on the stat screen, so they count in combat ('onField'), conditions met and stacks full,
// and only for agents of the engine's specialty (GO's cmpSpecialtyAndEquipped). Parts that buff some hits only are in
// damage/gearEffects.ts, parts for the squad in team/buffs.ts W_ENGINE_TEAM_BUFFS. All-type DMG Bonus counts as Element DMG.
// Personal, non-commercial use.

type Part = { stat: ZzzStatsValues, values: number[], note: string, element?: string }

function passive(name: string, specialty: Specialty, parts: Part[]): (refinement: number) => StatEffect[] {
  return (refinement) =>
    parts.flatMap(({ stat, values, note, element }) => {
      const value = values[refinement - 1]
      if (value === undefined) return []
      return [
        {
          stat,
          value,
          when: 'onField',
          specialty,
          ...(element ? { element } : {}),
          source: `${name} passive (${note})`,
          confidence: 'sourced',
        } satisfies StatEffect,
      ]
    })
}

const times = (values: number[], n: number) => values.map((value) => Math.round(value * n * 1000) / 1000)

export const W_ENGINE_PASSIVES: Record<string, (refinement: number) => StatEffect[]> = {
  '13013': passive('Gilded Blossom', 'Attack', [{ stat: ZzzStats.ATK_P, values: [6, 6.9, 7.8, 8.7, 9.6], note: 'ATK' }]),
  '14110': passive('Hellfire Gears', 'Stun', [{ stat: ZzzStats.IMPACT, values: times([10, 12.5, 15, 17.5, 20], 2), note: '2 EX Special stacks' }]),
  '14121': passive('Weeping Cradle', 'Support', [
    { stat: ZzzStats.ELEMENT_DMG, values: [20.2, 24.5, 30, 35.5, 39.8], note: 'while attacking, full stacks' },
  ]),
  '14150': passive('Angel in the Shell', 'Anomaly', [
    { stat: ZzzStats.ANOMALY_PROFICIENCY, values: [90, 103, 117, 130, 144], note: 'Anomaly Proficiency' },
    { stat: ZzzStats.ELEMENT_DMG, values: [20, 23, 26, 29, 32], note: 'Ether, enemy with an anomaly', element: 'Ether' },
  ]),
  '14151': passive('Neon Fantasies', 'Stun', [
    { stat: ZzzStats.ANOMALY_PROFICIENCY, values: [90, 103, 117, 130, 145], note: 'Anomaly Proficiency' },
    { stat: ZzzStats.ANOMALY_PROFICIENCY, values: [60, 69, 78, 87, 96], note: '2 stacks' },
    { stat: ZzzStats.ELEMENT_DMG, values: times([15, 17, 19.5, 21, 24], 2), note: 'squad DMG, 2 stacks' },
  ]),
  '14155': passive('Sol Exuvia', 'Attack', [{ stat: ZzzStats.CRIT_RATE, values: [20, 20, 20, 20, 20], note: 'CRIT Rate' }]),
  '14156': passive('Joyau Dore', 'Anomaly', [{ stat: ZzzStats.ANOMALY_PROFICIENCY, values: [70, 80, 90, 100, 110], note: 'Anomaly Proficiency' }]),
  '14158': passive('Ode of Resurrected Wings', 'Anomaly', [
    { stat: ZzzStats.ANOMALY_PROFICIENCY, values: [96, 105, 115, 125, 135], note: 'Anomaly Proficiency' },
    { stat: ZzzStats.ELEMENT_DMG, values: [30, 34.5, 39, 43.5, 48], note: 'squad DMG after Refringe' },
  ]),
  '14161': passive('Crimson Thirst', 'Armorer', [
    { stat: ZzzStats.CRIT_RATE, values: [25, 27.5, 30, 32.5, 35], note: 'CRIT Rate' },
    { stat: ZzzStats.ELEMENT_DMG, values: [15, 17.5, 20, 22.5, 25], note: 'Electric DMG', element: 'Electric' },
  ]),

  // B-rank
  '12002': passive('[Lunar] Decrescent', 'Attack', [{
    stat: ZzzStats.ELEMENT_DMG,
    values: [15, 17.5, 20, 22.5, 25],
    note: 'after a Chain Attack or Ultimate',
  }]),
  '12004': passive('[Reverb] Mark I', 'Support', [{ stat: ZzzStats.IMPACT, values: [8, 9, 10, 11, 12], note: 'squad Impact after an EX Special' }]),
  '12005': passive('[Reverb] Mark II', 'Support', [{
    stat: ZzzStats.ANOMALY_PROFICIENCY,
    values: [10, 12, 13, 15, 16],
    note: 'squad, after an EX Special or Chain',
  }]),
  '12006': passive('[Reverb] Mark III', 'Support', [{ stat: ZzzStats.ATK_P, values: [8, 9, 10, 11, 12], note: 'squad ATK after a Chain or Ultimate' }]),
  '12009': passive('[Vortex] Hatchet', 'Stun', [{ stat: ZzzStats.IMPACT, values: [9, 10, 11, 12, 13], note: 'entering combat' }]),
  '12011': passive('[Magnetic Storm] Bravo', 'Anomaly', [{ stat: ZzzStats.ANOMALY_PROFICIENCY, values: [25, 28, 32, 36, 40], note: 'Anomaly buildup' }]),
  '12013': passive('[Identity] Base', 'Defense', [{ stat: ZzzStats.DEF_P, values: [20, 23, 26, 29, 32], note: 'when attacked' }]),
  '12015': passive('[Cinder] Cobalt', 'Rupture', [{ stat: ZzzStats.ATK_P, values: [7.2, 8.2, 9.3, 10.4, 11.5], note: 'entering combat or switching in' }]),

  // A-rank
  '13003': passive('Rainforest Gourmet', 'Anomaly', [{ stat: ZzzStats.ATK_P, values: times([2.5, 2.8, 3.2, 3.6, 4], 10), note: '10 stacks' }]),
  '13004': passive('Starlight Engine', 'Attack', [{
    stat: ZzzStats.ATK_P,
    values: [12, 13.8, 15.6, 17.4, 19.2],
    note: 'after a Dodge Counter or Quick Assist',
  }]),
  '13005': passive('Steam Oven', 'Stun', [{ stat: ZzzStats.IMPACT, values: times([2, 2.3, 2.6, 2.9, 3.2], 8), note: '8 stacks' }]),
  '13007': passive('Original Transmorpher', 'Defense', [
    { stat: ZzzStats.HP_P, values: [8, 9, 10, 11, 12.5], note: 'HP' },
    { stat: ZzzStats.IMPACT, values: [10, 11.5, 13, 14.5, 16], note: 'when hit' },
  ]),
  '13008': passive('Weeping Gemini', 'Anomaly', [{ stat: ZzzStats.ANOMALY_PROFICIENCY, values: times([30, 34, 38, 42, 48], 4), note: '4 stacks' }]),
  '13009': passive('Electro-Lip Gloss', 'Anomaly', [
    { stat: ZzzStats.ATK_P, values: [10, 11.5, 13, 14.5, 16], note: 'enemy with an anomaly' },
    { stat: ZzzStats.ELEMENT_DMG, values: [15, 17.5, 20, 22.5, 25], note: 'enemy with an anomaly' },
  ]),
  '13010': passive('Bunny Band', 'Defense', [
    { stat: ZzzStats.HP_P, values: [8, 9.2, 10.4, 11.6, 12.8], note: 'HP' },
    { stat: ZzzStats.ATK_P, values: [10, 11.5, 13, 14.5, 16], note: 'while shielded' },
  ]),
  '13012': passive('Puzzle Sphere', 'Rupture', [{ stat: ZzzStats.CRIT_DMG, values: [16, 18.4, 20.8, 23.2, 25.6], note: 'launching an EX Special' }]),
  '13015': passive('Marcato Desire', 'Attack', [{
    stat: ZzzStats.ATK_P,
    values: times([6, 6.9, 7.8, 8.7, 9.6], 2),
    note: 'EX Special or Chain hits, enemy with an anomaly',
  }]),
  '13017': passive('Catty Luck', 'Armorer', [{ stat: ZzzStats.DEF_P, values: times([8, 9, 10, 11, 12], 2), note: 'DEF, doubled after an EX Special' }]),
  '13018': passive('Boisterous Echoes', 'Anomaly', [{ stat: ZzzStats.ELEMENT_DMG, values: [11.5, 13.2, 15, 16.7, 18.4], note: 'enemy with an anomaly' }]),
  '13019': passive('Cauldron of Clarity', 'Rupture', [
    { stat: ZzzStats.ELEMENT_DMG, values: times([4, 4.6, 5.2, 5.8, 6.4], 3), note: '3 EX Special stacks' },
    { stat: ZzzStats.CRIT_RATE, values: [6.5, 7.5, 8.5, 9.4, 10.4], note: '3 stacks' },
  ]),
  '13020': passive('The Simmering Pot', 'Stun', [{ stat: ZzzStats.ELEMENT_DMG, values: [7.2, 8.2, 9.2, 10.2, 11.5], note: 'after an Assist Follow-Up' }]),
  '13101': passive('Demara Battery Mark II', 'Stun', [{
    stat: ZzzStats.ELEMENT_DMG,
    values: [15, 17.5, 20, 22, 24],
    note: 'Electric DMG',
    element: 'Electric',
  }]),
  '13103': passive('The Vault', 'Support', [{ stat: ZzzStats.ELEMENT_DMG, values: [15, 17.5, 20, 22, 24], note: 'squad DMG after an Ether hit' }]),
  '13106': passive('Housekeeper', 'Attack', [
    { stat: ZzzStats.ELEMENT_DMG, values: times([3, 3.5, 4, 4.4, 4.8], 15), note: 'Physical DMG, 15 EX Special stacks', element: 'Physical' },
  ]),
  '13108': passive('Starlight Engine Replica', 'Attack', [
    { stat: ZzzStats.ELEMENT_DMG, values: [36, 41, 46.5, 52, 57.5], note: 'Physical DMG at range', element: 'Physical' },
  ]),
  '13113': passive('Bashful Demon', 'Support', [
    { stat: ZzzStats.ELEMENT_DMG, values: [15, 17.5, 20, 22, 24], note: 'Ice DMG', element: 'Ice' },
    { stat: ZzzStats.ATK_P, values: times([2, 2.3, 2.6, 2.9, 3.2], 4), note: 'squad ATK, 4 EX Special stacks' },
  ]),
  '13115': passive('Kaboom the Cannon', 'Support', [{ stat: ZzzStats.ATK_P, values: times([2.5, 2.8, 3.2, 3.6, 4], 4), note: 'squad ATK, 4 stacks' }]),
  '13135': passive('Box Cutter', 'Stun', [{
    stat: ZzzStats.ELEMENT_DMG,
    values: [15, 17.3, 19.5, 21.8, 24],
    note: 'Physical DMG after an Aftershock',
    element: 'Physical',
  }]),
  '13144': passive('Grill O\'Wisp', 'Rupture', [
    { stat: ZzzStats.ELEMENT_DMG, values: [15, 17.25, 19.5, 21.75, 24], note: 'Fire DMG', element: 'Fire' },
    { stat: ZzzStats.CRIT_RATE, values: [15, 17.25, 19.5, 21.75, 24], note: 'after HP drops' },
  ]),
  '14001': passive('Cannon Rotor', 'Attack', [{ stat: ZzzStats.ATK_P, values: [7.5, 8.6, 9.7, 10.8, 12], note: 'ATK' }]),
  '14002': passive('Unfettered Game Ball', 'Support', [{ stat: ZzzStats.CRIT_RATE, values: [12, 13.5, 15.5, 17.5, 20], note: 'after an attribute counter' }]),

  // S-rank
  '14102': passive('Steel Cushion', 'Attack', [
    { stat: ZzzStats.ELEMENT_DMG, values: [25, 31.5, 38, 44, 50], note: 'Physical DMG', element: 'Physical' },
  ]),
  '14104': passive('The Brimstone', 'Attack', [{ stat: ZzzStats.ATK_P, values: times([3.5, 4.4, 5.2, 6, 7], 8), note: '8 stacks' }]),
  '14105': passive('Kraken\'s Cradle', 'Rupture', [{ stat: ZzzStats.CRIT_RATE, values: [20, 23, 26, 29, 32], note: 'HP below 50%' }]),
  '14107': passive('Tusks of Fury', 'Defense', [{
    stat: ZzzStats.ELEMENT_DMG,
    values: [18, 22.5, 27, 31.5, 36],
    note: 'squad DMG after an Interrupt or Perfect Dodge',
  }]),
  '14116': passive('Blazing Laurel', 'Stun', [
    { stat: ZzzStats.IMPACT, values: [25, 28.75, 32.5, 36.25, 40], note: 'after a Quick or Perfect Assist' },
    { stat: ZzzStats.CRIT_DMG, values: times([1.5, 1.72, 1.95, 2.17, 2.4], 20), note: 'Ice, 20 Wilt stacks', element: 'Ice' },
    { stat: ZzzStats.CRIT_DMG, values: times([1.5, 1.72, 1.95, 2.17, 2.4], 20), note: 'Fire, 20 Wilt stacks', element: 'Fire' },
  ]),
  '14117': passive('Flamemaker Shaker', 'Anomaly', [
    { stat: ZzzStats.ELEMENT_DMG, values: times([3.5, 4.4, 5.2, 6.1, 7], 10), note: '10 EX Special or Assist stacks, on field' },
    { stat: ZzzStats.ANOMALY_PROFICIENCY, values: [50, 62, 75, 87, 100], note: '5+ stacks' },
  ]),
  '14118': passive('Fusion Compiler', 'Anomaly', [
    { stat: ZzzStats.ATK_P, values: [12, 15, 18, 21, 24], note: 'ATK' },
    { stat: ZzzStats.ANOMALY_PROFICIENCY, values: times([25, 31, 37, 43, 50], 3), note: '3 Special stacks' },
  ]),
  '14119': passive('Deep Sea Visitor', 'Attack', [
    { stat: ZzzStats.ELEMENT_DMG, values: [25, 31.5, 38, 44.5, 50], note: 'Ice DMG', element: 'Ice' },
    { stat: ZzzStats.CRIT_RATE, values: times([10, 12.5, 15, 17.5, 20], 2), note: 'after Basic Attack and Ice Dash Attack hits' },
  ]),
  '14120': passive('Zanshin Herb Case', 'Attack', [
    { stat: ZzzStats.CRIT_RATE, values: times([10, 11.5, 13, 14.5, 16], 2), note: 'plus more after an anomaly or stun' },
  ]),
  '14122': passive('Timeweaver', 'Anomaly', [{ stat: ZzzStats.ANOMALY_PROFICIENCY, values: [75, 85, 95, 105, 115], note: 'hitting an enemy with an anomaly' }]),
  '14124': passive('Riot Suppressor Mark VI', 'Attack', [{ stat: ZzzStats.CRIT_RATE, values: [15, 18.8, 22.6, 26.4, 30], note: 'CRIT Rate' }]),
  '14125': passive('Ice-Jade Teapot', 'Stun', [
    { stat: ZzzStats.IMPACT, values: times([0.7, 0.88, 1.05, 1.22, 1.4], 30), note: '30 Tea-riffic stacks' },
    { stat: ZzzStats.ELEMENT_DMG, values: [20, 23, 26, 29, 32], note: 'squad DMG at 15+ stacks' },
  ]),
  '14126': passive('Sharpened Stinger', 'Anomaly', [
    { stat: ZzzStats.ELEMENT_DMG, values: times([12, 15, 18, 21, 24], 3), note: 'Physical DMG, 3 stacks', element: 'Physical' },
  ]),
  '14129': passive('Myriad Eclipse', 'Attack', [{ stat: ZzzStats.CRIT_DMG, values: [45, 51.75, 58.5, 65.25, 72], note: 'CRIT DMG' }]),
  '14130': passive('Bellicose Blaze', 'Attack', [{ stat: ZzzStats.CRIT_RATE, values: [20, 23, 26, 29, 32], note: 'CRIT Rate' }]),
  '14131': passive('Elegant Vanity', 'Support', [{ stat: ZzzStats.ELEMENT_DMG, values: times([10, 11.5, 13, 14.5, 16], 2), note: 'squad DMG, 2 stacks' }]),
  '14132': passive('Heartstring Nocturne', 'Attack', [{ stat: ZzzStats.CRIT_DMG, values: [50, 57.5, 65, 72.5, 80], note: 'CRIT DMG' }]),
  '14133': passive('Flight of Fancy', 'Anomaly', [{ stat: ZzzStats.ANOMALY_PROFICIENCY, values: times([20, 23, 26, 29, 32], 6), note: '6 Ether DMG stacks' }]),
  '14134': passive('Half-Sugar Bunny', 'Defense', [
    { stat: ZzzStats.ATK_P, values: [10, 11.5, 13, 14.5, 16], note: 'squad ATK' },
    { stat: ZzzStats.HP_P, values: [10, 11.5, 13, 14.5, 16], note: 'squad HP' },
    { stat: ZzzStats.CRIT_DMG, values: [30, 34.5, 39, 43.5, 48], note: 'squad, Ether Veil' },
  ]),
  '14136': passive('Spectral Gaze', 'Stun', [
    { stat: ZzzStats.IMPACT, values: [8 + 12, 9.2 + 13.8, 10.4 + 15.6, 11.6 + 17.4, 12.8 + 19.2], note: '3 Spirit Lock stacks' },
  ]),
  '14139': passive('Roaring Furnace', 'Stun', [
    { stat: ZzzStats.ELEMENT_DMG, values: times([10, 11.5, 13, 14.5, 16], 2), note: 'squad Fire DMG, 2 stacks', element: 'Fire' },
  ]),
  '14140': passive('Practiced Perfection', 'Anomaly', [
    { stat: ZzzStats.ELEMENT_DMG, values: times([20, 23, 26, 29, 32], 2), note: 'Physical DMG, 2 stacks', element: 'Physical' },
  ]),
  '14141': passive('Metanukimorphosis', 'Support', [{ stat: ZzzStats.ANOMALY_PROFICIENCY, values: [60, 69, 78, 87, 96], note: 'squad, after an Aftershock' }]),
  '14145': passive('Dreamlit Hearth', 'Support', [
    { stat: ZzzStats.ELEMENT_DMG, values: [25, 28.8, 32.5, 36.3, 40], note: 'squad DMG, Ether Veil' },
    { stat: ZzzStats.HP_P, values: [15, 17.3, 19.5, 21.8, 24], note: 'squad HP, Ether Veil' },
  ]),
  '14146': passive('Cordis Germina', 'Attack', [
    { stat: ZzzStats.CRIT_RATE, values: [15, 17, 19, 21, 23], note: 'CRIT Rate' },
    { stat: ZzzStats.ELEMENT_DMG, values: times([12.5, 14.5, 16.5, 18.5, 20], 2), note: 'Electric DMG, 2 stacks', element: 'Electric' },
  ]),
  '14147': passive('Wrathful Vajra', 'Rupture', [{ stat: ZzzStats.CRIT_RATE, values: [20, 23, 26, 29, 32], note: 'CRIT Rate' }]),
  '14148': passive('Yesterday Calls', 'Stun', [{ stat: ZzzStats.CRIT_DMG, values: [30, 34.5, 39, 43.5, 48], note: 'squad, 3 Physical EX Special stacks' }]),
  '14149': passive('Thoughtbop', 'Support', [
    { stat: ZzzStats.ELEMENT_DMG, values: times([12.5, 14.3, 16.1, 17.9, 20], 2), note: 'squad DMG, 2 stacks' },
    { stat: ZzzStats.ATK_P, values: [10, 11.5, 13, 14.5, 16], note: 'squad ATK at 2 stacks' },
  ]),
  '14152': passive('Serpentine Seeker', 'Attack', [{ stat: ZzzStats.CRIT_RATE, values: [25, 28.8, 32.5, 36.3, 40], note: 'CRIT Rate' }]),
  '14153': passive('Starlight Rider Faceplate', 'Rupture', [{ stat: ZzzStats.CRIT_RATE, values: [20, 23, 26, 29, 32], note: 'CRIT Rate' }]),
  '14154': passive('Frostfall Sickle', 'Anomaly', [
    { stat: ZzzStats.ELEMENT_DMG, values: times([20, 23, 26, 29, 32], 2), note: 'Ice DMG, 2 Special stacks', element: 'Ice' },
  ]),
  '14157': passive('Chief Sidekick', 'Stun', [
    { stat: ZzzStats.ELEMENT_DMG, values: times([12.5, 14.4, 16.3, 18.1, 20], 2), note: 'squad DMG, 2 Fire EX Special stacks', element: 'Fire' },
  ]),
  '14159': passive('Knight\'s Extolment', 'Attack', [{
    stat: ZzzStats.CRIT_DMG,
    values: times([32, 36.8, 41.6, 46.4, 51.2], 2),
    note: '2 Battle Edge stacks',
  }]),
  '14162': passive('Crimson Moon Casket', 'Stun', [
    { stat: ZzzStats.CRIT_RATE, values: [24, 26, 28, 30, 32], note: 'CRIT Rate' },
    { stat: ZzzStats.ELEMENT_DMG, values: [20, 23, 26, 29, 32], note: 'squad DMG after a Wind EX Special' },
  ]),
}
