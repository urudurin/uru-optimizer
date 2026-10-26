import type { OptimizerRequest } from 'lib/games/genshin/optimizer/artifactOptimizer'
import type { OptimizerWorkerResponse } from 'lib/games/genshin/optimizer/optimizerWorker'
import OptimizerWorker from 'lib/games/genshin/optimizer/optimizerWorker.ts?worker'

// One search at a time: starting a new one (or cancelling) stops the old worker, so its result never arrives

let running: { worker: Worker, resolve: (value: OptimizerWorkerResponse | undefined) => void } | undefined

export function cancelOptimizer() {
  if (!running) return
  running.worker.terminate()
  running.resolve(undefined)
  running = undefined
}

// Resolves undefined when cancelled
export function runOptimizer(request: OptimizerRequest): Promise<OptimizerWorkerResponse | undefined> {
  cancelOptimizer()
  return new Promise((resolve) => {
    const worker = new OptimizerWorker()
    const current = { worker, resolve }
    running = current
    const finish = (response: OptimizerWorkerResponse | undefined) => {
      worker.terminate()
      if (running === current) running = undefined
      resolve(response)
    }
    worker.onmessage = (e: MessageEvent<OptimizerWorkerResponse>) => finish(e.data)
    worker.onerror = (e) => finish({ outcome: { ok: false, reason: `The search failed: ${e.message}` }, ms: 0 })
    worker.postMessage(request)
  })
}
