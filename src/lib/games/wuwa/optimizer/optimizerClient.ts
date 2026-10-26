import { createWorkerRunner } from 'lib/games/shared/workerRunner'
import type { EchoRequest } from 'lib/games/wuwa/optimizer/echoOptimizer'
import type { EchoWorkerResponse } from 'lib/games/wuwa/optimizer/optimizerWorker'
import OptimizerWorker from 'lib/games/wuwa/optimizer/optimizerWorker.ts?worker'

// The echo search in a web worker, one at a time, see shared/workerRunner.ts

const runner = createWorkerRunner<EchoRequest, EchoWorkerResponse>(
  () => new OptimizerWorker(),
  (message) => ({ outcome: { ok: false, reason: `The search failed: ${message}` }, ms: 0 }),
)

export const runEchoOptimizer = runner.run
export const cancelEchoOptimizer = runner.cancel
