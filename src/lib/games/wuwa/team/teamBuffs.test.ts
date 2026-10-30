import {
  computeWuwaStats,
  toDisplayStats,
} from 'lib/games/wuwa/stats/computeStats'
import { wuwaTeamBuffsFor } from 'lib/games/wuwa/team/teamBuffs'
import type { CharacterState } from 'lib/games/wuwa/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const resonator = (charId: string): CharacterState => ({
  charId,
  level: 90,
  sequence: 0,
  weaponLevel: 90,
  refinement: 1,
  minorFortes: true,
  echoIds: [null, null, null, null, null],
})

const hsin = resonator('hsin')
const data = { characters: [hsin, resonator('the-shorekeeper'), resonator('verina'), resonator('ciaccona')], echoes: [] }

describe('wuwaTeamBuffsFor', () => {
  it('gives Shorekeeper\'s Stellarealm Crit from her own Energy Regen', () => {
    const result = wuwaTeamBuffsFor(hsin, { teammates: ['the-shorekeeper'], settings: {} }, data)
    const energyRegen = toDisplayStats(computeWuwaStats(resonator('the-shorekeeper'), []).stats).energyRegen
    expect(result.bonus.critRate).toBeCloseTo(Math.min(12.5, energyRegen / 20), 6)
    expect(result.bonus.critDmg).toBeCloseTo(Math.min(25, energyRegen / 10), 6)
  })

  it('adds Verina\'s ATK, leaves element buffs out for other elements, and respects toggles', () => {
    const result = wuwaTeamBuffsFor(hsin, { teammates: ['verina', 'ciaccona'], settings: {} }, data)
    expect(result.bonus).toEqual({ atkPct: 20 })
    expect(result.applied.find((a) => a.buff.id === 'solo-concert')?.counted).toBe(false)

    const off = wuwaTeamBuffsFor(hsin, { teammates: ['verina'], settings: { 'verina:gift-of-nature': false } }, data)
    expect(off.bonus).toEqual({})
  })

  it('gives Outro DMG Amplified for every hit, an element or a kind of hit, and Fusion RES ignore', () => {
    const team = { characters: [...data.characters, resonator('sanhua'), resonator('yinlin'), resonator('changli'), resonator('lupa')], echoes: [] }
    // Verina amplifies everything, Sanhua Basic Attacks; Yinlin's Electro part counts for Hsin, Changli's Fusion part doesn't
    expect(wuwaTeamBuffsFor(hsin, { teammates: ['verina', 'sanhua'], settings: {} }, team).amplify).toEqual({ all: 15, basic: 38 })
    expect(wuwaTeamBuffsFor(hsin, { teammates: ['yinlin', 'changli'], settings: {} }, team).amplify).toEqual({ all: 20, liberation: 50 })
    // Verina's ATK still goes to the stat calculator
    expect(wuwaTeamBuffsFor(hsin, { teammates: ['verina'], settings: {} }, team).bonus).toEqual({ atkPct: 20 })
    // Lupa's Glory only for Fusion Resonators
    const changli = resonator('changli')
    expect(wuwaTeamBuffsFor(changli, { teammates: ['lupa'], settings: {} }, team).resShred).toBe(15)
    expect(wuwaTeamBuffsFor(hsin, { teammates: ['lupa'], settings: {} }, team).resShred).toBe(0)
  })

  it('a team bonus raises the calculated stats', () => {
    const alone = computeWuwaStats(hsin, []).stats
    const buffed = computeWuwaStats(hsin, [], { critRate: 12.5 }).stats
    expect(buffed.critRate - alone.critRate).toBeCloseTo(12.5, 6)
  })
})
