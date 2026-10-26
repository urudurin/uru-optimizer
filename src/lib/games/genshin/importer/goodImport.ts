import { loadEnkaGenshinStore } from 'lib/games/genshin/importer/enkaClient'
import { parseGood } from 'lib/games/genshin/importer/goodParser'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import type { FetchResult } from 'lib/games/shared/enka'
import { formatNumber } from 'lib/games/shared/format'
import { todayString } from 'lib/games/shared/importedPresets'

// Converts a GOOD file and saves it. A GOOD file is the whole inventory, so it replaces the saved artifacts and
// characters; Enka stats of characters still in the file are kept (see mergeGenshinData). A file with artifacts but no
// characters keeps the saved characters, without the artifacts they had on. Returns a one-line summary
export async function importGoodFile(data: unknown): Promise<FetchResult<string>> {
  const store = await loadEnkaGenshinStore()
  if (!store.ok) return store

  const parsed = parseGood(data, store.data, todayString(new Date()))
  if (parsed.artifacts.length === 0 && parsed.characters.length === 0) {
    useGenshinStore.getState().importParsed(parsed, 'replace')
    return { ok: false, reason: parsed.warnings[0] ?? 'The GOOD file has no artifacts or characters' }
  }
  const characters = parsed.characters.length > 0
    ? parsed.characters
    : useGenshinStore.getState().characters.map((c) => ({ ...c, artifactIds: {} }))
  useGenshinStore.getState().importParsed({ ...parsed, characters }, 'replace')

  const equipped = parsed.artifacts.filter((a) => a.equippedBy).length
  return {
    ok: true,
    data: `Imported ${formatNumber(parsed.artifacts.length)} artifacts (${formatNumber(equipped)} equipped) and ${
      formatNumber(parsed.characters.length)
    } characters${parsed.source ? ` from ${parsed.source}` : ''}`,
  }
}
