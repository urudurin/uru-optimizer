import {
  optimizeArtifacts,
  type OptimizerOutcome,
  type OptimizerRequest,
} from 'lib/games/genshin/optimizer/artifactOptimizer'
import type { ProgressMessage } from 'lib/games/shared/progress'
import type { BaseWorkerInput } from 'lib/worker/workerPool'

// Runs the artifact search in one of HSR's pooled workers (lib/worker/baseWorker.ts loads this on first use), see
// optimizerClient.ts

export type GenshinArtifactWorkerInput = OptimizerRequest & BaseWorkerInput
export type OptimizerWorkerResponse = { outcome: OptimizerOutcome, ms: number }

export function genshinArtifactSearchWorker(e: MessageEvent<GenshinArtifactWorkerInput>) {
  const started = performance.now()
  const { workerType: _, ...request } = e.data
  let outcome: OptimizerOutcome
  try {
    outcome = optimizeArtifacts({ ...request, onProgress: (progress) => self.postMessage({ progress } satisfies ProgressMessage) })
  } catch (error) {
    outcome = { ok: false, reason: `The search failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  const response: OptimizerWorkerResponse = { outcome, ms: performance.now() - started }
  self.postMessage(response)
}
