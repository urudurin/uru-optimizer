import {
  type CombatSetup,
  resolveCombat,
  setCountsOf,
} from 'lib/games/genshin/damage/combatEffects'
import {
  characterHits,
  DEFAULT_ENEMY,
  NO_DEBUFFS,
  rotationDamage,
} from 'lib/games/genshin/damage/damage'
import {
  computeGenshinStats,
  prepareCharacter,
} from 'lib/games/genshin/stats/computeStats'
import type {
  Artifact,
  ArtifactSlot,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const character = (id: string, parts: Partial<GenshinCharacter> = {}): GenshinCharacter => ({
  id,
  name: id,
  level: 90,
  ascension: 6,
  constellation: 0,
  talents: { auto: 9, skill: 9, burst: 9 },
  artifactIds: {},
  stats: {},
  statsDate: '',
  ...parts,
})

const SLOTS: ArtifactSlot[] = ['flower', 'plume', 'sands', 'goblet', 'circlet']
// Five artifacts, the first `count` of setId, with no stats so only set effects show
function wearing(setId: string, count: number): Artifact[] {
  return SLOTS.map((slot, i) => ({
    id: `${slot}-${i}`,
    slot,
    setId: i < count ? setId : 'Other',
    setName: setId,
    rarity: 5,
    level: 20,
    main: { stat: 'hp', value: 0 },
    substats: [],
  }))
}

const none: CombatSetup = { sets: [], settings: {} }

describe('combat effects', () => {
  it('works out Hu Tao\'s ATK from her HP in combat, capped at 400% of base ATK, and leaves the stat screen alone', () => {
    const hutao = character('HuTao', { element: 'Pyro' })
    const screen = computeGenshinStats(hutao, []).stats
    const combat = computeGenshinStats(hutao, [], {}, undefined, none).stats
    const baseAtk = prepareCharacter(hutao)!.baseAtk
    expect(combat.atk! - screen.atk!).toBeCloseTo(Math.min(screen.hp! * 0.05957, baseAtk * 4), 6)
    expect(combat.pyroDmg! - (screen.pyroDmg ?? 0)).toBe(33)
    // Turned off
    const off = computeGenshinStats(hutao, [], {}, undefined, { sets: [], settings: { 'hutao-skill-atk': false } }).stats
    expect(off.atk).toBeCloseTo(screen.atk!, 6)
  })

  it('counts 4-piece effects only for picked sets worn 4 times, and combat-only 2-pieces', () => {
    const raiden = character('RaidenShogun', { element: 'Electro' })
    const emblem: CombatSetup = { sets: ['EmblemOfSeveredFate'], settings: {} }
    const four = computeGenshinStats(raiden, wearing('EmblemOfSeveredFate', 4), {}, undefined, emblem).stats
    expect(four.burstDmg).toBeCloseTo(Math.min(75, four.energyRecharge! * 0.25), 6)
    expect(computeGenshinStats(raiden, wearing('EmblemOfSeveredFate', 3), {}, undefined, emblem).stats.burstDmg ?? 0).toBe(0)
    expect(computeGenshinStats(raiden, wearing('EmblemOfSeveredFate', 4), {}, undefined, none).stats.burstDmg ?? 0).toBe(0)
    // Noblesse Oblige's 2-piece Burst DMG only in combat
    expect(computeGenshinStats(raiden, wearing('NoblesseOblige', 2), {}, undefined, none).stats.burstDmg).toBe(20)
    expect(computeGenshinStats(raiden, wearing('NoblesseOblige', 2)).stats.burstDmg ?? 0).toBe(0)
  })

  it('collects reaction bonuses and debuffs, with stack counts', () => {
    const crimson: CombatSetup = { sets: ['CrimsonWitchOfFlames'], settings: { 'crimson-witch-stacks': 1 } }
    const resolved = resolveCombat(character('Xiangling', { element: 'Pyro' }), crimson, setCountsOf(Array(4).fill('CrimsonWitchOfFlames')))
    expect(resolved.premod.pyroDmg).toBe(7.5)
    expect(resolved.reactions).toEqual({ vaporize: 15, melt: 15, overloaded: 40, burning: 40, burgeon: 40 })
    const deepwood = resolveCombat(
      character('Nahida', { element: 'Dendro' }),
      { sets: ['DeepwoodMemories'], settings: {} },
      setCountsOf(Array(4).fill('DeepwoodMemories')),
    )
    expect(deepwood.debuffs.resShred).toEqual({ Dendro: 30 })
  })

  it('gives each hit its own kind\'s DMG Bonus and adds reaction bonuses inside the reaction', () => {
    const guoba = characterHits('Xiangling').find((hit) => hit.label === 'Flame DMG')!
    const stats = { atk: 2000, critRate: 50, critDmg: 100, elementalMastery: 100, pyroDmg: 40 }
    const setup = {
      characterId: 'Xiangling',
      characterLevel: 90,
      element: 'Pyro' as const,
      rotation: { counts: { [guoba.key]: 1 }, infusion: false, reaction: 'none' as const, reactionShare: 100 },
      talents: { auto: 9, skill: 9, burst: 9 },
      enemy: DEFAULT_ENEMY,
      debuffs: NO_DEBUFFS,
    }
    const plain = rotationDamage(stats, setup)
    // Skill DMG counts for a Skill hit, Burst DMG doesn't
    expect(rotationDamage({ ...stats, skillDmg: 20 }, setup) / plain).toBeCloseTo(1.6 / 1.4, 6)
    expect(rotationDamage({ ...stats, burstDmg: 20 }, setup)).toBeCloseTo(plain, 6)
    // Crimson Witch's +15% Vaporize goes inside the bracket
    const vape = { ...setup, rotation: { ...setup.rotation, reaction: 'vaporize' as const } }
    const em = 2.78 * 100 / 1500
    expect(rotationDamage(stats, { ...vape, reactionBonus: { vaporize: 15 } }) / plain).toBeCloseTo(1.5 * (1 + em + 0.15), 6)
  })
})
