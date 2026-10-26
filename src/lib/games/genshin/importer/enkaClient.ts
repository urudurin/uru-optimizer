import type { EnkaGenshinStore } from 'lib/games/genshin/importer/enkaParser'
import {
  enkaStoreLoader,
  fetchEnkaProfile,
  type FetchResult,
} from 'lib/games/shared/enka'

// Genshin side of the Enka.Network import, see shared/enka.ts for how profiles and store files are fetched

export function enkaProfilePageUrl(uid: string): string {
  return `https://enka.network/u/${uid}/`
}

// The raw data the importer reads, for opening in a tab and saving as a file when the proxy isn't available
export function enkaProfileApiUrl(uid: string): string {
  return `https://enka.network/api/uid/${uid}/`
}

export function isValidGenshinUid(uid: string): boolean {
  return /^\d{9,10}$/.test(uid)
}

export const loadEnkaGenshinStore = enkaStoreLoader(
  ['gi/avatars.json', 'gi/locs.json', 'gi/relics.json', 'gi/affixes.json', 'gi/relic_levels.json', 'gi/weapons.json'],
  ([avatars, locs, relics, affixes, relicLevels, weapons]): EnkaGenshinStore => ({
    avatars: avatars as EnkaGenshinStore['avatars'],
    locs: (locs as Record<string, Record<string, string>>).en ?? {},
    sets: ((relics as { Sets?: EnkaGenshinStore['sets'] }).Sets) ?? {},
    affixes: affixes as EnkaGenshinStore['affixes'],
    relicLevels: relicLevels as EnkaGenshinStore['relicLevels'],
    weapons: weapons as EnkaGenshinStore['weapons'],
  }),
)

export async function fetchEnkaGenshinProfile(uid: string, now = Date.now()): Promise<FetchResult<unknown>> {
  if (!isValidGenshinUid(uid)) return { ok: false, reason: 'A Genshin UID is 9 or 10 digits' }
  return fetchEnkaProfile(`/api/uid/${uid}/`, now)
}
