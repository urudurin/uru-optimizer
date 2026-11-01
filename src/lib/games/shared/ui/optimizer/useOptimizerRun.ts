import type { SearchProgress } from 'lib/games/shared/progress'
import type { WorkerRunner } from 'lib/games/shared/workerRunner'
import { useState } from 'react'

type RequestOf<R> = R extends WorkerRunner<infer Q, unknown> ? Q : never
type ResponseOf<R> = R extends WorkerRunner<never, infer S> ? S : never

// One optimizer search on a page, shared by the ZZZ, Genshin and WuWa optimizers (after HSR's optimizer tab, which keeps
// this in one place): whether it's running, its progress, the result, the picked build, Start and Cancel. toResult turns
// the worker's response into what the page keeps (e.g. with the target it was ranked by)

export function useOptimizerRun<Result, Runner extends WorkerRunner<never, unknown>>(runner: Runner) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SearchProgress | undefined>()
  const [result, setResult] = useState<Result | undefined>()
  const [selected, setSelected] = useState(0)

  async function start(request: RequestOf<Runner>, toResult: (response: ResponseOf<Runner>) => Result) {
    setRunning(true)
    setProgress(undefined)
    const response = (await runner.run(request as never, setProgress)) as ResponseOf<Runner> | undefined
    // undefined: cancelled, or replaced by a newer search that is still running
    if (response) {
      setResult(toResult(response))
      setSelected(0)
      setRunning(false)
    }
  }

  function cancel() {
    runner.cancel()
    setRunning(false)
  }

  return { running, progress, result, setResult, selected, setSelected, start, cancel, clear: () => setResult(undefined) }
}
