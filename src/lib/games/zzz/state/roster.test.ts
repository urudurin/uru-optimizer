import { AGENTS } from 'lib/games/zzz/data/agents'
import { zzzRoster } from 'lib/games/zzz/state/roster'
import {
  computeStats,
  statScreenConditions,
} from 'lib/games/zzz/stats/computeStats'
import { resolveBuild } from 'lib/games/zzz/stats/resolveBuild'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('zzzRoster', () => {
  it('gives every agent without a saved build a default one with no W-Engine and no discs', () => {
    const roster = zzzRoster([])
    expect(roster.map((b) => b.agentId).sort()).toEqual(Object.keys(AGENTS).sort())
    for (const build of roster) {
      expect(build).toMatchObject({ id: `uru-${build.agentId}`, mindscapeLevel: 0, wEngineRefinement: 1, discIds: {} })
      expect(build.wEngineId).toBeUndefined()
    }
  })

  it('keeps saved builds instead of a default', () => {
    const saved = { ...zzzRoster([])[0], id: 'mine', mindscapeLevel: 6 }
    expect(zzzRoster([saved]).filter((b) => b.agentId === saved.agentId)).toEqual([saved])
  })

  it('works out stats without a W-Engine: base ATK only', () => {
    const build = zzzRoster([])[0]
    const resolved = resolveBuild(build, [])
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    const { stats } = computeStats({ ...resolved.build, coreSkillLevel: 6, conditions: statScreenConditions() })
    expect(stats.atk).toBeGreaterThan(0)
  })
})
