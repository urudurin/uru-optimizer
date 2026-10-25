import { AGENTS } from 'lib/games/zzz/data/agents'
import type {
  AgentData,
  WEngineData,
} from 'lib/games/zzz/data/dataTypes'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import type { Disc } from 'lib/games/zzz/types'

// Everything the calculator needs from a saved build except the conditions and Core Skill level, which the user picks
export type ResolvedBuild = {
  agent: AgentData,
  wEngine: WEngineData,
  wEngineRefinement: number,
  discs: Disc[],
}

export type ResolveResult =
  | { ok: true, build: ResolvedBuild, notes: string[] }
  | { ok: false, reason: string }

export function isSupportedBuild(build: ImportedBuild): boolean {
  return AGENTS[build.agentId] !== undefined
}

// Never throws: anything it can't resolve is reported in plain words
export function resolveBuild(build: ImportedBuild, allDiscs: Disc[]): ResolveResult {
  const agent = AGENTS[build.agentId]
  if (!agent) return { ok: false, reason: `No data for agent "${build.name}" (id ${build.agentId}) yet` }

  if (!build.wEngineId) return { ok: false, reason: 'This build has no W-Engine' }
  const wEngine = W_ENGINES[build.wEngineId]
  if (!wEngine) return { ok: false, reason: `No data for W-Engine id ${build.wEngineId} yet` }

  const notes: string[] = []
  if (build.level !== agent.level) {
    notes.push(`The build is level ${build.level} but the agent data is for level ${agent.level}, so base stats may be off`)
  }

  const byId = new Map(allDiscs.map((disc) => [disc.id, disc]))
  const discs: Disc[] = []
  for (const discId of Object.values(build.discIds)) {
    const disc = byId.get(discId)
    if (disc) discs.push(disc)
    else notes.push(`Disc ${discId} from this build isn't in your imported discs, so it is left out`)
  }

  return { ok: true, build: { agent, wEngine, wEngineRefinement: build.wEngineRefinement, discs }, notes }
}
