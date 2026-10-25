import {
  CHARACTER_BASES,
  ECHO_DEFINITIONS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import {
  parseWuwaUserData,
  parseWuwaUserDataJson,
} from 'lib/games/wuwa/importer/userDataParser'
import type { Cost } from 'lib/games/wuwa/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

// A made-up save built from real game data ids, not anyone's account
const definitionOfCost = (cost: Cost) => Object.values(ECHO_DEFINITIONS).find((e) => e.cost === cost)!
const MAIN_BY_COST = { 4: 'critRate', 3: 'atkPct', 1: 'atkPct' } as const

function echo(id: string, cost: Cost) {
  const definition = definitionOfCost(cost)
  return {
    id,
    defId: definition.id,
    cost,
    setId: definition.setIds[0],
    mainStat: MAIN_BY_COST[cost],
    level: 25,
    substats: [{ stat: 'critRate', value: 8.1 }, { stat: 'critDmg', value: 16.2 }],
  }
}

const characterId = Object.keys(CHARACTER_BASES)[0]
const weaponId = Object.keys(WEAPONS)[0]
const costs = [4, 3, 3, 1, 1] as const
const echoes = Object.fromEntries(costs.map((cost, i) => [`e${i}`, echo(`e${i}`, cost)]))

function save(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    echoes,
    characters: {
      [characterId]: {
        charId: characterId,
        level: 90,
        sequence: 2,
        weaponId,
        weaponLevel: 90,
        refinement: 1,
        minorFortes: true,
        echoIds: ['e0', 'e1', 'e2', 'e3', 'e4'],
      },
    },
    teams: [],
    overrides: {},
    ...overrides,
  }
}

describe('parseWuwaUserData', () => {
  it('reads echoes and characters from a version 1 save', () => {
    const result = parseWuwaUserData(save())

    expect(result.warnings).toEqual([])
    expect(result.echoes).toHaveLength(5)
    expect(result.echoes[0]).toEqual(echoes.e0)
    expect(result.characters).toEqual([{
      charId: characterId,
      level: 90,
      sequence: 2,
      weaponId,
      weaponLevel: 90,
      refinement: 1,
      minorFortes: true,
      echoIds: ['e0', 'e1', 'e2', 'e3', 'e4'],
    }])
  })

  it('skips echoes that break a game rule and empties the slots that held them', () => {
    const bad = { ...echoes.e1, mainStat: 'critRate' }
    const result = parseWuwaUserData(save({ echoes: { ...echoes, e1: bad } }))

    expect(result.echoes.map((e) => e.id)).toEqual(['e0', 'e2', 'e3', 'e4'])
    expect(result.characters[0].echoIds).toEqual(['e0', null, 'e2', 'e3', 'e4'])
    expect(result.warnings).toEqual([
      `Echo e1 (${echoes.e1.defId}): Crit Rate can't be the main stat of a 3-cost echo, skipped`,
      `Character ${characterId}: equipped echo e1 wasn't imported, its slot is left empty`,
    ])
  })

  it('reports impossible rolls and unreadable entries', () => {
    const result = parseWuwaUserData(save({
      echoes: { ...echoes, x1: { ...echoes.e0, id: 'x1', substats: [{ stat: 'critRate', value: 9 }] }, x2: 'junk', x3: { id: 'x3' } },
    }))

    expect(result.echoes).toHaveLength(5)
    expect(result.warnings).toEqual([
      `Echo x1 (${echoes.e0.defId}): 9 isn't a possible Crit Rate roll, skipped`,
      'Echo x2: not an object, skipped',
      'Echo x3: missing or invalid echo, cost, set, main stat or level, skipped',
    ])
  })

  it('keeps echoes and characters the game data does not know yet, with a warning', () => {
    const newEcho = { ...echoes.e3, id: 'n1', defId: 'brand-new-echo' }
    const result = parseWuwaUserData(save({
      echoes: { ...echoes, n1: newEcho },
      characters: { someone: { charId: 'someone-new', weaponId: 'new-blade', echoIds: [] } },
    }))

    expect(result.echoes.map((e) => e.id)).toContain('n1')
    expect(result.characters[0]).toEqual({
      charId: 'someone-new',
      level: 90,
      sequence: 0,
      weaponId: 'new-blade',
      weaponLevel: 90,
      refinement: 1,
      minorFortes: true,
      echoIds: [null, null, null, null, null],
    })
    expect(result.warnings).toEqual([
      'Echo n1: "brand-new-echo" isn\'t in the game data yet, its cost and set aren\'t checked',
      'Character someone-new: not in the game data yet, stats won\'t be available',
      'Character someone-new: weapon "new-blade" isn\'t in the game data yet',
    ])
  })

  it('flags loadouts over the cost limit', () => {
    const fours = Object.fromEntries([0, 1, 2, 3].map((i) => [`f${i}`, echo(`f${i}`, 4)]))
    const result = parseWuwaUserData(save({
      echoes: fours,
      characters: { [characterId]: { charId: characterId, echoIds: ['f0', 'f1', 'f2', 'f3'] } },
    }))

    expect(result.warnings).toEqual([`Character ${characterId}: Total echo cost is 16, the limit is 12`])
  })

  it('keeps teams and priority, and says what it leaves out', () => {
    const result = parseWuwaUserData(save({
      teams: [{ id: 't1', name: 'Main', members: ['a', 'b', 'c'] }, { id: 't2', members: ['a'] }],
      priority: [characterId, 7],
      overrides: { [characterId]: { substatWeights: {} } },
      savedBuilds: { [characterId]: [] },
    }))

    expect(result.teams).toEqual([{ id: 't1', name: 'Main', members: ['a', 'b', 'c'] }])
    expect(result.priority).toEqual([characterId])
    expect(result.warnings).toEqual([
      'A saved team is unreadable, skipped',
      'Score overrides aren\'t supported yet, left out',
      'Saved builds aren\'t supported yet, left out',
    ])
  })

  it('rejects files that are not version 1 saves without throwing', () => {
    expect(parseWuwaUserDataJson('nope').warnings).toEqual(['The file isn\'t valid JSON'])
    expect(parseWuwaUserData([]).warnings).toEqual(['Expected a WuwaEchoScorer user-data file (an object)'])
    expect(parseWuwaUserData({ version: 2 }).warnings).toEqual(['Expected "version": 1, found 2'])
  })
})
