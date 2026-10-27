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
