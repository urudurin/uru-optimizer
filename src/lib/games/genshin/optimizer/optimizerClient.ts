import type { OptimizerRequest } from 'lib/games/genshin/optimizer/artifactOptimizer'
import type { OptimizerWorkerResponse } from 'lib/games/genshin/optimizer/optimizerWorker'
import { createWorkerRunner } from 'lib/games/shared/workerRunner'
import { WorkerType } from 'lib/worker/workerUtils'

// The artifact search in HSR's worker pool, one at a time, see shared/workerRunner.ts

// The runner itself, for shared/ui/optimizer/useOptimizerRun.ts
export const artifactSearch = createWorkerRunner<OptimizerRequest, OptimizerWorkerResponse>(
  WorkerType.GENSHIN_ARTIFACT_SEARCH,
  (message) => ({ outcome: { ok: false, reason: `The search failed: ${message}` }, ms: 0 }),
)

export const runOptimizer = artifactSearch.run
export const cancelOptimizer = artifactSearch.cancel
