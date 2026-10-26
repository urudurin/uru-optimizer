import type { ProgressMessage } from 'lib/games/shared/progress'
import {
  type EchoOutcome,
  type EchoRequest,
  optimizeEchoes,
} from 'lib/games/wuwa/optimizer/echoOptimizer'

// Runs the echo search off the main thread, see optimizerClient.ts

export type EchoWorkerResponse = { outcome: EchoOutcome, ms: number }

self.onmessage = (e: MessageEvent<EchoRequest>) => {
  const started = performance.now()
  let outcome: EchoOutcome
  try {
    outcome = optimizeEchoes({ ...e.data, onProgress: (progress) => self.postMessage({ progress } satisfies ProgressMessage) })
  } catch (error) {
    outcome = { ok: false, reason: `The search failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  const response: EchoWorkerResponse = { outcome, ms: performance.now() - started }
  self.postMessage(response)
}
