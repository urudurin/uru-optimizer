import {
  isProgressMessage,
  type ProgressCallback,
} from 'lib/games/shared/progress'

// Runs one search at a time in a web worker, shared by the gear optimizers. Starting a new search (or cancelling) stops
// the old worker, so its result never arrives. The worker posts progress messages (see progress.ts) while it works,
// then one message with the result.

export type WorkerRunner<Request, Response> = {
  // Resolves undefined when cancelled or replaced by a newer search
  run: (request: Request, onProgress?: ProgressCallback) => Promise<Response | undefined>,
  cancel: () => void,
}

export function createWorkerRunner<Request, Response>(
  createWorker: () => Worker,
  onError: (message: string) => Response,
): WorkerRunner<Request, Response> {
  let running: { worker: Worker, resolve: (value: Response | undefined) => void } | undefined

  const cancel = () => {
    if (!running) return
    running.worker.terminate()
    running.resolve(undefined)
    running = undefined
  }

  const run = (request: Request, onProgress?: ProgressCallback) => {
    cancel()
    return new Promise<Response | undefined>((resolve) => {
      const worker = createWorker()
      const current = { worker, resolve }
      running = current
      const finish = (response: Response | undefined) => {
        worker.terminate()
        if (running === current) running = undefined
        resolve(response)
      }
      worker.onmessage = (e: MessageEvent<unknown>) => {
        if (isProgressMessage(e.data)) onProgress?.(e.data.progress)
        else finish(e.data as Response)
      }
      worker.onerror = (e) => finish(onError(e.message))
      worker.postMessage(request)
    })
  }

  return { run, cancel }
}
