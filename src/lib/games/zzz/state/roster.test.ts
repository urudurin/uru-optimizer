import { AGENTS } from 'lib/games/zzz/data/agents'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import {
  bestWEngine,
  zzzRoster,
} from 'lib/games/zzz/state/roster'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('zzzRoster', () => {
  it('gives every agent without a saved build a default one', () => {
    const roster = zzzRoster([])
    expect(roster.map((b) => b.agentId).sort()).toEqual(Object.keys(AGENTS).sort())
    for (const build of roster) {
      expect(build).toMatchObject({ id: `uru-${build.agentId}`, mindscapeLevel: 0, wEngineRefinement: 1, discIds: {} })
      expect(W_ENGINES[build.wEngineId!].specialty).toBe(AGENTS[build.agentId].specialty)
    }
  })

  it('keeps saved builds instead of a default', () => {
    const saved = { ...zzzRoster([])[0], id: 'mine', mindscapeLevel: 6 }
    const roster = zzzRoster([saved])
    expect(roster.filter((b) => b.agentId === saved.agentId)).toEqual([saved])
  })

  it('picks the best W-Engine of the specialty', () => {
    const id = bestWEngine('Attack')!
    const best = W_ENGINES[id]
    for (const engine of Object.values(W_ENGINES)) {
      if (engine.specialty === 'Attack' && engine.rarity === best.rarity) expect(engine.baseAtk).toBeLessThanOrEqual(best.baseAtk)
    }
    expect(best.rarity).toBe('S')
  })
})
