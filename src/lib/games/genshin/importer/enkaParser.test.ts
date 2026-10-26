import {
  type EnkaGenshinStore,
  isEnkaGenshinResponse,
  parseEnkaGenshin,
} from 'lib/games/genshin/importer/enkaParser'
import {
  describe,
  expect,
  it,
} from 'vitest'

// A made-up showcase in Enka's shape, and the small part of Enka's store files it needs
const store: EnkaGenshinStore = {
  avatars: {
    '10000022': { Element: 'Wind', NameTextMapHash: 2466140362 },
    '10000007-704': { Element: 'Electric', NameTextMapHash: 11 },
  },
  locs: { '2466140362': 'Venti', '3237665819': 'Viridescent Venerer', '2425414923': 'Fading Twilight', '11': 'Traveler' },
  sets: { '15002': { Name: '3237665819' } },
  affixes: {
    '501031': { PropType: 3 },
    '501032': { PropType: 3 },
    '501033': { PropType: 3 },
    '501201': { PropType: 20 },
    '501204': { PropType: 20 },
    '501233': { PropType: 23 },
    '501234': { PropType: 23 },
    '501241': { PropType: 28 },
    '501243': { PropType: 28 },
  },
}

const flower = {
  itemId: 76544,
  reliquary: { level: 21, mainPropId: 14001, appendPropIdList: [501033, 501204, 501243, 501234, 501032, 501233, 501201, 501031, 501241] },
  flat: {
    itemType: 'ITEM_RELIQUARY',
    equipType: 'EQUIP_BRACER',
    rankLevel: 5,
    setId: 15002,
    setNameTextMapHash: '1562600667',
    reliquaryMainstat: { mainPropId: 'FIGHT_PROP_HP', statValue: 4780 },
    reliquarySubstats: [
      { appendPropId: 'FIGHT_PROP_HP_PERCENT', statValue: 14 },
      { appendPropId: 'FIGHT_PROP_CRITICAL', statValue: 6.6 },
      { appendPropId: 'FIGHT_PROP_ELEMENT_MASTERY', statValue: 37 },
      { appendPropId: 'FIGHT_PROP_CHARGE_EFFICIENCY', statValue: 12.3 },
    ],
  },
}

const bow = {
  itemId: 15411,
  weapon: { level: 80, promoteLevel: 5, affixMap: { '115411': 4 } },
  flat: {
    itemType: 'ITEM_WEAPON',
    nameTextMapHash: '2425414923',
    rankLevel: 4,
    weaponStats: [
      { appendPropId: 'FIGHT_PROP_BASE_ATTACK', statValue: 497 },
      { appendPropId: 'FIGHT_PROP_CHARGE_EFFICIENCY', statValue: 27.9 },
    ],
  },
}

const venti = {
  avatarId: 10000022,
  propMap: { 4001: { type: 4001, ival: '90', val: '90' } },
  talentIdList: [1, 2],
  fightPropMap: { 2000: 19711.97, 2001: 1624.2, 2002: 668.64, 20: 0.2055, 22: 0.6321, 23: 2.4283, 28: 165.54, 44: 0.15 },
  equipList: [flower, bow],
}

function response(list: unknown[]) {
  return { uid: '602175084', ttl: 60, playerInfo: { nickname: 'Test' }, avatarInfoList: list }
}

describe('parseEnkaGenshin', () => {
  it('recognizes Genshin responses, not ZZZ ones', () => {
    expect(isEnkaGenshinResponse(response([]))).toBe(true)
    expect(isEnkaGenshinResponse({ PlayerInfo: {} })).toBe(false)
  })

  it('reads a character with the game\'s own final stats, weapon and artifacts', () => {
    const result = parseEnkaGenshin(response([venti]), store, '2026-10-26')

    expect(result.warnings).toEqual([])
    expect(result.uid).toBe('602175084')
    const character = result.characters[0]
    expect(character).toMatchObject({ id: '10000022', name: 'Venti', element: 'Anemo', level: 90, constellation: 2, statsDate: '2026-10-26' })
    expect(character.stats.hp).toBeCloseTo(19711.97)
    expect(character.stats.critRate).toBeCloseTo(20.55)
    expect(character.stats.energyRecharge).toBeCloseTo(242.83)
    expect(character.stats.anemoDmg).toBeCloseTo(15)
    expect(character.weapon).toEqual({
      id: '15411',
      name: 'Fading Twilight',
      rarity: 4,
      level: 80,
      refinement: 5,
      baseAtk: 497,
      secondary: { stat: 'energyRecharge', value: 27.9 },
    })
    expect(character.artifactIds.flower).toBe(result.artifacts[0].id)
  })

  it('reads artifacts with their set name, level and substat rolls', () => {
    const artifact = parseEnkaGenshin(response([venti]), store, '2026-10-26').artifacts[0]

    expect(artifact).toMatchObject({
      slot: 'flower',
      setId: '15002',
      setName: 'Viridescent Venerer',
      rarity: 5,
      level: 20,
      main: { stat: 'hp', value: 4780 },
      equippedBy: '10000022',
    })
    // 9 roll ids: HP% three times, the rest twice
    expect(artifact.substats).toEqual([
      { stat: 'hpPct', value: 14, rolls: 3 },
      { stat: 'critRate', value: 6.6, rolls: 2 },
      { stat: 'elementalMastery', value: 37, rolls: 2 },
      { stat: 'energyRecharge', value: 12.3, rolls: 2 },
    ])
  })

  it('gives an unchanged artifact the same id on every import', () => {
    const first = parseEnkaGenshin(response([venti]), store, '2026-10-26').artifacts[0].id
    const again = parseEnkaGenshin(response([venti]), store, '2026-10-27').artifacts[0].id
    const changed = { ...flower, flat: { ...flower.flat, reliquaryMainstat: { mainPropId: 'FIGHT_PROP_HP', statValue: 4000 } } }
    const other = parseEnkaGenshin(response([{ ...venti, equipList: [changed] }]), store, '2026-10-26').artifacts[0].id

    expect(again).toBe(first)
    expect(other).not.toBe(first)
  })

  it('finds Traveler by element and skips what it cannot read', () => {
    const traveler = { avatarId: 10000007, skillDepotId: 704, propMap: {}, equipList: [{ flat: { itemType: 'ITEM_RELIQUARY', equipType: 'EQUIP_HAT' } }] }
    const result = parseEnkaGenshin(response([traveler, 'junk']), store, '2026-10-26')

    expect(result.characters[0]).toMatchObject({ name: 'Traveler', element: 'Electro', level: 1, constellation: 0 })
    expect(result.warnings).toEqual([
      'Character 10000007: an artifact couldn\'t be read, skipped',
      'A showcased character couldn\'t be read, skipped',
    ])
  })

  it('explains an empty showcase and non-Genshin input', () => {
    expect(parseEnkaGenshin({ uid: '1', playerInfo: {} }, store, '2026-10-26').warnings[0]).toContain('no characters in its showcase')
    expect(parseEnkaGenshin({ PlayerInfo: {} }, store, '2026-10-26').warnings).toEqual(['This isn\'t an Enka.Network Genshin profile'])
  })
})
