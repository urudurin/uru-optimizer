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
}
