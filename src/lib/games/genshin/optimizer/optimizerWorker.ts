import {
  optimizeArtifacts,
  type OptimizerOutcome,
  type OptimizerRequest,
} from 'lib/games/genshin/optimizer/artifactOptimizer'

// Runs the artifact search off the main thread, see optimizerClient.ts

export type OptimizerWorkerResponse = { outcome: OptimizerOutcome, ms: number }

self.onmessage = (e: MessageEvent<OptimizerRequest>) => {
  const started = performance.now()
  let outcome: OptimizerOutcome
  try {
    outcome = optimizeArtifacts(e.data)
  } catch (error) {
    outcome = { ok: false, reason: `The search failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  const response: OptimizerWorkerResponse = { outcome, ms: performance.now() - started }
  self.postMessage(response)
}
