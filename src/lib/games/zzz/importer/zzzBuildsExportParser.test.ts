import {
  parseZzzBuildsExport,
  parseZzzBuildsExportJson,
  slugifySetName,
} from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  describe,
  expect,
  it,
} from 'vitest'

function makeDisc(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'disc-1',
    slot: 'Drive4',
    set: 'Phaethon\'s Melody',
    rarity: 'S',
    level: 15,
    mainStat: { type: 'CRIT_Rate', value: 24 },
    subStats: [
      { type: 'ATK%', value: 12, rolls: 4 },
      { type: 'CRIT_DMG', value: 14.4, rolls: 3 },
      { type: 'Anomaly_Proficiency', value: 27, rolls: 3 },
      { type: 'PEN', value: 9, rolls: 1 },
    ],
    lock: false,
    ...overrides,
  }
}

function makeBuild(discs: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    id: 'build-1',
    agentId: '1501',
    name: 'Aria',
    element: 'Ether',
    specialty: 'Anomaly',
    level: 60,
    mindscapeLevel: 0,
    wEngineRefinement: 1,
    equippedDiscs: discs,
    equippedWEngine: { id: '14150', name: 'Angel in the Shell' },
    ...overrides,
  }
}

describe('parseZzzBuildsExport', () => {
  it('parses a valid disc without warnings', () => {
    const result = parseZzzBuildsExport({ version: '3.0', discs: [makeDisc()], builds: [] })

    expect(result.warnings).toHaveLength(0)
    expect(result.discs).toHaveLength(1)
    expect(result.discs[0]).toEqual({
      id: 'disc-1',
      slot: 4,
      setId: 'phaethons-melody',
      setName: 'Phaethon\'s Melody',
      rarity: 'S',
      level: 15,
      main: { stat: 'CRIT Rate', value: 24 },
      substats: [
        { stat: 'ATK%', rolls: 4 },
        { stat: 'CRIT DMG', rolls: 3 },
        { stat: 'Anomaly Proficiency', rolls: 3 },
        { stat: 'PEN', rolls: 1 },
      ],
      locked: false,
    })
  })

  it('keeps the in-game owner when present', () => {
    const result = parseZzzBuildsExport({ version: '3.0', discs: [makeDisc({ equippedBy: '1501' })] })

    expect(result.discs[0]?.equippedBy).toBe('1501')
  })

  it('skips a substat with an empty type and keeps the disc', () => {
    const disc = makeDisc({
      subStats: [
        { type: 'PEN', value: 9, rolls: 1 },
        { type: '', value: 224, rolls: 0 },
        { type: 'ATK%', value: 3, rolls: 1 },
        { type: 'CRIT_DMG', value: 19.2, rolls: 4 },
      ],
    })
    const result = parseZzzBuildsExport({ version: '3.0', discs: [disc] })

    expect(result.discs).toHaveLength(1)
    expect(result.discs[0]?.substats).toHaveLength(3)
    expect(result.warnings.map((w) => w.code)).toEqual(['EMPTY_SUBSTAT'])
    expect(result.warnings[0]?.discId).toBe('disc-1')
  })

  it('skips unknown substat types with a warning', () => {
    const disc = makeDisc({ subStats: [{ type: 'Mystery_Stat', value: 5, rolls: 1 }, { type: 'PEN', value: 9, rolls: 1 }] })
    const result = parseZzzBuildsExport({ version: '3.0', discs: [disc] })

    expect(result.discs[0]?.substats).toEqual([{ stat: 'PEN', rolls: 1 }])
    expect(result.warnings.map((w) => w.code)).toEqual(['UNKNOWN_STAT'])
  })

  it('warns when a substat value does not match its rolls but still imports it', () => {
    const disc = makeDisc({ subStats: [{ type: 'ATK%', value: 99, rolls: 2 }] })
    const result = parseZzzBuildsExport({ version: '3.0', discs: [disc] })

    expect(result.discs[0]?.substats).toEqual([{ stat: 'ATK%', rolls: 2 }])
    expect(result.warnings.map((w) => w.code)).toEqual(['VALUE_MISMATCH'])
  })

  it('warns when a fixed-main-stat slot has the wrong main stat', () => {
    const disc = makeDisc({ slot: 'Drive1', mainStat: { type: 'ATK', value: 316 } })
    const result = parseZzzBuildsExport({ version: '3.0', discs: [disc] })

    expect(result.discs).toHaveLength(1)
    expect(result.warnings.map((w) => w.code)).toEqual(['FIXED_MAIN_STAT_MISMATCH'])
  })

  it('skips malformed discs', () => {
    const result = parseZzzBuildsExport({
      version: '3.0',
      discs: [makeDisc({ slot: 'Drive9' }), makeDisc({ uid: 'disc-2', level: 99 }), 'nonsense', makeDisc({ uid: 'disc-3' })],
    })

    expect(result.discs.map((d) => d.id)).toEqual(['disc-3'])
    expect(result.warnings.map((w) => w.code)).toEqual(['MALFORMED_DISC', 'MALFORMED_DISC', 'MALFORMED_DISC'])
  })

  it('keeps the first of two discs with the same id', () => {
    const result = parseZzzBuildsExport({
      version: '3.0',
      discs: [makeDisc(), makeDisc({ set: 'Other Set' })],
    })

    expect(result.discs).toHaveLength(1)
    expect(result.discs[0]?.setId).toBe('phaethons-melody')
    expect(result.warnings.map((w) => w.code)).toEqual(['DUPLICATE_DISC'])
  })

  it('links build discs to the discs list without duplicating them or their warnings', () => {
    const corrupt = makeDisc({
      uid: 'disc-bad',
      slot: 'Drive2',
      mainStat: { type: 'ATK', value: 316 },
      subStats: [{ type: '', value: 1, rolls: 0 }],
    })
    const result = parseZzzBuildsExport({
      version: '3.0',
      discs: [makeDisc(), corrupt],
      builds: [makeBuild({ Drive4: makeDisc(), Drive2: corrupt })],
    })

    expect(result.discs).toHaveLength(2)
    expect(result.builds).toHaveLength(1)
    expect(result.builds[0]?.discIds).toEqual({ 2: 'disc-bad', 4: 'disc-1' })
    expect(result.warnings.map((w) => w.code)).toEqual(['EMPTY_SUBSTAT'])
  })

  it('imports discs that only exist inside a build', () => {
    const result = parseZzzBuildsExport({
      version: '3.0',
      discs: [],
      builds: [makeBuild({ Drive4: makeDisc() })],
    })

    expect(result.discs.map((d) => d.id)).toEqual(['disc-1'])
    expect(result.builds[0]?.discIds[4]).toBe('disc-1')
  })

  it('reads build details', () => {
    const result = parseZzzBuildsExport({ version: '3.0', builds: [makeBuild({})] })

    expect(result.builds[0]).toEqual({
      id: 'build-1',
      agentId: '1501',
      name: 'Aria',
      element: 'Ether',
      specialty: 'Anomaly',
      level: 60,
      mindscapeLevel: 0,
      wEngineId: '14150',
      wEngineRefinement: 1,
      discIds: {},
    })
  })

  it('warns about an unexpected version but still parses', () => {
    const result = parseZzzBuildsExport({ version: '9.1', discs: [makeDisc()] })

    expect(result.discs).toHaveLength(1)
    expect(result.warnings.map((w) => w.code)).toEqual(['UNKNOWN_VERSION'])
  })

  it('rejects input that is not an export', () => {
    for (const input of [null, 'text', 42, [], {}, { discs: 'nope' }]) {
      const result = parseZzzBuildsExport(input)
      expect(result.discs).toHaveLength(0)
      expect(result.warnings.map((w) => w.code)).toEqual(['INVALID_INPUT'])
    }
  })
})

describe('parseZzzBuildsExportJson', () => {
  it('parses JSON text, including a byte order mark', () => {
    const text = '\uFEFF' + JSON.stringify({ version: '3.0', discs: [makeDisc()] })

    expect(parseZzzBuildsExportJson(text).discs).toHaveLength(1)
  })

  it('reports invalid JSON instead of throwing', () => {
    const result = parseZzzBuildsExportJson('{ not json')

    expect(result.discs).toHaveLength(0)
    expect(result.warnings.map((w) => w.code)).toEqual(['INVALID_INPUT'])
  })
})

describe('slugifySetName', () => {
  it('makes stable ids from display names', () => {
    expect(slugifySetName('Phaethon\'s Melody')).toBe('phaethons-melody')
    expect(slugifySetName('Branch & Blade Song')).toBe('branch-blade-song')
    expect(slugifySetName('The Sky Ablaze')).toBe('the-sky-ablaze')
  })

  it('falls back to the original name when nothing ASCII is left', () => {
    expect(slugifySetName('啄木鸟电音')).toBe('啄木鸟电音')
  })
})
