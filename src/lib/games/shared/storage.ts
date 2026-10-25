// Save, load and merge helpers shared by the non-HSR games. Each game keeps its own localStorage key and save shape,
// so HSR's 'state' save is never read or written.

export type ImportMode = 'replace' | 'merge'

// 'merge' keeps what's already stored and lets incoming entries win on the same id
export function mergeById<T extends { id: string }>(existing: T[], incoming: T[], mode: ImportMode): T[] {
  if (mode === 'replace') return incoming

  const byId = new Map(existing.map((item) => [item.id, item]))
  for (const item of incoming) {
    byId.set(item.id, item)
  }
  return [...byId.values()]
}

export function hasStringId(value: unknown): value is { id: string } {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string'
}

// Never throws: storage can be missing or blocked (private mode, tests)
export function readStorage(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  } catch {
    return null
  }
}

// Never throws, returns false when the value couldn't be saved (storage blocked or full)
export function writeStorage(key: string, text: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(key, text)
    return true
  } catch {
    return false
  }
}

// Reads a save written as { version, ...fields }. Undefined when it's missing, corrupted or from another version
export function parseVersionedSave(text: string | null, version: number): Record<string, unknown> | undefined {
  if (!text) return undefined
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
    const save = parsed as Record<string, unknown>
    return save.version === version ? save : undefined
  } catch {
    return undefined
  }
}
