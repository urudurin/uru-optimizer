import type { ZzzCombatEffect } from 'lib/games/zzz/damage/combatEffects'
import type { KindBonus } from 'lib/games/zzz/damage/damage'
import { ZzzStats } from 'lib/games/zzz/types'

// What disc sets and W-Engines do to some hits only (Basic Attack DMG, Ultimate DMG, Anomaly DMG...), on top of their
// stat effects in data/sets.ts, data/wEngines.ts and data/wEnginePassives.ts. From genshin-optimizer's disc and W-Engine
// sheets and the R1-R5 values in its generated stats (libs/zzz/formula/src/data/disc/sheets and wengine/sheets,
// libs/zzz/stats/src/allStat_gen.json; https://github.com/frzyc/genshin-optimizer, MIT, Copyright (c) 2020 frzyc).
// They count in rotation damage only. A set counts when the optimizer's set filter picks it (like Genshin's 4-piece
// effects), since its bonus differs build to build; the W-Engine is the one picked for the search, and its effects need
// an agent of its specialty. Personal, non-commercial use.

export type SetEffects = { pieces: 2 | 4, effects: ZzzCombatEffect[] }

export const SET_EFFECTS: Record<string, SetEffects[]> = {
  'chaos-jazz': [{
    pieces: 4,
    effects: [{
      id: 'chaos-jazz-off-field',
      label: 'Chaos Jazz 4pc: Special Attack and Assist DMG +20% while off field',
      toggle: { kind: 'switch', label: 'Off field' },
      kinds: () => ({ special: 20, quickAssist: 20, assist: 20, assistFollowUp: 20 }),
      confidence: 'sourced',
    }],
  }],
  'dawns-bloom': [
    {
      pieces: 2,
      effects: [{ id: 'dawns-bloom-2', label: 'Dawn\'s Bloom 2pc: Basic Attack DMG +15%', kinds: () => ({ basic: 15 }), confidence: 'sourced' }],
    },
    {
      pieces: 4,
      effects: [
        { id: 'dawns-bloom-4', label: 'Dawn\'s Bloom 4pc: Basic Attack DMG +20%', kinds: () => ({ basic: 20 }), confidence: 'sourced' },
        {
          id: 'dawns-bloom-4-attack',
          label: 'Dawn\'s Bloom 4pc: Basic Attack DMG +20% more for Attack agents after an EX Special or Ultimate',
          specialty: 'Attack',
          toggle: { kind: 'switch', label: 'After EX Special or Ultimate' },
          kinds: () => ({ basic: 20 }),
          confidence: 'sourced',
        },
      ],
    },
  ],
  'notes-from-the-chained': [{
    pieces: 4,
    effects: [{
      id: 'notes-from-the-chained-freeze',
      label: 'Notes From the Chained 4pc: Anomaly and Disorder DMG +16% (a multiplier of its own) after Freeze',
      toggle: { kind: 'switch', label: 'After Freeze' },
      anomalies: () => ({ anomaly: { buff: 16 }, disorder: { buff: 16 } }),
      confidence: 'sourced',
    }],
  }],
  'polar-metal': [{
    pieces: 4,
    effects: [
      {
        id: 'polar-metal-4',
        label: 'Polar Metal 4pc: Basic Attack and Dash Attack DMG +20%',
        kinds: () => ({ basic: 20, dash: 20 }),
        confidence: 'sourced',
      },
      {
        id: 'polar-metal-4-freeze',
        label: 'Polar Metal 4pc: another +20% after a squad member Freezes or Shatters',
        toggle: { kind: 'switch', label: 'After Freeze or Shatter' },
        kinds: () => ({ basic: 20, dash: 20 }),
        confidence: 'sourced',
      },
    ],
  }],
  'puffer-electro': [{
    pieces: 4,
    effects: [{ id: 'puffer-electro-4', label: 'Puffer Electro 4pc: Ultimate DMG +20%', kinds: () => ({ ult: 20 }), confidence: 'sourced' }],
  }],
  'shadow-harmony': [{
    pieces: 2,
    effects: [{
      id: 'shadow-harmony-2',
      label: 'Shadow Harmony 2pc: Dash Attack and Aftershock DMG +15%',
      kinds: () => ({ dash: 15, aftershock: 15 }),
      confidence: 'sourced',
    }],
  }],
  'yunkui-tales': [{
    pieces: 4,
    effects: [{
      id: 'yunkui-tales-sheer',
      label: 'Yunkui Tales 4pc: Sheer DMG +10% at 3 stacks (its CRIT Rate is in data/sets.ts)',
      sheerDmg: () => 10,
      confidence: 'sourced',
    }],
  }],
  'shining-aria': [{
    pieces: 4,
    effects: [{
      id: 'shining-aria-stunned',
      label: 'Shining Aria 4pc: DMG +25% against stunned enemies',
      toggle: { kind: 'switch', label: 'Enemy stunned' },
      stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: 25 }],
      confidence: 'sourced',
    }],
  }],
}

// By W-Engine id; values by refinement (R1-R5)
const at = (values: number[], refinement: number) => values[Math.min(5, Math.max(1, refinement)) - 1]

export const W_ENGINE_EFFECTS: Record<string, (refinement: number) => ZzzCombatEffect[]> = {
  // Gilded Blossom
  '13013': (r) => [{
    id: 'gilded-blossom-ex',
    label: `Gilded Blossom: EX Special Attack DMG +${at([15, 17.2, 19.5, 21.8, 24], r)}%`,
    specialty: 'Attack',
    kinds: () => ({ exSpecial: at([15, 17.2, 19.5, 21.8, 24], r) }),
    confidence: 'sourced',
  }],
  // The Restrained
  '14114': (r) => [{
    id: 'the-restrained-basic',
    label: `The Restrained: Basic Attack DMG +${at([6, 7.5, 9, 10.5, 12], r)}% per stack`,
    specialty: 'Stun',
    toggle: { kind: 'stacks', label: 'Stacks', max: 5 },
    kinds: ({ setting }) => ({ basic: at([6, 7.5, 9, 10.5, 12], r) * Number(setting) }),
    confidence: 'sourced',
  }],
  // Angel in the Shell
  '14150': (r) => [{
    id: 'angel-in-the-shell-anomaly',
    label: `Angel in the Shell: Ether Anomaly and Disorder DMG +${at([10, 11.5, 13, 14.5, 16], r)}% (a multiplier of its own)`,
    specialty: 'Anomaly',
    element: 'Ether',
    toggle: { kind: 'switch', label: 'On field or after a Special' },
    anomalies: () => ({ anomaly: { buff: at([10, 11.5, 13, 14.5, 16], r) }, disorder: { buff: at([10, 11.5, 13, 14.5, 16], r) } }),
    confidence: 'sourced',
  }],
  // Joyau Dore
  '14156': (r) => [{
    id: 'joyau-dore-vortex',
    label: `Joyau Dore: Vortex and Wind anomaly DMG +${at([7, 8, 9, 10, 11], r)}% per Wind EX Special stack (a multiplier of its own)`,
    specialty: 'Anomaly',
    element: 'Wind',
    toggle: { kind: 'stacks', label: 'Stacks', max: 2 },
    anomalies: ({ setting }) => {
      const buff = at([7, 8, 9, 10, 11], r) * Number(setting)
      return { vortex: { buff }, wind: { buff } }
    },
    confidence: 'sourced',
  }],
  // Ode of Resurrected Wings
  '14158': (r) => [{
    id: 'ode-of-resurrected-wings-anomaly',
    label: `Ode of Resurrected Wings: Anomaly DMG +${at([20, 23, 26, 29, 32], r)}% after Refringe (a multiplier of its own)`,
    specialty: 'Anomaly',
    toggle: { kind: 'switch', label: 'After Refringe' },
    anomalies: () => ({ anomaly: { buff: at([20, 23, 26, 29, 32], r) } }),
    confidence: 'sourced',
  }],

  // DMG Bonus for some hits
  '12001': (
    r,
  ) => [
    kindEffect(
      'lunar-pleniluna',
      '[Lunar] Pleniluna',
      'Attack',
      ['basic', 'dash', 'dodgeCounter'],
      at([12, 14, 16, 18, 20], r),
      'Basic, Dash Attack and Dodge Counter',
    ),
  ],
  '12016': (r) => [
    kindEffect('lunar-semiluna', '[Lunar] Semiluna', 'Armorer', ['basic'], at([18, 21, 24, 27, 30], r), 'Basic Attack', {
      toggle: { kind: 'switch', label: 'After an EX Special' },
    }),
  ],
  '13001': (r) => [{
    id: 'street-superstar-ult',
    label: `Street Superstar: Ultimate DMG +${at([15, 17.2, 19.5, 21.7, 24], r)}% per Charge`,
    specialty: 'Attack',
    toggle: { kind: 'stacks', label: 'Charge', max: 3 },
    kinds: ({ setting }) => ({ ult: at([15, 17.2, 19.5, 21.7, 24], r) * Number(setting) }),
    confidence: 'sourced',
  }],
  '13012': (r) => [
    kindEffect('puzzle-sphere', 'Puzzle Sphere', 'Rupture', ['exSpecial'], at([20, 23, 26, 29, 32], r), 'EX Special Attack', {
      toggle: { kind: 'switch', label: 'Enemy below 50% HP' },
    }),
  ],
  '13111': (r) => [
    kindEffect('drill-rig-red-axis', 'Drill Rig - Red Axis', 'Attack', ['basic', 'dash'], at([50, 57.5, 65, 72.5, 80], r), 'Electric Basic and Dash Attack', {
      element: 'Electric',
      toggle: { kind: 'switch', label: 'After an EX Special or Chain' },
    }),
  ],
  '13142': (
    r,
  ) => [
    kindEffect('tremor-trigram-vessel', 'Tremor Trigram Vessel', 'Defense', ['exSpecial', 'ult'], at([25, 28.7, 32.5, 36.2, 40], r), 'EX Special and Ultimate'),
  ],
  '14102': (r) => [{
    id: 'steel-cushion-behind',
    label: `Steel Cushion: DMG +${at([25, 31.5, 38, 44, 50], r)}% hitting from behind`,
    specialty: 'Attack',
    toggle: { kind: 'switch', label: 'From behind' },
    stats: () => [{ stat: ZzzStats.ELEMENT_DMG, value: at([25, 31.5, 38, 44, 50], r) }],
    confidence: 'sourced',
  }],
  '14120': (
    r,
  ) => [kindEffect('zanshin-herb-case', 'Zanshin Herb Case', 'Attack', ['dash'], at([40, 46, 52, 58, 64], r), 'Electric Dash Attack', { element: 'Electric' })],
  '14124': (r) => [
    kindEffect('riot-suppressor', 'Riot Suppressor Mark VI', 'Attack', ['basic'], at([35, 43.5, 52, 60.5, 70], r), 'Ether Basic Attack', {
      element: 'Ether',
      toggle: { kind: 'switch', label: 'Charge' },
    }),
  ],

  // Anomaly-only
  '14122': (r) => [{
    id: 'timeweaver-disorder',
    label: `Timeweaver: Disorder DMG +${at([25, 27.5, 30, 32.5, 35], r)}% at 375+ Anomaly Proficiency (a multiplier of its own)`,
    specialty: 'Anomaly',
    toggle: { kind: 'switch', label: '375+ Anomaly Proficiency' },
    anomalies: () => ({ disorder: { buff: at([25, 27.5, 30, 32.5, 35], r) } }),
    confidence: 'sourced',
  }],

  // RES and DEF ignore
  '14143': (r) => [ignoreEffect('cloudcleave-radiance', 'Cloudcleave Radiance', 'Attack', 'res', at([20, 22, 24, 26, 28], r), { element: 'Physical' })],
  '14157': (r) => [ignoreEffect('chief-sidekick', 'Chief Sidekick', 'Stun', 'res', at([15, 17.2, 19.5, 21.7, 24], r), { element: 'Fire' })],
  '14159': (r) => [
    ignoreEffect('knights-extolment', 'Knight\'s Extolment', 'Attack', 'res', at([20, 23, 26, 29, 32], r), {
      element: 'Ice',
      toggle: { kind: 'switch', label: '2 Battle Edge stacks' },
    }),
  ],
  '14162': (r) => [ignoreEffect('crimson-moon-casket', 'Crimson Moon Casket', 'Stun', 'res', at([15, 17.3, 19.5, 21.8, 24], r), { element: 'Wind' })],
  '14129': (r) => [
    ignoreEffect('myriad-eclipse', 'Myriad Eclipse', 'Attack', 'def', at([25, 28.75, 32.5, 36.25, 40], r), {
      toggle: { kind: 'switch', label: 'Death Sentence' },
    }),
  ],
  '14136': (r) => [
    ignoreEffect('spectral-gaze', 'Spectral Gaze', 'Stun', 'def', at([25, 28.75, 32.5, 36.25, 40], r), {
      toggle: { kind: 'switch', label: 'After an Electric Aftershock' },
    }),
  ],
  '14152': (r) => [
    ignoreEffect('serpentine-seeker', 'Serpentine Seeker', 'Attack', 'def', at([28, 31.5, 35, 38.5, 42], r), {
      element: 'Electric',
      toggle: { kind: 'switch', label: 'After spending Energy' },
    }),
  ],
  '14130': (r) => [{
    id: 'bellicose-blaze-aftershock',
    label: `Bellicose Blaze: Fire Aftershock ignores ${at([15, 17.2, 19.5, 21.7, 24], r) * 2}% of the enemy's DEF (2 stacks)`,
    specialty: 'Attack',
    element: 'Fire',
    aftershockDefIgnore: at([15, 17.2, 19.5, 21.7, 24], r) * 2,
    confidence: 'sourced',
  }],

  // Sheer and Sharp DMG
  '14105': (r) => [sheerEffect('krakens-cradle', 'Kraken\'s Cradle', 'Ice', at([6, 7, 8, 9, 10], r), 3)],
  '14147': (r) => [sheerEffect('wrathful-vajra', 'Wrathful Vajra', 'Fire', at([9, 10.35, 11.7, 13.05, 14.4], r), 2)],
  '14153': (r) => [sheerEffect('starlight-rider-faceplate', 'Starlight Rider Faceplate', 'Physical', at([10, 11.5, 13, 14.5, 16], r), 2)],
  '14161': (r) => [{
    id: 'crimson-thirst-sharp',
    label: `Crimson Thirst: Electric Sharp DMG +${at([10, 11.5, 13, 14.5, 16], r)}% after an EX Special`,
    specialty: 'Armorer',
    element: 'Electric',
    toggle: { kind: 'switch', label: 'After an EX Special' },
    sharpDmg: () => at([10, 11.5, 13, 14.5, 16], r),
    confidence: 'sourced',
  }],
}

function kindEffect(
  id: string,
  name: string,
  specialty: string,
  kinds: (keyof KindBonus)[],
  value: number,
  what: string,
  extra: Partial<ZzzCombatEffect> = {},
): ZzzCombatEffect {
  return {
    id,
    label: `${name}: ${what} DMG +${value}%`,
    specialty,
    kinds: () => Object.fromEntries(kinds.map((kind) => [kind, value])),
    ...extra,
    confidence: 'sourced',
  }
}

function ignoreEffect(id: string, name: string, specialty: string, kind: 'res' | 'def', value: number, extra: Partial<ZzzCombatEffect> = {}): ZzzCombatEffect {
  const what = kind === 'res' ? `${extra.element ? `${extra.element} ` : ''}RES` : `${extra.element ? `${extra.element} agents: ` : ''}DEF`
  return {
    id,
    label: `${name}: ignores ${value}% of the enemy's ${what}`,
    specialty,
    ...(kind === 'res' ? { resIgnore: () => value } : { defIgnore: () => value }),
    ...extra,
    confidence: 'sourced',
  }
}

function sheerEffect(id: string, name: string, element: string, perStack: number, stacks: number): ZzzCombatEffect {
  return {
    id,
    label: `${name}: ${element} Sheer DMG +${perStack}% per stack`,
    specialty: 'Rupture',
    element,
    toggle: { kind: 'stacks', label: 'Stacks', max: stacks },
    sheerDmg: ({ setting }) => perStack * Number(setting),
    confidence: 'sourced',
  }
}
