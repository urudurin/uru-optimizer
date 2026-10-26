import {
  type EnkaZzzStore,
  isEnkaZzzResponse,
  parseEnkaZzz,
} from 'lib/games/zzz/importer/enkaParser'
import type { Disc } from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

// A made-up showcase in Enka's shape, and the small part of Enka's store files it needs
const store: EnkaZzzStore = {
  equipments: {
    Items: { '31041': { Rarity: 4, SuitId: 31000 }, '31031': { Rarity: 3, SuitId: 31000 } },
    Suits: { '31000': { Name: 'EquipmentSuit_31000_name' } },
  },
  avatars: {
    '1091': { Name: 'Avatar_Female_Size02_Unagi', ProfessionType: 'Anomaly', ElementTypes: ['FireFrost', 'Ice'] },
    '9999': { Name: 'Avatar_New', ProfessionType: 'Stun', ElementTypes: ['Elec'] },
  },
  locs: { EquipmentSuit_31000_name: 'Woodpecker Electro', Avatar_Female_Size02_Unagi: 'Miyabi', Avatar_New: 'Newcomer' },
}

const prop = (PropertyId: number, PropertyValue: number, PropertyLevel = 1) => ({ PropertyId, PropertyValue, PropertyLevel })

function equipment(uid: number, slot: number, main: ReturnType<typeof prop>, subs: ReturnType<typeof prop>[], id = 31041, level = 15) {
  return { Slot: slot, Equipment: { Uid: uid, Id: id, Level: level, IsLocked: true, MainPropertyList: [main], RandomPropertyList: subs } }
}

function response(avatars: unknown[]) {
  return { uid: '1000000001', ttl: 60, PlayerInfo: { ShowcaseDetail: { AvatarList: avatars } } }
}

const miyabi = {
  Id: 1091,
  Level: 60,
  TalentLevel: 2,
  Weapon: { Id: 14109, UpgradeLevel: 1 },
  EquippedList: [
    equipment(101, 1, prop(11103, 550), [prop(13103, 15), prop(20103, 240, 3), prop(13102, 480), prop(21103, 480, 3)]),
    equipment(104, 4, prop(20101 + 2, 600), [prop(12102, 300, 2)]),
  ],
}

describe('parseEnkaZzz', () => {
  it('recognizes Enka ZZZ responses', () => {
    expect(isEnkaZzzResponse(response([]))).toBe(true)
    expect(isEnkaZzzResponse({ version: '3.0', builds: [] })).toBe(false)
  })

  it('turns a showcased agent into a build with its discs', () => {
    const result = parseEnkaZzz(response([miyabi]), store, { discs: [], builds: [] })

    expect(result.warnings).toEqual([])
    expect(result.uid).toBe('1000000001')
    expect(result.ttl).toBe(60)
    expect(result.builds).toEqual([{
      id: 'enka-1091',
      agentId: '1091',
      name: 'Miyabi',
      element: 'Ice',
      specialty: 'Anomaly',
      level: 60,
      mindscapeLevel: 2,
      wEngineId: '14109',
      wEngineRefinement: 1,
      discIds: { 1: 'enka-101', 4: 'enka-104' },
    }])
    expect(result.discs[0]).toEqual({
      id: 'enka-101',
      slot: 1,
      setId: 'woodpecker-electro',
      setName: 'Woodpecker Electro',
      rarity: 'S',
      level: 15,
      // 550 at +0, x4 at +15 for an S-rank disc
      main: { stat: 'HP', value: 2200 },
      substats: [
        { stat: 'DEF', rolls: 1 },
        { stat: 'CRIT Rate', rolls: 3 },
        { stat: 'DEF%', rolls: 1 },
        { stat: 'CRIT DMG', rolls: 3 },
      ],
      locked: true,
      equippedBy: '1091',
    })
    // Percent main stats are stored x100: 600 -> 6% at +0 -> 24% at +15
    expect(result.discs[1].main).toEqual({ stat: 'CRIT Rate', value: 24 })
  })

  it('scales A-rank main stats by their own rate', () => {
    const agent = { ...miyabi, EquippedList: [equipment(201, 2, prop(12103, 40), [], 31031, 12)] }
    // 40 x (1 + 12 x 0.25)
    expect(parseEnkaZzz(response([agent]), store, { discs: [], builds: [] }).discs[0].main).toEqual({ stat: 'ATK', value: 160 })
  })

  it('reuses the ids of discs and builds that are already imported', () => {
    const fromExport: Disc = {
      id: 'export-disc-1',
      slot: 1,
      setId: 'woodpecker-electro',
      setName: 'Woodpecker Electro',
      rarity: 'S',
      level: 15,
      main: { stat: 'HP', value: 2200 },
      substats: [{ stat: 'CRIT DMG', rolls: 3 }, { stat: 'DEF%', rolls: 1 }, { stat: 'CRIT Rate', rolls: 3 }, { stat: 'DEF', rolls: 1 }],
      locked: false,
    }
    const existingBuild = {
      id: 'build_old',
      agentId: '1091',
      name: 'Miyabi',
      element: 'Ice',
      specialty: 'Anomaly',
      level: 60,
      mindscapeLevel: 0,
      wEngineRefinement: 1,
      discIds: {},
    }
    const result = parseEnkaZzz(response([miyabi]), store, { discs: [fromExport], builds: [existingBuild] })

    expect(result.discs[0].id).toBe('export-disc-1')
    expect(result.discs[0].equippedBy).toBe('1091')
    expect(result.builds[0].id).toBe('build_old')
    expect(result.builds[0].discIds[1]).toBe('export-disc-1')
  })

  it('uses Enka names and elements for agents without stat data', () => {
    const result = parseEnkaZzz(response([{ Id: 9999, Level: 50, EquippedList: [] }]), store, { discs: [], builds: [] })

    expect(result.builds[0]).toMatchObject({ name: 'Newcomer', element: 'Electric', specialty: 'Stun', level: 50, wEngineId: undefined })
  })

  it('skips what it cannot read and says why', () => {
    const agent = {
      ...miyabi,
      EquippedList: [
        equipment(301, 3, prop(13103, 46), [prop(99999, 1)]),
        equipment(302, 5, prop(31803, 750), [], 12345),
        'junk',
      ],
    }
    const result = parseEnkaZzz(response([agent, 'junk']), store, { discs: [], builds: [] })

    expect(result.discs.map((d) => d.id)).toEqual(['enka-301'])
    expect(result.warnings.map((w) => w.message)).toEqual([
      'Unknown disc stat 99999, skipped',
      'Agent 1091: a disc couldn\'t be read, skipped',
      'Agent 1091: a disc couldn\'t be read, skipped',
      'A showcased agent couldn\'t be read, skipped',
    ])
  })

  it('explains an empty showcase and non-Enka input', () => {
    expect(parseEnkaZzz(response([]), store, { discs: [], builds: [] }).warnings[0].message).toContain('no agents in its showcase')
    expect(parseEnkaZzz({ foo: 1 }, store, { discs: [], builds: [] }).warnings[0].message).toBe('This isn\'t an Enka.Network ZZZ profile')
  })
})
