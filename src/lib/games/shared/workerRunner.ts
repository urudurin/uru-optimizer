import {
  isProgressMessage,
  type ProgressCallback,
} from 'lib/games/shared/progress'
import {
  WorkerCancelledError,
  workerPool,
} from 'lib/worker/workerPool'
import type { WorkerType } from 'lib/worker/workerUtils'

// Runs one search at a time in HSR's worker pool (lib/worker/workerPool.ts), shared by the gear optimizers, so they
// queue, cancel and fail like HSR's own workers. Starting a new search (or cancelling) aborts the old task, whose worker
// the pool replaces, so its result never arrives. The worker posts progress messages (see progress.ts) while it works,
// then one message with the result.

export type WorkerRunner<Request, Response> = {
  // Resolves undefined when cancelled or replaced by a newer search
  run: (request: Request, onProgress?: ProgressCallback) => Promise<Response | undefined>,
  cancel: () => void,
}

export function createWorkerRunner<Request extends object, Response>(
  workerType: WorkerType,
  onError: (message: string) => Response,
): WorkerRunner<Request, Response> {
  let running: AbortController | undefined

  const cancel = () => {
    running?.abort()
    running = undefined
  }

  const run = async (request: Request, onProgress?: ProgressCallback) => {
    cancel()
    const controller = new AbortController()
    running = controller
    try {
      return await workerPool.runTask<Request & { workerType: WorkerType }, Response & object>({ ...request, workerType }, {
        signal: controller.signal,
        onInterimMessage: (data) => {
          if (!isProgressMessage(data)) return false
          onProgress?.(data.progress)
          return true
        },
      })
    } catch (error) {
      if (error instanceof WorkerCancelledError) return undefined
      return onError(error instanceof ErrorEvent ? error.message : error instanceof Error ? error.message : String(error))
    } finally {
      if (running === controller) running = undefined
    }
  }

  return { run, cancel }
}
