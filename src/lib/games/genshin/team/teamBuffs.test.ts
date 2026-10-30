import {
  computeGenshinStats,
  prepareCharacter,
} from 'lib/games/genshin/stats/computeStats'
import {
  teamBuffsFor,
  type TeamSetup,
} from 'lib/games/genshin/team/teamBuffs'
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

const xiangling = character('Xiangling', { element: 'Pyro' })
const bennett = character('Bennett', { element: 'Pyro' })
const kazuha = character('KaedeharaKazuha', { element: 'Anemo' })
const furina = character('Furina', { element: 'Hydro', talents: { auto: 1, skill: 10, burst: 10 } })
const sucrose = character('Sucrose', { element: 'Anemo' })

// Four Noblesse Oblige pieces, worn by whoever's id is given
function noblesse(owner: string): Artifact[] {
  return (['flower', 'plume', 'sands', 'goblet'] as ArtifactSlot[]).map((slot) => ({
    id: `${owner}-${slot}`,
    slot,
    setId: 'NoblesseOblige',
    setName: 'Noblesse Oblige',
    rarity: 5,
    level: 20,
    main: { stat: 'hp', value: 0 },
    substats: [],
    equippedBy: owner,
  }))
}
const wearing = (c: GenshinCharacter): GenshinCharacter => ({ ...c, artifactIds: Object.fromEntries(noblesse(c.id).map((a) => [a.slot, a.id])) })

const setup = (teammates: string[], parts: Partial<TeamSetup> = {}): TeamSetup => ({ teammates, onField: true, settings: {}, ...parts })

describe('team buffs', () => {
  it('Bennett\'s Burst gives the on-field character ATK from his base ATK, by Burst level', () => {
    const result = teamBuffsFor(xiangling, setup(['Bennett']), { characters: [xiangling, bennett], artifacts: [] })
    const baseAtk = prepareCharacter(bennett)!.baseAtk

    expect(result.total.atk).toBeCloseTo(baseAtk * 0.952)
    expect(teamBuffsFor(xiangling, setup(['Bennett'], { onField: false }), { characters: [xiangling, bennett], artifacts: [] }).total.atk).toBeUndefined()
    const c5 = { ...bennett, constellation: 5 }
    expect(teamBuffsFor(xiangling, setup(['Bennett']), { characters: [xiangling, c5], artifacts: [] }).total.atk).toBeCloseTo(baseAtk * (1.12 + 0.2))
  })

  it('Kazuha gives DMG Bonus for the swirled element from his Elemental Mastery, defaulting to the receiver\'s element', () => {
    const result = teamBuffsFor(xiangling, setup(['KaedeharaKazuha']), { characters: [xiangling, kazuha], artifacts: [] })
    const kazuhaEm = computeGenshinStats(kazuha, []).stats.elementalMastery!

    expect(result.premod.pyroDmg).toBeCloseTo(kazuhaEm * 0.04)
    const cryo = teamBuffsFor(xiangling, setup(['KaedeharaKazuha'], { settings: { 'KaedeharaKazuha:kazuha-a4': 'Cryo' } }), {
      characters: [xiangling, kazuha],
      artifacts: [],
    })
    expect(cryo.premod).toEqual({ cryoDmg: expect.closeTo(kazuhaEm * 0.04) })
    expect(result.applied.find((a) => a.buff.id === 'kazuha-c2')?.reason).toBe('Needs KaedeharaKazuha at C2')
  })

  it('Furina\'s Fanfare gives DMG Bonus per point, all 300 by default', () => {
    const result = teamBuffsFor(xiangling, setup(['Furina']), { characters: [xiangling, furina], artifacts: [] })
    expect(result.premod.allDmg).toBeCloseTo(300 * 0.25)
    const half = teamBuffsFor(xiangling, setup(['Furina'], { settings: { 'Furina:furina-fanfare': 150 } }), { characters: [xiangling, furina], artifacts: [] })
    expect(half.premod.allDmg).toBeCloseTo(150 * 0.25)
  })

  it('counts buffs that don\'t stack once, and skips ones turned off or for another element', () => {
    const team = [wearing(bennett), wearing(kazuha)]
    const artifacts = [...noblesse('Bennett'), ...noblesse('KaedeharaKazuha')]
    const result = teamBuffsFor(xiangling, setup(['Bennett', 'KaedeharaKazuha']), { characters: [xiangling, ...team], artifacts })
    const noblesses = result.applied.filter((a) => a.buff.id === 'noblesse-4pc')

    expect(result.premod.atkPct).toBe(20)
    expect(noblesses.map((a) => a.counted)).toEqual([true, false])
    expect(noblesses[1].reason).toBe('Doesn\'t stack with Bennett\'s 4-piece set')

    const off = teamBuffsFor(xiangling, setup(['Bennett'], { settings: { 'Bennett:bennett-burst-atk': false } }), {
      characters: [xiangling, bennett],
      artifacts: [],
    })
    expect(off.applied[0]).toMatchObject({ counted: false, reason: 'Turned off' })

    const sucroseForCryo = teamBuffsFor(xiangling, setup(['Sucrose'], { settings: { 'Sucrose:sucrose-a1': 'Cryo' } }), {
      characters: [xiangling, sucrose],
      artifacts: [],
    })
    expect(sucroseForCryo.applied.find((a) => a.buff.id === 'sucrose-a1')?.reason).toBe('Only for Cryo members')
  })

  it('counts enemy shred apart from stats: Viridescent Venerer, Zhongli and Lisa', () => {
    const vvWorn = noblesse('Sucrose').map((a) => ({ ...a, id: `vv-${a.slot}`, setId: 'ViridescentVenerer' }))
    const vvSucrose = { ...sucrose, artifactIds: Object.fromEntries(vvWorn.map((a) => [a.slot, a.id])) }
    const zhongli = character('Zhongli', { element: 'Geo' })
    const lisa = character('Lisa', { element: 'Electro' })
    const result = teamBuffsFor(xiangling, setup(['Sucrose', 'Zhongli', 'Lisa']), { characters: [xiangling, vvSucrose, zhongli, lisa], artifacts: vvWorn })

    expect(result.debuffs).toEqual({ defShred: 15, resShred: { Pyro: 40, all: 20 } })
    // Shred never shows up as a stat
    expect(Object.keys({ ...result.premod, ...result.total }).some((stat) => stat.includes('Shred'))).toBe(false)
  })

  it('gives the party Silken Moon\'s Serenade\'s Elemental Mastery and Lunar Reaction DMG, and Night of the Sky\'s once with it', () => {
    const flins = character('Flins', { element: 'Electro' })
    const wearing4 = (owner: string, setId: string): Artifact[] =>
      noblesse(owner).map((a) => ({ ...a, id: `${owner}-${setId}-${a.slot}`, setId, setName: setId }))
    const silken = wearing4('Furina', 'SilkenMoonsSerenade')
    const night = wearing4('Bennett', 'NightOfTheSkysUnveiling')
    const dressed = (c: GenshinCharacter, pieces: Artifact[]) => ({ ...c, artifactIds: Object.fromEntries(pieces.map((a) => [a.slot, a.id])) })
    const team = [flins, dressed(furina, silken), dressed(bennett, night)]
    const result = teamBuffsFor(flins, setup(['Furina', 'Bennett']), { characters: team, artifacts: [...silken, ...night] })
    expect(result.premod.elementalMastery).toBe(120)
    // Both sets give +10% per Gleaming Moon effect; it doesn't stack, so 20% once
    expect(result.lunarBonus).toBe(20)
  })

  it('works out Moonsign from the Lunar characters in the party, and gives Ascendant Gleam from non-Moonsign teammates, at most 36%, once', () => {
    const flins = character('Flins', { element: 'Electro' })
    const ineffa = character('Ineffa', { element: 'Electro' })
    // One Lunar character: Nascent Gleam, no Ascendant Gleam buff
    const nascent = teamBuffsFor(flins, setup(['Furina', 'Bennett']), { characters: [flins, furina, bennett], artifacts: [] })
    expect(nascent.moonsign).toBe(1)
    expect(nascent.applied.some((a) => a.buff.id === 'moonsign-ascendant-gleam')).toBe(false)

    // Two: Ascendant Gleam from Furina and Bennett (not Ineffa, who is Moonsign), on by default
    const team = [flins, ineffa, furina, bennett]
    const result = teamBuffsFor(flins, setup(['Ineffa', 'Furina', 'Bennett']), { characters: team, artifacts: [] })
    expect(result.moonsign).toBe(2)
    expect(result.applied.filter((a) => a.buff.id === 'moonsign-ascendant-gleam').map((a) => a.giver?.id)).toEqual(['Furina', 'Bennett'])
    const furinaHp = computeGenshinStats(furina, []).stats.hp!
    const bennettAtk = computeGenshinStats(bennett, []).stats.atk!
    // Hydro: 0.6% per 1,000 HP; Pyro: 0.9% per 100 ATK. Only the bigger one counts
    expect(result.lunarBonus).toBeCloseTo(Math.min(36, Math.max(furinaHp * 0.0006, bennettAtk * 0.009)), 6)
    // Not a stat
    expect(Object.keys({ ...result.premod, ...result.total })).not.toContain('lunarBonus')
    // Ineffa's Moonsign Benediction: Lunar-Charged Base DMG +0.7% per 100 of her ATK, up to 14%
    const ineffaAtk = computeGenshinStats(ineffa, []).stats.atk!
    expect(result.baseBonus.lunarcharged).toBeCloseTo(Math.min(14, ineffaAtk * 0.007), 6)
  })

  it('gives Lunar kit bonuses: flat damage per hit from the giver\'s stats, one kind\'s CRIT and DMG, and Columbina\'s Lunar DMG', () => {
    const flins = character('Flins', { element: 'Electro' })
    const lauma = character('Lauma', { element: 'Dendro' })
    const nahida = character('Nahida', { element: 'Dendro', constellation: 2 })
    const columbina = character('Columbina', { element: 'Hydro' })
    const team = [flins, lauma, nahida, columbina]
    const result = teamBuffsFor(flins, setup(['Lauma', 'Nahida', 'Columbina']), { characters: team, artifacts: [] })
    // Pale Hymn at burst level 9: 377.808% of Lauma's Elemental Mastery per Lunar-Bloom hit
    const laumaEm = computeGenshinStats(lauma, []).stats.elementalMastery ?? 0
    expect(result.specialFlat.lunarbloom).toBeCloseTo(3.77808 * laumaEm, 6)
    // Nahida C2 and Lauma A1 CRIT for Lunar-Bloom
    expect(result.specialCrit.lunarbloom).toEqual({ rate: 30, dmg: 50 })
    // Columbina's domain: Lunar Reaction DMG at burst level 9 (Ascendant Gleam adds its own on top)
    expect(result.applied.find((a) => a.buff.id === 'columbina-burst-lunar')).toMatchObject({ value: 37, counted: true })
    // Teammates' stats for Stellar Swirl contribution
    expect(result.members.map((m) => m.id)).toEqual(['Lauma', 'Nahida', 'Columbina'])
  })

  it('adds elemental resonance for a team of 4', () => {
    const team = [bennett, kazuha, furina]
    const result = teamBuffsFor(xiangling, setup(['Bennett', 'KaedeharaKazuha', 'Furina']), { characters: [xiangling, ...team], artifacts: [] })
    expect(result.resonance).toEqual(['Pyro'])
    expect(result.premod.atkPct).toBe(25)
    expect(teamBuffsFor(xiangling, setup(['Bennett']), { characters: [xiangling, bennett], artifacts: [] }).resonance).toEqual([])
  })

  it('the calculator adds premod buffs before HP/ATK/DEF % and total buffs to the final stat', () => {
    const bare = computeGenshinStats(xiangling, []).stats
    const buffed = computeGenshinStats(xiangling, [], {}, { premod: { atkPct: 20, pyroDmg: 15 }, total: { atk: 500 } }).stats
    const baseAtk = prepareCharacter(xiangling)!.baseAtk

    expect(buffed.atk).toBeCloseTo(bare.atk! + baseAtk * 0.2 + 500)
    expect(buffed.pyroDmg).toBeCloseTo((bare.pyroDmg ?? 0) + 15)
  })
})
