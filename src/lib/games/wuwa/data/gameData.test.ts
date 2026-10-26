import {
  CHARACTER_BASES,
  characterName,
  CHARACTERS,
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
    expect(DATA_PROVENANCE.included).toEqual([
      'bases.baseByLevel',
      'weapons',
      'echoes',
      'sets',
      'characters (element, minorFortes)',
      'weapons.passiveStats',
    ])
    expect(DATA_PROVENANCE.weaponPassives).toContain('weaponconf.json')
    expect(DATA_PROVENANCE.characters).toContain('extractCharacters.mjs')
  })

  it('holds only datamine tables, nothing from guide sites', () => {
    expect(Object.keys(datamine).sort()).toEqual(['bases', 'characters', 'echoes', 'provenance', 'sets', 'weapons'])
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

  it('gives every character an element and known minor forte stats', () => {
    expect(Object.keys(CHARACTERS).sort()).toEqual(Object.keys(CHARACTER_BASES).sort())
    for (const character of Object.values(CHARACTERS)) {
      expect(character.element, character.id).not.toBeNull()
      expect(Object.keys(character.minorFortes).length, character.id).toBeGreaterThan(0)
      for (const stat of Object.keys(character.minorFortes)) expect(STAT_LABELS[stat as keyof typeof STAT_LABELS], `${character.id} ${stat}`).toBeDefined()
    }
  })

  it('has always-on weapon passives with five refinements and known stats', () => {
    const withPassive = Object.values(WEAPONS).filter((weapon) => weapon.passiveStats)
    expect(withPassive.length).toBeGreaterThan(0)
    for (const weapon of withPassive) {
      expect(Object.keys(weapon.passiveStats!), weapon.id).toEqual(['1', '2', '3', '4', '5'])
      for (const stat of Object.keys(weapon.passiveStats!['1'])) expect(STAT_LABELS[stat as keyof typeof STAT_LABELS], `${weapon.id} ${stat}`).toBeDefined()
    }
    // Suoming's stat screen confirms this one
    expect(WEAPONS['unspoken-rue'].passiveStats!['1']).toEqual({ atkPct: 12 })
    // A passive that only triggers on skill use isn't counted
    expect(WEAPONS.variation.passiveStats).toBeUndefined()
  })

  it('has the minor fortes the stat screen confirms for Hsin', () => {
    expect(CHARACTERS.hsin).toEqual({ id: 'hsin', name: 'Hsin', element: 'electroDmg', minorFortes: { critRate: 8, atkPct: 12 } })
  })

  it('uses the in-game name, or one derived from the id', () => {
    expect(characterName('the-shorekeeper')).toBe('Shorekeeper')
    expect(characterName('rover-havoc')).toBe('Rover: Havoc')
    expect(characterName('someone-brand-new')).toBe('Someone Brand New')
  })
})
