import { createWorkerRunner } from 'lib/games/shared/workerRunner'
import type {
  DiscWorkerRequest,
  DiscWorkerResponse,
} from 'lib/games/zzz/optimizer/optimizerWorker'
import { WorkerType } from 'lib/worker/workerUtils'

// The disc search in HSR's worker pool, one at a time, see shared/workerRunner.ts

// The runner itself, for shared/ui/optimizer/useOptimizerRun.ts
export const discSearch = createWorkerRunner<DiscWorkerRequest, DiscWorkerResponse>(
  WorkerType.ZZZ_DISC_SEARCH,
  (message) => ({ outcome: { ok: false, reason: `The search failed: ${message}` }, ms: 0 }),
)

export const runDiscOptimizer = discSearch.run
export const cancelDiscOptimizer = discSearch.cancel
