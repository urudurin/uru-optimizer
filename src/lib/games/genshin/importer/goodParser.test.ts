import { toGoodKey } from 'lib/games/genshin/goodKeys'
import {
  type EnkaGenshinStore,
  parseEnkaGenshin,
} from 'lib/games/genshin/importer/enkaParser'
import {
  isGoodFile,
  parseGood,
} from 'lib/games/genshin/importer/goodParser'
import {
  describe,
  expect,
  it,
} from 'vitest'

// The small part of Enka's store files a made-up GOOD file needs
const store: EnkaGenshinStore = {
  avatars: {
    '10000022': { Element: 'Wind', NameTextMapHash: 1 },
    '10000052': { Element: 'Electric', NameTextMapHash: 2 },
    '10000007-704': { Element: 'Electric', NameTextMapHash: 3 },
  },
  locs: { '1': 'Venti', '2': 'Raiden Shogun', '3': 'Lumine', '10': 'Viridescent Venerer', '11': 'Gladiator\'s Finale', '20': 'Fading Twilight' },
  sets: { '15002': { Name: '10' }, '15001': { Name: '11' } },
  affixes: {},
  relicLevels: { '5': { '1': { '2': 717, '6': 0.07 }, '21': { '2': 4780, '6': 0.466, '23': 0.518 } } },
  weapons: { '15411': { NameTextMapHash: 20, Rarity: 4 } },
}

const flower = {
  setKey: 'ViridescentVenerer',
  slotKey: 'flower',
  level: 20,
  rarity: 5,
  mainStatKey: 'hp',
  location: 'Venti',
  lock: true,
  substats: [
    { key: 'hp_', value: 14, initialValue: 4.7 },
    { key: 'critRate_', value: 6.6, initialValue: 3.1 },
    { key: 'eleMas', value: 37, initialValue: 19 },
    { key: 'enerRech_', value: 12.3, initialValue: 5.8 },
  ],
}

function good(parts: Record<string, unknown>) {
  return { format: 'GOOD', version: 3, source: 'Irminsul', characters: [], artifacts: [], weapons: [], ...parts }
}

describe('parseGood', () => {
  it('recognizes GOOD files', () => {
    expect(isGoodFile(good({}))).toBe(true)
    expect(isGoodFile({ playerInfo: {} })).toBe(false)
  })

  it('makes GOOD keys from English names', () => {
    expect(toGoodKey('Gladiator\'s Finale')).toBe('GladiatorsFinale')
    expect(toGoodKey('Nighttime Whispers in the Echoing Woods')).toBe('NighttimeWhispersInTheEchoingWoods')
    expect(toGoodKey('A Day Carved From Rising Winds')).toBe('ADayCarvedFromRisingWinds')
    expect(toGoodKey('Raiden Shogun')).toBe('RaidenShogun')
  })

  it('reads artifacts with the main stat value from the level table and estimated rolls', () => {
    const goblet = { ...flower, slotKey: 'goblet', mainStatKey: 'atk_', level: 0, location: '', substats: [{ key: 'critDMG_', value: 7.0 }] }
    const result = parseGood(good({ artifacts: [flower, goblet] }), store, '2026-10-26')

    expect(result.warnings).toEqual([])
    expect(result.source).toBe('Irminsul')
    expect(result.artifacts[0]).toMatchObject({
      slot: 'flower',
      setId: 'ViridescentVenerer',
      setName: 'Viridescent Venerer',
      rarity: 5,
      level: 20,
      main: { stat: 'hp', value: 4780 },
    })
    expect(result.artifacts[0].substats).toEqual([
      { stat: 'hpPct', value: 14, rolls: 3 },
      { stat: 'critRate', value: 6.6, rolls: 2 },
      { stat: 'elementalMastery', value: 37, rolls: 2 },
      { stat: 'energyRecharge', value: 12.3, rolls: 2 },
    ])
    expect(result.artifacts[1]).toMatchObject({ main: { stat: 'atkPct', value: 7 }, substats: [{ stat: 'critDmg', value: 7, rolls: 1 }] })
    expect(result.artifacts[1].equippedBy).toBeUndefined()
  })

  it('links characters, the Traveler, artifacts and weapons by location', () => {
    const result = parseGood(
      good({
        characters: [
          { key: 'Venti', level: 90, constellation: 2, ascension: 6, talent: { auto: 1, skill: 9, burst: 9 } },
          { key: 'TravelerElectro', level: 80, constellation: 6 },
          { key: 'SomeoneNew', level: 1, constellation: 0 },
        ],
        artifacts: [flower, { ...flower, slotKey: 'plume', mainStatKey: 'atk', location: 'Traveler' }],
        weapons: [{ key: 'FadingTwilight', level: 90, refinement: 5, location: 'Venti' }, { key: 'CoolSteel', level: 1, refinement: 1, location: '' }],
      }),
      store,
      '2026-10-26',
    )

    const [venti, traveler, unknown] = result.characters
    expect(venti).toMatchObject({ id: 'Venti', name: 'Venti', element: 'Anemo', level: 90, constellation: 2, stats: {} })
    expect(venti.artifactIds.flower).toBe(result.artifacts[0].id)
    expect(venti.weapon).toEqual({ id: 'FadingTwilight', name: 'Fading Twilight', rarity: 4, level: 90, refinement: 5 })
    expect(traveler).toMatchObject({ id: 'TravelerElectro', name: 'Traveler (Electro)', element: 'Electro' })
    expect(traveler.artifactIds.plume).toBe(result.artifacts[1].id)
    expect(result.artifacts[1].equippedBy).toBe('TravelerElectro')
    expect(unknown.name).toBe('Someone New')
  })

  it('gives the same artifact the same id from Enka and from GOOD', () => {
    const enkaFlower = {
      reliquary: { level: 21 },
      flat: {
        itemType: 'ITEM_RELIQUARY',
        equipType: 'EQUIP_BRACER',
        rankLevel: 5,
        setId: 15002,
        reliquaryMainstat: { mainPropId: 'FIGHT_PROP_HP', statValue: 4780 },
        reliquarySubstats: [
          { appendPropId: 'FIGHT_PROP_HP_PERCENT', statValue: 14 },
          { appendPropId: 'FIGHT_PROP_CRITICAL', statValue: 6.6 },
          { appendPropId: 'FIGHT_PROP_ELEMENT_MASTERY', statValue: 37 },
          { appendPropId: 'FIGHT_PROP_CHARGE_EFFICIENCY', statValue: 12.3 },
        ],
      },
    }
    const enka = parseEnkaGenshin({ playerInfo: {}, avatarInfoList: [{ avatarId: 10000022, equipList: [enkaFlower] }] }, store, '2026-10-26')
    const fromGood = parseGood(good({ artifacts: [flower] }), store, '2026-10-26')

    expect(enka.characters[0].id).toBe('Venti')
    expect(fromGood.artifacts[0].id).toBe(enka.artifacts[0].id)
  })

  it('gives identical artifacts their own ids and skips what it cannot read', () => {
    const blank = { ...flower, level: 0, location: '', substats: [{ key: 'atk', value: 18 }, { key: '', value: 0 }] }
    const result = parseGood(good({ artifacts: [blank, blank, { ...flower, slotKey: 'hat' }, 'junk'], characters: [{ level: 1 }] }), store, '2026-10-26')

    expect(result.artifacts).toHaveLength(2)
    expect(result.artifacts[1].id).toBe(`${result.artifacts[0].id}-2`)
    expect(result.warnings).toEqual([
      'A character couldn\'t be read, skipped',
      'Artifact 3 has an unknown set, slot or main stat, skipped',
      'Artifact 4 couldn\'t be read, skipped',
    ])
    expect(parseGood({ format: 'other' }, store, '2026-10-26').warnings).toEqual(['This isn\'t a GOOD file'])
  })
})
