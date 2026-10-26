import {
  enkaStoreLoader,
  fetchEnkaProfile,
  type FetchResult,
} from 'lib/games/shared/enka'
import type { EnkaZzzStore } from 'lib/games/zzz/importer/enkaParser'

// ZZZ side of the Enka.Network import, see shared/enka.ts for how profiles and store files are fetched

export { ENKA_PROXY_PATH, type FetchResult } from 'lib/games/shared/enka'

export function enkaProfilePageUrl(uid: string): string {
  return `https://enka.network/zzz/${uid}/`
}

// The raw data the importer reads, for opening in a tab and saving as a file when the proxy isn't available
export function enkaProfileApiUrl(uid: string): string {
  return `https://enka.network/api/zzz/uid/${uid}`
}

export function isValidZzzUid(uid: string): boolean {
  return /^\d{8,11}$/.test(uid)
}

export const loadEnkaZzzStore = enkaStoreLoader(
  ['zzz/equipments.json', 'zzz/avatars.json', 'zzz/locs.json'],
  ([equipments, avatars, locs]): EnkaZzzStore => ({
    equipments: equipments as EnkaZzzStore['equipments'],
    avatars: avatars as EnkaZzzStore['avatars'],
    locs: (locs as Record<string, Record<string, string>>).en ?? {},
  }),
)

export async function fetchEnkaZzzProfile(uid: string, now = Date.now()): Promise<FetchResult<unknown>> {
  if (!isValidZzzUid(uid)) return { ok: false, reason: 'A ZZZ UID is 8 to 11 digits' }
  return fetchEnkaProfile(`/api/zzz/uid/${uid}`, now)
}
