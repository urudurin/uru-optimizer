import {
  characterHits,
  defaultRotation,
  rotationDamage,
} from 'lib/games/genshin/damage/damage'
import {
  genshinDamageDefaults,
  genshinDamageSetup,
} from 'lib/games/genshin/optimizer/damageSetup'
import { computeGenshinStats } from 'lib/games/genshin/stats/computeStats'
import type {
  Artifact,
  GenshinCharacter,
  GenshinStatKey,
} from 'lib/games/genshin/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

// The user's Mizuki (Nov 7 2026 screenshot): C2, Sacrificial Fragments R5, 4pc Scarlet Proof, EM 785 on the screen
const art = (slot: Artifact['slot'], setId: string, main: [GenshinStatKey, number], subs: [GenshinStatKey, number][]): Artifact => ({
  id: slot,
  slot,
  setId,
  setName: setId,
  rarity: 5,
  level: 20,
  main: { stat: main[0], value: main[1] },
  substats: subs.map(([stat, value]) => ({ stat, value, rolls: 1 })),
})
const artifacts = [
  art('flower', 'ScarletProof', ['hp', 4780], [['energyRecharge', 11], ['critRate', 10.1], ['critDmg', 14.8], ['elementalMastery', 40]]),
  art('plume', 'ScarletProof', ['atk', 311], [['elementalMastery', 16], ['energyRecharge', 22], ['critRate', 6.6], ['critDmg', 7]]),
  art('sands', 'ScarletProof', ['elementalMastery', 187], [['def', 56], ['critRate', 6.6], ['hpPct', 4.7], ['energyRecharge', 11]]),
  art('goblet', 'EmblemOfSeveredFate', ['elementalMastery', 187], [['atk', 33], ['critDmg', 6.2], ['hpPct', 12.8], ['energyRecharge', 16.8]]),
  art('circlet', 'ScarletProof', ['critRate', 31.1], [['hpPct', 26.2], ['elementalMastery', 19], ['critDmg', 7], ['hp', 239]]),
]
const mizuki = (constellation: number): GenshinCharacter => ({
  id: 'YumemizukiMizuki',
  name: 'Mizuki',
  element: 'Anemo',
  level: 90,
  ascension: 6,
  constellation,
  talents: { auto: 9, skill: 9, burst: 9 },
  weapon: { id: 'SacrificialFragments', name: 'Sacrificial Fragments', rarity: 4, level: 90, ascension: 6, refinement: 5 },
  artifactIds: {},
  stats: {},
  statsDate: '',
})

const keyOf = (label: string) => characterHits('YumemizukiMizuki').find((hit) => hit.label === label)!.key

// One line of the rotation, with the kit's effects (A4 EM, Dreamdrifter, C1, C2 on)
function lineDamage(constellation: number, counts: Record<string, number>, teamReactions: ('stellarswirl')[] = []) {
  const character = mizuki(constellation)
  const settings = { ...genshinDamageDefaults(character.id), rotation: { counts, infusion: false, reaction: 'none' as const, reactionShare: 100 } }
  const setup = genshinDamageSetup(character, settings, 'ScarletProof', { characters: [character], artifacts })
  const stats = computeGenshinStats(character, artifacts, {}, setup.teamBuffs, setup.combat).stats
  return { damage: rotationDamage(stats, { ...setup.damageSetup, teamReactions }), stats }
}

describe('Mizuki (KQM quick guide)', () => {
  it('has Witch\'s Revelation and C1 lines in her default rotation, Stellar Swirl ones with an enabler', () => {
    const plain = defaultRotation('YumemizukiMizuki', [], [], 2).counts
    expect(plain[keyOf('Witch\'s Revelation: boosted Dreamdrifter hit')]).toBe(4)
    expect(plain[keyOf('C1: extra attack')]).toBe(3)
    expect(plain[keyOf('Witch\'s Revelation: direct Stellar Swirl (Radiance)')]).toBeUndefined()
    const stellar = defaultRotation('YumemizukiMizuki', [], ['stellarswirl'], 2).counts
    expect(stellar[keyOf('Witch\'s Revelation: direct Stellar Swirl (Radiance)')]).toBe(4)
    expect(stellar[keyOf('C1: extra attack, direct Stellar Swirl (Radiance)')]).toBe(3)
    expect(stellar[keyOf('Witch\'s Revelation: boosted Dreamdrifter hit')]).toBeUndefined()
    // No C1 lines before C1
    expect(defaultRotation('YumemizukiMizuki', [], [], 0).counts[keyOf('C1: extra attack')]).toBeUndefined()
  })

  it('deals 1,000% EM on the boosted hit, with CRIT, DEF and her C2 Anemo RES shred', () => {
    const { damage, stats } = lineDamage(2, { [keyOf('Witch\'s Revelation: boosted Dreamdrifter hit')]: 1 })
    const em = stats.elementalMastery!
    expect(em).toBeCloseTo(884.71, 1)
    const crit = 1 + (stats.critRate! / 100) * (stats.critDmg! / 100)
    // DEF: level 90 against level 100; RES 10% - 20% = -10% -> 1.05
    expect(damage).toBeCloseTo(10 * em * crit * (190 / 390) * 1.05, 0)
  })

  it('deals the Radiance hit as direct Stellar Swirl: EM bracket, Dreamdrifter per EM, CRIT and RES, no DEF', () => {
    const { damage, stats } = lineDamage(2, { [keyOf('Witch\'s Revelation: direct Stellar Swirl (Radiance)')]: 1 }, ['stellarswirl'])
    const em = stats.elementalMastery!
    const crit = 1 + (stats.critRate! / 100) * (stats.critDmg! / 100)
    // Dreamdrifter: Stellar Swirl +0.042% per EM at Skill level 9
    expect(damage).toBeCloseTo(10 * em * (1 + (6 * em) / (em + 2000) + 0.00042 * em) * crit * 1.05, 0)
  })

  it('adds C1\'s 1,100% EM to at most 3 Swirls', () => {
    const swirl = 'reaction:swirl:Hydro'
    const withC1 = lineDamage(1, { [swirl]: 4 })
    const withoutC1 = lineDamage(0, { [swirl]: 4 })
    const em = withC1.stats.elementalMastery!
    // Same EM either way (C1 and C2 don't change stats); the gap is 3 x 1,100% EM through Swirl's multiplier, RES 10%
    expect(withoutC1.stats.elementalMastery).toBeCloseTo(em, 6)
    expect(withC1.damage - withoutC1.damage).toBeCloseTo(3 * 11 * em * 0.9 * (1 + (16 * em) / (em + 2000) + 0.0042 * em), 0)
  })
})
