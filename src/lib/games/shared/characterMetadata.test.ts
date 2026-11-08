import { hasTalentData } from 'lib/games/genshin/damage/damage'
import stats from 'lib/games/genshin/data/generated/stats.json'
import { genshinMetadata } from 'lib/games/genshin/data/metadata'
import {
  statPriority as genshinPriority,
  weightsFromPriority as genshinWeights,
} from 'lib/games/genshin/data/statPriorities'
import { metadataProblems } from 'lib/games/shared/characterMetadata'
import { weightsFromPriority } from 'lib/games/shared/gearScore'
import { hasSkillData } from 'lib/games/wuwa/damage/damage'
import { CHARACTERS } from 'lib/games/wuwa/data/gameData'
import { wuwaMetadata } from 'lib/games/wuwa/data/metadata'
import {
  statPriority as wuwaPriority,
  weightsFromPriority as wuwaWeights,
} from 'lib/games/wuwa/data/statPriorities'
import { agentHits } from 'lib/games/zzz/damage/damage'
import { AGENTS } from 'lib/games/zzz/data/agents'
import { zzzMetadata } from 'lib/games/zzz/data/metadata'
import { getPreset } from 'lib/games/zzz/data/presets'
import {
  describe,
  expect,
  it,
} from 'vitest'

const genshinIds = Object.keys((stats as { characters: Record<string, unknown> }).characters)
const wuwaIds = Object.keys(CHARACTERS)
const agents = Object.values(AGENTS)

describe('character metadata (after HSR ScoringMetadata)', () => {
  it('has weights, a source and a review date for every character in every game', () => {
    expect(genshinIds.length).toBeGreaterThan(50)
    expect(wuwaIds.length).toBeGreaterThan(30)
    // The hand-written agents (Enka's load at runtime)
    expect(agents.length).toBeGreaterThan(0)
    const problems = [
      ...genshinIds.flatMap((id) => metadataProblems(genshinMetadata(id)).map((p) => `genshin ${id}: ${p}`)),
      ...wuwaIds.flatMap((id) => metadataProblems(wuwaMetadata(id)).map((p) => `wuwa ${id}: ${p}`)),
      ...agents.flatMap((agent) => metadataProblems(zzzMetadata(agent)).map((p) => `zzz ${agent.id}: ${p}`)),
    ]
    expect(problems).toEqual([])
  })

  it('gives the same weights and defaults as the tables it came from (step 1 changes nothing)', () => {
    for (const id of genshinIds) {
      expect(genshinMetadata(id).stats).toEqual(genshinWeights(genshinPriority(id)))
      expect(genshinMetadata(id).sortOption).toBe(hasTalentData(id) ? 'damage' : 'avg:atk')
    }
    for (const id of wuwaIds) {
      expect(wuwaMetadata(id).stats).toEqual(wuwaWeights(wuwaPriority(id)))
      expect(wuwaMetadata(id).sortOption).toBe(hasSkillData(id) ? 'damage' : 'avg:atk')
    }
    for (const agent of agents) {
      expect(zzzMetadata(agent).stats).toEqual(weightsFromPriority(getPreset(agent).substatPriority))
      expect(zzzMetadata(agent).parts).toEqual(getPreset(agent).mainStats)
      expect(zzzMetadata(agent).sortOption).toBe(agentHits(agent.id).length > 0 ? 'damage' : 'critDmg')
    }
  })

  it('catches entries without a source or a real review date', () => {
    const entry = { ...genshinMetadata('Xiangling'), source: ' ', reviewed: '26-10-2026' }
    expect(metadataProblems(entry)).toEqual(['no source', 'review date "26-10-2026" isn\'t YYYY-MM-DD'])
  })
})
