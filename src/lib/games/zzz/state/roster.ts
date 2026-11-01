import { AGENTS } from 'lib/games/zzz/data/agents'
import type { AgentData } from 'lib/games/zzz/data/dataTypes'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'

// Every agent with stat data is available without adding them first, like HSR: agents with no build in the save get a
// default one (Mindscape 0, no W-Engine and no discs). Changing it (W-Engine, Equip...) saves it.

export function defaultZzzBuild(agent: AgentData): ImportedBuild {
  return {
    id: `uru-${agent.id}`,
    agentId: agent.id,
    name: agent.name,
    element: agent.element,
    specialty: agent.specialty,
    level: agent.level,
    mindscapeLevel: 0,
    wEngineRefinement: 1,
    discIds: {},
  }
}

// The saved builds, then a default one for every other agent with stat data by name. AGENTS grows once Enka's data
// loads (data/enkaGameData.ts), so callers recompute after useZzzGameData changes
export function zzzRoster(builds: ImportedBuild[]): ImportedBuild[] {
  const have = new Set(builds.map((b) => b.agentId))
  const others = Object.values(AGENTS).filter((agent) => !have.has(agent.id)).sort((a, b) => a.name.localeCompare(b.name))
  return [...builds, ...others.map(defaultZzzBuild)]
}
