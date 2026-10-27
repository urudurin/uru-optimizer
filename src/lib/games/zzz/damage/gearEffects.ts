import type { ZzzCombatEffect } from 'lib/games/zzz/damage/combatEffects'
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
}
