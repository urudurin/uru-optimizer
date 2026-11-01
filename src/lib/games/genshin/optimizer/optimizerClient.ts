import type { OptimizerRequest } from 'lib/games/genshin/optimizer/artifactOptimizer'
import type { OptimizerWorkerResponse } from 'lib/games/genshin/optimizer/optimizerWorker'
import OptimizerWorker from 'lib/games/genshin/optimizer/optimizerWorker.ts?worker'
import { createWorkerRunner } from 'lib/games/shared/workerRunner'

// The artifact search in a web worker, one at a time, see shared/workerRunner.ts

// The runner itself, for shared/ui/optimizer/useOptimizerRun.ts
export const artifactSearch = createWorkerRunner<OptimizerRequest, OptimizerWorkerResponse>(
  () => new OptimizerWorker(),
  (message) => ({ outcome: { ok: false, reason: `The search failed: ${message}` }, ms: 0 }),
)

export const runOptimizer = artifactSearch.run
export const cancelOptimizer = artifactSearch.cancel
