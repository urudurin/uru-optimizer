import { loadEnkaGenshinStore } from 'lib/games/genshin/importer/enkaClient'
import { parseEnkaGenshin } from 'lib/games/genshin/importer/enkaParser'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import type { FetchResult } from 'lib/games/shared/enka'
import { todayString } from 'lib/games/shared/importedPresets'

// Converts an Enka Genshin profile and merges it into the saved characters and artifacts. Always merges, an Enka
// profile only covers the showcased characters. Returns a one-line summary
export async function importEnkaGenshinProfile(data: unknown): Promise<FetchResult<string>> {
  const store = await loadEnkaGenshinStore()
  if (!store.ok) return store

  const parsed = parseEnkaGenshin(data, store.data, todayString(new Date()))
  useGenshinStore.getState().importParsed(parsed, 'merge')
  if (parsed.characters.length === 0) return { ok: false, reason: parsed.warnings[0] ?? 'Nothing to import from this profile' }

  const names = parsed.characters.map((c) => c.name).join(', ')
  return {
    ok: true,
    data: `Imported ${parsed.characters.length} characters and ${parsed.artifacts.length} artifacts${parsed.uid ? ` from UID ${parsed.uid}` : ''}: ${names}`,
  }
}
