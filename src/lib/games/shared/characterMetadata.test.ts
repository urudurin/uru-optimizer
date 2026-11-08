import {
  COMBAT_2PC_BONUSES,
  SET_4PC_EFFECTS,
} from 'lib/games/genshin/damage/combatEffects'
import { hasTalentData } from 'lib/games/genshin/damage/damage'
import stats from 'lib/games/genshin/data/generated/stats.json'
import { MAIN_STAT_OPTIONS } from 'lib/games/genshin/data/mainStatOptions'
import { genshinMetadata } from 'lib/games/genshin/data/metadata'
import { GENSHIN_RECOMMENDATIONS } from 'lib/games/genshin/data/recommendations'
import { SET_2PC_BONUSES } from 'lib/games/genshin/data/setBonuses'
import {
  statPriority as genshinPriority,
  weightsFromPriority as genshinWeights,
} from 'lib/games/genshin/data/statPriorities'
import type { MainStatSlot } from 'lib/games/genshin/optimizer/artifactOptimizer'
import { SET_4PC_BUFFS } from 'lib/games/genshin/team/buffs'
import { metadataProblems } from 'lib/games/shared/characterMetadata'
import { weightsFromPriority } from 'lib/games/shared/gearScore'
import { hasSkillData } from 'lib/games/wuwa/damage/damage'
import { CHARACTERS } from 'lib/games/wuwa/data/gameData'
import { wuwaMetadata } from 'lib/games/wuwa/data/metadata'
import {
  statPriority as wuwaPriority,
  weightsFromPriority as wuwaWeights,
} from 'lib/games/wuwa/data/statPriorities'
import { MAIN_STAT_MAX } from 'lib/games/wuwa/echoStats'
import type { Cost } from 'lib/games/wuwa/types'
import { agentHits } from 'lib/games/zzz/damage/damage'
import { AGENTS } from 'lib/games/zzz/data/agents'
import { zzzMetadata } from 'lib/games/zzz/data/metadata'
import {
  getPreset,
  PRESETS,
} from 'lib/games/zzz/data/presets'
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

  it('names real characters, sets and main stats in the Genshin recommendations', () => {
    const sets = new Set([SET_2PC_BONUSES, COMBAT_2PC_BONUSES, SET_4PC_EFFECTS, SET_4PC_BUFFS].flatMap(Object.keys))
    const problems: string[] = []
    for (const [id, rec] of Object.entries(GENSHIN_RECOMMENDATIONS)) {
      if (!genshinIds.includes(id)) problems.push(`${id}: not a character`)
      for (const [slot, mains] of Object.entries(rec.parts)) {
        for (const main of mains ?? []) if (!MAIN_STAT_OPTIONS[slot as MainStatSlot]?.includes(main)) problems.push(`${id}: ${slot} ${main}`)
      }
      for (const option of rec.sets) {
        if (option.length < 1 || option.length > 2) problems.push(`${id}: set option ${option.join('+')}`)
        for (const set of option) if (!sets.has(set)) problems.push(`${id}: set ${set}`)
      }
      for (const mate of rec.teammates ?? []) {
        if (!genshinIds.includes(mate.id) || mate.id === id) problems.push(`${id}: teammate ${mate.id}`)
        if (mate.fourPiece && !sets.has(mate.fourPiece)) problems.push(`${id}: teammate set ${mate.fourPiece}`)
      }
      const metadata = genshinMetadata(id)
      if (!metadata.simulation || metadata.parts !== rec.parts) problems.push(`${id}: not in the metadata`)
    }
    expect(problems).toEqual([])
    expect(genshinMetadata('Xiangling').simulation?.teammates.map((mate) => mate.id)).toEqual(['Bennett', 'Xingqiu', 'Sucrose'])
    // Characters without a recommendation keep any main stat and no simulation
    expect(genshinMetadata('Amber').parts).toEqual({})
    expect(genshinMetadata('Amber').simulation).toBeUndefined()
  })

  it('works out WuWa main stats per cost that the cost can have', () => {
    for (const id of wuwaIds) {
      for (const [cost, mains] of Object.entries(wuwaMetadata(id).parts)) {
        for (const main of mains) expect(MAIN_STAT_MAX[Number(cost) as Cost][main as keyof (typeof MAIN_STAT_MAX)[Cost]], `${id} ${cost} ${main}`).toBeDefined()
      }
    }
    expect(wuwaMetadata('hsin').parts[4]).toEqual(['critRate', 'critDmg'])
    expect(wuwaMetadata('hsin').parts[3]).toContain('energyRegen')
    expect(wuwaMetadata('the-shorekeeper').parts).toEqual({ 4: ['healingBonus'], 3: ['energyRegen', 'hpPct'], 1: ['hpPct'] })
  })

  it('gives hand-written ZZZ presets a benchmark simulation from their sets and mains', () => {
    for (const agent of agents) {
      const simulation = zzzMetadata(agent).simulation
      if (PRESETS[agent.id]?.sets.length) {
        expect(simulation?.sets.length).toBe(PRESETS[agent.id].sets.length)
        expect(simulation?.teammates).toEqual([])
      } else {
        expect(simulation).toBeUndefined()
      }
    }
  })
})
