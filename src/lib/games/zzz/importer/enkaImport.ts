import {
  type FetchResult,
  loadEnkaZzzStore,
} from 'lib/games/zzz/importer/enkaClient'
import { parseEnkaZzz } from 'lib/games/zzz/importer/enkaParser'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'

// Converts an Enka ZZZ profile and merges it into the saved discs and builds. Always merges, an Enka profile only
// covers the showcased agents and must never wipe the rest of the inventory. Returns a one-line summary
export async function importEnkaZzzProfile(data: unknown): Promise<FetchResult<string>> {
  const store = await loadEnkaZzzStore()
  if (!store.ok) return store

  const { discs, builds, importParsed } = useZzzStore.getState()
  const parsed = parseEnkaZzz(data, store.data, { discs, builds })
  importParsed(parsed, 'merge')
  if (parsed.builds.length === 0) return { ok: false, reason: parsed.warnings[0]?.message ?? 'Nothing to import from this profile' }

  const names = parsed.builds.map((b) => b.name).join(', ')
  return { ok: true, data: `Imported ${parsed.builds.length} agents and ${parsed.discs.length} discs${parsed.uid ? ` from UID ${parsed.uid}` : ''}: ${names}` }
}
