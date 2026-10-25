import {
  CHARACTER_BASES,
  characterName,
  DATA_PROVENANCE,
  ECHO_DEFINITIONS,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import datamine from 'lib/games/wuwa/data/generated/datamine.json'
import { validateEcho } from 'lib/games/wuwa/echoRules'
import {
  type Echo,
  STAT_LABELS,
} from 'lib/games/wuwa/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('WuWa datamine data', () => {
  it('says where it came from', () => {
    expect(DATA_PROVENANCE.source).toContain('Arikatsu/WutheringWaves_Data')
    expect(DATA_PROVENANCE.included).toEqual(['bases.baseByLevel', 'weapons', 'echoes', 'sets'])
  })

  it('holds only datamine tables, nothing from guide sites', () => {
    expect(Object.keys(datamine).sort()).toEqual(['bases', 'echoes', 'provenance', 'sets', 'weapons'])
    for (const base of Object.values(CHARACTER_BASES)) expect(Object.keys(base).sort()).toEqual(['baseByLevel', 'id'])
  })

  it('has base stats for levels 1 to 90', () => {
    for (const base of Object.values(CHARACTER_BASES)) {
      expect(Object.keys(base.baseByLevel)).toHaveLength(90)
      expect(base.baseByLevel['90'].hp).toBeGreaterThan(base.baseByLevel['1'].hp)
    }
  })

  it('keys every table by its own id', () => {
    for (const table of [CHARACTER_BASES, WEAPONS, ECHO_DEFINITIONS, SONATA_SETS]) {
      for (const [key, entry] of Object.entries(table)) expect(entry.id).toBe(key)
    }
  })

  it('only uses known stats', () => {
    for (const weapon of Object.values(WEAPONS)) expect(STAT_LABELS[weapon.secondary.stat], weapon.id).toBeDefined()
    for (const set of Object.values(SONATA_SETS)) {
      for (const bonus of set.bonuses) {
        for (const stat of Object.keys(bonus.stats)) expect(STAT_LABELS[stat as keyof typeof STAT_LABELS], `${set.id} ${stat}`).toBeDefined()
      }
    }
  })

  it('gives every echo a real cost and sets that exist', () => {
    for (const echo of Object.values(ECHO_DEFINITIONS)) {
      expect([1, 3, 4]).toContain(echo.cost)
      expect(echo.setIds.length, echo.id).toBeGreaterThan(0)
      for (const setId of echo.setIds) expect(SONATA_SETS[setId], `${echo.id} -> ${setId}`).toBeDefined()
    }
  })

  it('works with the echo rules', () => {
    const echo = Object.values(ECHO_DEFINITIONS).find((e) => e.cost === 4)!
    const legal: Echo = { id: 'x', defId: echo.id, cost: echo.cost, setId: echo.setIds[0], mainStat: 'critRate', level: 0, substats: [] }
    expect(validateEcho(legal, echo)).toEqual([])
  })

  it('derives readable names from ids', () => {
    expect(characterName('rover-havoc')).toBe('Rover Havoc')
  })
})
