import {
  optimizeArtifacts,
  type OptimizerOutcome,
  type OptimizerRequest,
} from 'lib/games/genshin/optimizer/artifactOptimizer'
import type { ProgressMessage } from 'lib/games/shared/progress'

// Runs the artifact search off the main thread, see optimizerClient.ts

export type OptimizerWorkerResponse = { outcome: OptimizerOutcome, ms: number }

self.onmessage = (e: MessageEvent<OptimizerRequest>) => {
  const started = performance.now()
  let outcome: OptimizerOutcome
  try {
    outcome = optimizeArtifacts({ ...e.data, onProgress: (progress) => self.postMessage({ progress } satisfies ProgressMessage) })
  } catch (error) {
    outcome = { ok: false, reason: `The search failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  const response: OptimizerWorkerResponse = { outcome, ms: performance.now() - started }
  self.postMessage(response)
}
