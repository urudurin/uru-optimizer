import { createWorkerRunner } from 'lib/games/shared/workerRunner'
import type {
  DiscWorkerRequest,
  DiscWorkerResponse,
} from 'lib/games/zzz/optimizer/optimizerWorker'
import OptimizerWorker from 'lib/games/zzz/optimizer/optimizerWorker.ts?worker'

// The disc search in a web worker, one at a time, see shared/workerRunner.ts

const runner = createWorkerRunner<DiscWorkerRequest, DiscWorkerResponse>(
  () => new OptimizerWorker(),
  (message) => ({ outcome: { ok: false, reason: `The search failed: ${message}` }, ms: 0 }),
)

export const runDiscOptimizer = runner.run
export const cancelDiscOptimizer = runner.cancel
