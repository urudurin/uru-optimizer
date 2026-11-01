import { AGENTS } from 'lib/games/zzz/data/agents'
import type { AgentData } from 'lib/games/zzz/data/dataTypes'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'

// Every agent with stat data is available without adding them first, like HSR: agents with no build in the save get a
// default one (Mindscape 0, the best W-Engine of their specialty at R1). Changing it (W-Engine, Equip...) saves it.

const RANK_ORDER = { S: 3, A: 2, B: 1 }

// The highest-rank W-Engine of the specialty with the most base ATK
export function bestWEngine(specialty: string): string | undefined {
  let best: { id: string, rank: number, atk: number } | undefined
  for (const engine of Object.values(W_ENGINES)) {
    if (engine.specialty !== specialty) continue
    const rank = RANK_ORDER[engine.rarity]
    if (!best || rank > best.rank || (rank === best.rank && engine.baseAtk > best.atk)) best = { id: engine.id, rank, atk: engine.baseAtk }
  }
  return best?.id ?? Object.values(W_ENGINES)[0]?.id
}

export function defaultZzzBuild(agent: AgentData): ImportedBuild {
  return {
    id: `uru-${agent.id}`,
    agentId: agent.id,
    name: agent.name,
    element: agent.element,
    specialty: agent.specialty,
    level: agent.level,
    mindscapeLevel: 0,
    wEngineId: bestWEngine(agent.specialty),
    wEngineRefinement: 1,
    discIds: {},
  }
}

// The saved builds, then a default one for every other agent with stat data. AGENTS grows once Enka's data loads
// (data/enkaGameData.ts), so callers recompute after useZzzGameData changes
export function zzzRoster(builds: ImportedBuild[]): ImportedBuild[] {
  const have = new Set(builds.map((b) => b.agentId))
  const others = Object.values(AGENTS).filter((agent) => !have.has(agent.id)).sort((a, b) => a.name.localeCompare(b.name))
  return [...builds, ...others.map(defaultZzzBuild)]
}
