import {
  isProgressMessage,
  type ProgressCallback,
  type SearchPartition,
  type SearchProgress,
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
// A runner with split runs each search as one part per pool worker (the request's partition, see progress.ts), at the
// same time, and merges their results into the whole search's

export type WorkerRunner<Request, Response> = {
  // Resolves undefined when cancelled or replaced by a newer search
  run: (request: Request, onProgress?: ProgressCallback) => Promise<Response | undefined>,
  cancel: () => void,
}

export type SearchSplit<Request, Response> = {
  // The whole search's response from its parts' responses
  merge: (parts: Response[], request: Request) => Response,
}

// Parts per search: one per pool worker, at most this many (more parts repeat more of the shared first steps)
const MAX_PARTS = 4

export function createWorkerRunner<Request extends object, Response>(
  workerType: WorkerType,
  onError: (message: string) => Response,
  split?: SearchSplit<Request, Response>,
): WorkerRunner<Request, Response> {
  let running: AbortController | undefined

  const cancel = () => {
    running?.abort()
    running = undefined
  }

  const runPart = (request: Request, signal: AbortSignal, onProgress?: ProgressCallback) =>
    workerPool.runTask<Request & { workerType: WorkerType }, Response & object>({ ...request, workerType }, {
      signal,
      onInterimMessage: (data) => {
        if (!isProgressMessage(data)) return false
        onProgress?.(data.progress)
        return true
      },
    })

  const run = async (request: Request, onProgress?: ProgressCallback) => {
    cancel()
    const controller = new AbortController()
    running = controller
    try {
      if (!split) return await runPart(request, controller.signal, onProgress)
      const count = Math.max(1, Math.min(MAX_PARTS, workerPool.getPoolSize()))
      // Progress of the whole: the parts' visits added up, and how far they are on average
      const latest: SearchProgress[] = Array.from({ length: count }, () => ({ visited: 0, fraction: 0 }))
      const parts = await Promise.all(Array.from({ length: count }, (_, index) => {
        const partition: SearchPartition = { index, count }
        return runPart({ ...request, partition }, controller.signal, (progress) => {
          latest[index] = progress
          onProgress?.({
            visited: latest.reduce((sum, p) => sum + p.visited, 0),
            fraction: latest.reduce((sum, p) => sum + p.fraction, 0) / count,
          })
        })
      }))
      return split.merge(parts, request)
    } catch (error) {
      if (error instanceof WorkerCancelledError) return undefined
      // One part failing fails the search; the others stop
      controller.abort()
      return onError(error instanceof ErrorEvent ? error.message : error instanceof Error ? error.message : String(error))
    } finally {
      if (running === controller) running = undefined
    }
  }

  return { run, cancel }
}
