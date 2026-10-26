import type { OptimizerRequest } from 'lib/games/genshin/optimizer/artifactOptimizer'
import type { OptimizerWorkerResponse } from 'lib/games/genshin/optimizer/optimizerWorker'
import OptimizerWorker from 'lib/games/genshin/optimizer/optimizerWorker.ts?worker'
import { createWorkerRunner } from 'lib/games/shared/workerRunner'

// The artifact search in a web worker, one at a time, see shared/workerRunner.ts

const runner = createWorkerRunner<OptimizerRequest, OptimizerWorkerResponse>(
  () => new OptimizerWorker(),
  (message) => ({ outcome: { ok: false, reason: `The search failed: ${message}` }, ms: 0 }),
)

export const runOptimizer = runner.run
export const cancelOptimizer = runner.cancel
