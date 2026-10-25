import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  isSupportedBuild,
  resolveBuild,
} from 'lib/games/zzz/stats/resolveBuild'
import type { Disc } from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

function makeBuild(overrides: Partial<ImportedBuild> = {}): ImportedBuild {
  return {
    id: 'b1',
    agentId: '1431',
    name: 'Ye Shunguang',
    element: 'Physical',
    specialty: 'Attack',
    level: 60,
    mindscapeLevel: 0,
    wEngineId: '14143',
    wEngineRefinement: 1,
    discIds: { 1: 'd1', 2: 'd2' },
    ...overrides,
  }
}

function makeDisc(id: string, slot: 1 | 2): Disc {
  return {
    id,
    slot,
    setId: 'white-water-ballad',
    setName: 'White Water Ballad',
    rarity: 'S',
    level: 15,
    main: { stat: 'HP', value: 2200 },
    substats: [],
    locked: false,
  }
}

describe('resolveBuild', () => {
  it('resolves agent, W-Engine and discs', () => {
    const result = resolveBuild(makeBuild(), [makeDisc('d1', 1), makeDisc('d2', 2)])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.build.agent.name).toBe('Ye Shunguang')
    expect(result.build.wEngine.name).toBe('Cloudcleave Radiance')
    expect(result.build.discs).toHaveLength(2)
    expect(result.notes).toEqual([])
  })

  it('notes discs that are missing instead of failing', () => {
    const result = resolveBuild(makeBuild(), [makeDisc('d1', 1)])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.build.discs).toHaveLength(1)
    expect(result.notes).toEqual(['Disc d2 from this build isn\'t in your imported discs, so it is left out'])
  })

  it('notes a level mismatch', () => {
    const result = resolveBuild(makeBuild({ level: 50 }), [])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.notes[0]).toBe('The build is level 50 but the agent data is for level 60, so base stats may be off')
  })

  it('explains why unsupported builds cannot be resolved', () => {
    expect(resolveBuild(makeBuild({ agentId: '9999', name: 'Someone' }), [])).toEqual({
      ok: false,
      reason: 'No data for agent "Someone" (id 9999) yet',
    })
    expect(resolveBuild(makeBuild({ wEngineId: undefined }), [])).toEqual({ ok: false, reason: 'This build has no W-Engine' })
    expect(resolveBuild(makeBuild({ wEngineId: '1' }), [])).toEqual({ ok: false, reason: 'No data for W-Engine id 1 yet' })
  })

  it('knows which builds are supported', () => {
    expect(isSupportedBuild(makeBuild())).toBe(true)
    expect(isSupportedBuild(makeBuild({ agentId: '9999' }))).toBe(false)
  })
})
