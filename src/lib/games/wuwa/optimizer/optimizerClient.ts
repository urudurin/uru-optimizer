import { createWorkerRunner } from 'lib/games/shared/workerRunner'
import type { EchoRequest } from 'lib/games/wuwa/optimizer/echoOptimizer'
import type { EchoWorkerResponse } from 'lib/games/wuwa/optimizer/optimizerWorker'
import { WorkerType } from 'lib/worker/workerUtils'

// The echo search in HSR's worker pool, one at a time, see shared/workerRunner.ts

// The runner itself, for shared/ui/optimizer/useOptimizerRun.ts
export const echoSearch = createWorkerRunner<EchoRequest, EchoWorkerResponse>(
  WorkerType.WUWA_ECHO_SEARCH,
  (message) => ({ outcome: { ok: false, reason: `The search failed: ${message}` }, ms: 0 }),
)

export const runEchoOptimizer = echoSearch.run
export const cancelEchoOptimizer = echoSearch.cancel
