// Runs one search at a time in a web worker, shared by the gear optimizers. Starting a new search (or cancelling) stops
// the old worker, so its result never arrives. The worker posts back a single message with the result.

export type WorkerRunner<Request, Response> = {
  // Resolves undefined when cancelled or replaced by a newer search
  run: (request: Request) => Promise<Response | undefined>,
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

  const run = (request: Request) => {
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
      worker.onmessage = (e: MessageEvent<Response>) => finish(e.data)
      worker.onerror = (e) => finish(onError(e.message))
      worker.postMessage(request)
    })
  }

  return { run, cancel }
}
