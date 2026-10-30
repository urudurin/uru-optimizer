import { genshinSampleData } from 'lib/games/genshin/data/sampleData'
import { computeGenshinStats } from 'lib/games/genshin/stats/computeStats'
import { isSampleId } from 'lib/games/shared/sampleData'
import { ECHO_DEFINITIONS } from 'lib/games/wuwa/data/gameData'
import { wuwaSampleData } from 'lib/games/wuwa/data/sampleData'
import { validateEcho } from 'lib/games/wuwa/echoRules'
import { computeWuwaStats } from 'lib/games/wuwa/stats/computeStats'
import { zzzSampleData } from 'lib/games/zzz/data/sampleData'
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

describe('sample data', () => {
  it('ZZZ: a complete Miyabi build of valid discs, the same every time', () => {
    const sample = zzzSampleData()
    expect(sample.discs).toHaveLength(30)
    expect(sample.discs.every((d) => isSampleId(d.id) && d.main.value > 0 && d.substats.length === 4)).toBe(true)
    expect(sample.discs.every((d) => d.substats.reduce((sum, s) => sum + s.rolls, 0) === 9)).toBe(true)
    const resolved = resolveBuild(sample.builds[0], sample.discs)
    if (!resolved.ok) throw new Error(resolved.reason)
    const { stats, warnings } = computeStats({ ...resolved.build, coreSkillLevel: 6, conditions: statScreenConditions() })
    expect(warnings).toEqual([])
    expect(stats.atk).toBeGreaterThan(2000)
    expect(zzzSampleData()).toEqual(sample)
  })

  it('WuWa: echoes that follow the game\'s rules, Hsin wearing a 12-cost loadout', () => {
    const sample = wuwaSampleData()
    for (const echo of sample.echoes) expect(validateEcho(echo, ECHO_DEFINITIONS[echo.defId]), echo.defId).toEqual([])
    const worn = sample.characters[0].echoIds.map((id) => sample.echoes.find((e) => e.id === id)!)
    expect(worn.reduce((sum, e) => sum + e.cost, 0)).toBe(12)
    const { stats, warnings } = computeWuwaStats(sample.characters[0], worn)
    expect(warnings).toEqual([])
    expect(stats.critRate).toBeGreaterThan(5)
  })

  it('Genshin: Xiangling with a full set of 5-star artifacts', () => {
    const sample = genshinSampleData()
    expect(sample.artifacts).toHaveLength(25)
    const worn = sample.artifacts.filter((a) => Object.values(sample.characters[0].artifactIds).includes(a.id))
    expect(worn).toHaveLength(5)
    const { stats } = computeGenshinStats(sample.characters[0], worn)
    expect(stats.atk).toBeGreaterThan(1000)
    expect(stats.critRate).toBeGreaterThan(5)
  })
})
