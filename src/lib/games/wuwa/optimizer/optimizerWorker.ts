import type { ProgressMessage } from 'lib/games/shared/progress'
import {
  type EchoOutcome,
  type EchoRequest,
  optimizeEchoes,
} from 'lib/games/wuwa/optimizer/echoOptimizer'
import type { BaseWorkerInput } from 'lib/worker/workerPool'

// Runs the echo search in one of HSR's pooled workers (lib/worker/baseWorker.ts loads this on first use), see
// optimizerClient.ts

export type WuwaEchoWorkerInput = EchoRequest & BaseWorkerInput
export type EchoWorkerResponse = { outcome: EchoOutcome, ms: number }

export function wuwaEchoSearchWorker(e: MessageEvent<WuwaEchoWorkerInput>) {
  const started = performance.now()
  const { workerType: _, ...request } = e.data
  let outcome: EchoOutcome
  try {
    outcome = optimizeEchoes({ ...request, onProgress: (progress) => self.postMessage({ progress } satisfies ProgressMessage) })
  } catch (error) {
    outcome = { ok: false, reason: `The search failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  const response: EchoWorkerResponse = { outcome, ms: performance.now() - started }
  self.postMessage(response)
}
