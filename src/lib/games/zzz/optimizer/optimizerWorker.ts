import type { ProgressMessage } from 'lib/games/shared/progress'
import { AGENTS } from 'lib/games/zzz/data/agents'
import { loadZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import {
  optimizeDiscs,
  type OptimizerOutcome,
  type OptimizerRequest,
} from 'lib/games/zzz/optimizer/discOptimizer'
import type { BaseWorkerInput } from 'lib/worker/workerPool'

// Runs the disc search in one of HSR's pooled workers (lib/worker/baseWorker.ts loads this on first use), see
// optimizerClient.ts. W-Engine passives are functions, which can't be sent to a worker, so the agent and W-Engine come
// as ids and are looked up here (after loading Enka's data for the agents and W-Engines that aren't written by hand,
// see data/enkaGameData.ts)

export type DiscWorkerRequest = Omit<OptimizerRequest, 'agent' | 'wEngine'> & { agentId: string, wEngineId?: string }
export type ZzzDiscWorkerInput = DiscWorkerRequest & BaseWorkerInput
export type DiscWorkerResponse = { outcome: OptimizerOutcome, ms: number }

export async function zzzDiscSearchWorker(e: MessageEvent<ZzzDiscWorkerInput>) {
  const started = performance.now()
  const { workerType: _, agentId, wEngineId, ...rest } = e.data
  if (!AGENTS[agentId] || (wEngineId && !W_ENGINES[wEngineId])) await loadZzzGameData()
  const agent = AGENTS[agentId]
  const wEngine = wEngineId ? W_ENGINES[wEngineId] : undefined
  let outcome: OptimizerOutcome
  try {
    outcome = agent && (wEngine || !wEngineId)
      ? optimizeDiscs({ ...rest, agent, wEngine, onProgress: (progress) => self.postMessage({ progress } satisfies ProgressMessage) })
      : { ok: false, reason: `No data for ${agent ? `W-Engine ${wEngineId}` : `agent ${agentId}`}` }
  } catch (error) {
    outcome = { ok: false, reason: `The search failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  const response: DiscWorkerResponse = { outcome, ms: performance.now() - started }
  self.postMessage(response)
}
