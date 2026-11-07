import { createWorkerRunner } from 'lib/games/shared/workerRunner'
import {
  type EchoRequest,
  mergeEchoOutcomes,
} from 'lib/games/wuwa/optimizer/echoOptimizer'
import type { EchoWorkerResponse } from 'lib/games/wuwa/optimizer/optimizerWorker'
import { WorkerType } from 'lib/worker/workerUtils'

// The echo search in HSR's worker pool, one at a time, split across the pool's workers (shared/workerRunner.ts)

// The runner itself, for shared/ui/optimizer/useOptimizerRun.ts
export const echoSearch = createWorkerRunner<EchoRequest, EchoWorkerResponse>(
  WorkerType.WUWA_ECHO_SEARCH,
  (message) => ({ outcome: { ok: false, reason: `The search failed: ${message}` }, ms: 0 }),
  {
    merge: (parts, request) => ({
      outcome: mergeEchoOutcomes(parts.map((part) => part.outcome), request.limit),
      // The parts run at the same time
      ms: Math.max(...parts.map((part) => part.ms)),
    }),
  },
)

export const runEchoOptimizer = echoSearch.run
export const cancelEchoOptimizer = echoSearch.cancel
