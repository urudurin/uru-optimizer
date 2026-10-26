import type { ProgressMessage } from 'lib/games/shared/progress'
import { AGENTS } from 'lib/games/zzz/data/agents'
import { loadZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import {
  optimizeDiscs,
  type OptimizerOutcome,
  type OptimizerRequest,
} from 'lib/games/zzz/optimizer/discOptimizer'

// Runs the disc search off the main thread, see optimizerClient.ts. W-Engine passives are functions, which can't be
// sent to a worker, so the agent and W-Engine come as ids and are looked up here (after loading Enka's data for the
// agents and W-Engines that aren't written by hand, see data/enkaGameData.ts)

export type DiscWorkerRequest = Omit<OptimizerRequest, 'agent' | 'wEngine'> & { agentId: string, wEngineId: string }
export type DiscWorkerResponse = { outcome: OptimizerOutcome, ms: number }

self.onmessage = async (e: MessageEvent<DiscWorkerRequest>) => {
  const started = performance.now()
  const { agentId, wEngineId, ...rest } = e.data
  if (!AGENTS[agentId] || !W_ENGINES[wEngineId]) await loadZzzGameData()
  const agent = AGENTS[agentId]
  const wEngine = W_ENGINES[wEngineId]
  let outcome: OptimizerOutcome
  try {
    outcome = agent && wEngine
      ? optimizeDiscs({ ...rest, agent, wEngine, onProgress: (progress) => self.postMessage({ progress } satisfies ProgressMessage) })
      : { ok: false, reason: `No data for ${agent ? `W-Engine ${wEngineId}` : `agent ${agentId}`}` }
  } catch (error) {
    outcome = { ok: false, reason: `The search failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  const response: DiscWorkerResponse = { outcome, ms: performance.now() - started }
  self.postMessage(response)
}
