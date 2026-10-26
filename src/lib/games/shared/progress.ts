// Progress reports from the gear searches, shared by the three optimizers and the worker runner

export type SearchProgress = {
  // Partial and full builds looked at so far
  visited: number,
  // 0-1, how far through the search's outer loops it is (pruned branches finish instantly, so it can jump)
  fraction: number,
}

export type ProgressCallback = (progress: SearchProgress) => void

// What a worker posts while it searches; anything else it posts is the final result
export type ProgressMessage = { progress: SearchProgress }

export function isProgressMessage(data: unknown): data is ProgressMessage {
  return typeof data === 'object' && data !== null && 'progress' in data
}

// How often a search checks the clock: every 4096 visits
export const PROGRESS_CHECK_MASK = 4095

// Calls onProgress at most once per interval, so a fast search doesn't flood the page with messages
export function throttleProgress(onProgress: ProgressCallback | undefined, intervalMs = 100): ProgressCallback | undefined {
  if (!onProgress) return undefined
  let last = 0
  return (progress) => {
    const now = Date.now()
    if (now - last < intervalMs) return
    last = now
    onProgress(progress)
  }
}

// Progress through two nested loops: the outer one at index outer of outerLength, the inner one at inner of innerLength
export function nestedFraction(outer: number, outerLength: number, inner: number, innerLength: number): number {
  if (outerLength === 0) return 0
  return Math.min(1, (outer + (innerLength > 0 ? inner / innerLength : 0)) / outerLength)
}
