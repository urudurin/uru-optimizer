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

describe('hit-specific and weapon combat effects', () => {
  const stats = { atk: 2000, hp: 30000, critRate: 50, critDmg: 100, elementalMastery: 600, dendroDmg: 0, hydroDmg: 0, electroDmg: 0 }
  // One line of a character's rotation through the damage formula, with their resolved combat effects
  function lineDamage(who: GenshinCharacter, label: string, combat: CombatSetup = { sets: [], settings: {} }, talent?: string) {
    const hit = characterHits(who.id).find((h) => h.label === label && (!talent || h.talent === talent))!
    const resolved = resolveCombat(who, combat, new Map())
    return rotationDamage(stats, {
      characterId: who.id,
      characterLevel: 90,
      element: who.element,
      rotation: { counts: { [hit.key]: 1 }, infusion: false, reaction: 'none', reactionShare: 100 },
      talents: { auto: 9, skill: 9, burst: 9 },
      enemy: DEFAULT_ENEMY,
      debuffs: NO_DEBUFFS,
      hitBuffs: resolved.hitBuffs,
    })
  }

  it('gives Nahida\'s Tri-Karma Purification DMG and CRIT Rate from Elemental Mastery above 200, and nothing else', () => {
    const nahida = character('Nahida', { element: 'Dendro' })
    const off = { sets: [], settings: {} }
    const young = character('Nahida', { element: 'Dendro', ascension: 3 })
    // 400 EM over 200: +40% DMG, +12% CRIT Rate
    expect(lineDamage(nahida, 'Tri-Karma Purification DMG', off) / lineDamage(young, 'Tri-Karma Purification DMG', off)).toBeCloseTo(1.4 * (1 + 0.62) / 1.5, 6)
    expect(lineDamage(nahida, 'Press DMG', off)).toBeCloseTo(lineDamage(young, 'Press DMG', off), 6)
  })

  it('scales Neuvillette\'s Equitable Judgment by his Draconic Glories', () => {
    const neuvillette = character('Neuvillette', { element: 'Hydro' })
    const judgment = 'Charged Attack: Equitable Judgment'
    const none = lineDamage(neuvillette, judgment, { sets: [], settings: { 'neuvillette-a1': 0 } })
    expect(lineDamage(neuvillette, judgment) / none).toBeCloseTo(1.6, 6)
    expect(lineDamage(neuvillette, judgment, { sets: [], settings: { 'neuvillette-a1': 2 } }) / none).toBeCloseTo(1.25, 6)
  })

  it('adds Raiden\'s Resolve as ATK to the initial slash and Musou Isshin hits', () => {
    const raiden = character('RaidenShogun', { element: 'Electro' })
    const slash = characterHits('RaidenShogun').find((h) => h.label === 'Musou no Hitotachi Base DMG')!
    const base = slash.terms[0][1][8]
    const none = lineDamage(raiden, slash.label, { sets: [], settings: { 'raiden-resolve': 0 } })
    // Burst level 9 at C0: 6.6096% ATK per stack, 60 stacks
    expect(lineDamage(raiden, slash.label) / none).toBeCloseTo((base + 60 * 6.6096) / base, 6)
    const isshin = characterHits('RaidenShogun').find((h) => h.talent === 'burst' && h.label === '1-Hit DMG')!
    const isshinNone = lineDamage(raiden, isshin.label, { sets: [], settings: { 'raiden-resolve': 0 } }, 'burst')
    expect(lineDamage(raiden, isshin.label, undefined, 'burst') / isshinNone).toBeCloseTo((isshin.terms[0][1][8] + 60 * 1.2345) / isshin.terms[0][1][8], 6)
  })

  it('works out weapon effects by refinement, including Burst-only CRIT Rate', () => {
    const weapon = (id: string, refinement: number) => ({ id, name: id, rarity: 5, level: 90, refinement })
    const mist = resolveCombat(character('KamisatoAyaka', { element: 'Cryo', weapon: weapon('MistsplitterReforged', 1) }), {
      sets: [],
      settings: { 'ayaka-a4': false },
    }, new Map())
    expect(mist.premod.cryoDmg).toBe(28)
    const mist5 = resolveCombat(character('KamisatoAyaka', { element: 'Cryo', weapon: weapon('MistsplitterReforged', 5) }), {
      sets: [],
      settings: { 'ayaka-a4': false },
    }, new Map())
    expect(mist5.premod.cryoDmg).toBe(56)
    const raiden = character('RaidenShogun', { element: 'Electro', weapon: weapon('TheCatch', 5) })
    const caught = resolveCombat(raiden, { sets: [], settings: { 'raiden-resolve': 0 } }, new Map())
    expect(caught.premod.burstDmg).toBe(32)
    expect(caught.hitBuffs).toContainEqual({ categories: ['burst'], critRate: 12 })
  })
})
