import {
  validateEcho,
  validateLoadout,
} from 'lib/games/wuwa/echoRules'
import type { Echo } from 'lib/games/wuwa/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

const ok: Echo = {
  id: 'e1',
  defId: 'crownless',
  cost: 4,
  setId: 'havocEclipse',
  mainStat: 'critRate',
  level: 25,
  substats: [
    { stat: 'critRate', value: 9.9 },
    { stat: 'critDmg', value: 19.8 },
    { stat: 'atkPct', value: 10.1 },
    { stat: 'energyRegen', value: 8.4 },
    { stat: 'atkFlat', value: 50 },
  ],
}
const definition = { cost: 4 as const, setIds: ['havocEclipse'] }

describe('validateEcho', () => {
  it('accepts a legal echo', () => {
    expect(validateEcho(ok, definition)).toEqual([])
  })

  it('rejects a main stat the cost cannot have', () => {
    expect(validateEcho({ ...ok, mainStat: 'energyRegen' }, definition)).toEqual(['Energy Regen can\'t be the main stat of a 4-cost echo'])
  })

  it('rejects more substats than the level unlocks', () => {
    expect(validateEcho({ ...ok, level: 10 }, definition)).toEqual(['A +10 echo has at most 2 substats'])
  })

  it('rejects levels outside 0 to 25', () => {
    expect(validateEcho({ ...ok, level: 26 }, definition)).toEqual(['Level must be a whole number from 0 to 25'])
  })

  it('rejects roll values that do not exist', () => {
    expect(validateEcho({ ...ok, substats: [{ stat: 'critRate', value: 9.0 }] }, definition)).toEqual(['9 isn\'t a possible Crit Rate roll'])
  })

  it('rejects a repeated substat', () => {
    const repeated: Echo = { ...ok, substats: [{ stat: 'critRate', value: 9.9 }, { stat: 'critRate', value: 6.3 }] }
    expect(validateEcho(repeated, definition)).toEqual(['Crit Rate appears more than once'])
  })

  it('rejects a set the echo cannot drop in and a mismatched cost', () => {
    expect(validateEcho({ ...ok, setId: 'otherSet' }, definition)).toEqual(['This echo can\'t drop in that sonata set'])
    expect(validateEcho({ ...ok, cost: 3, mainStat: 'atkPct' }, definition)).toEqual(['This echo is 4-cost, not 3-cost'])
  })
})

describe('validateLoadout', () => {
  it('accepts a 4-3-3-1-1 loadout', () => {
    const costs = [4, 3, 3, 1, 1] as const
    expect(validateLoadout(costs.map((cost, i) => ({ ...ok, id: `e${i}`, cost })))).toEqual([])
  })

  it('rejects a loadout over 12 cost', () => {
    const four = [ok, { ...ok, id: 'e2' }, { ...ok, id: 'e3' }, { ...ok, id: 'e4' }]
    expect(validateLoadout(four)).toEqual(['Total echo cost is 16, the limit is 12'])
  })

  it('rejects more than 5 echoes and the same echo twice', () => {
    const one: Echo = { ...ok, cost: 1, mainStat: 'atkPct' }
    const six = [1, 2, 3, 4, 5, 6].map((i) => ({ ...one, id: `e${i}` }))
    expect(validateLoadout(six)).toEqual(['A character can wear at most 5 echoes'])
    expect(validateLoadout([one, one])).toEqual(['The same echo is equipped more than once'])
  })
})
