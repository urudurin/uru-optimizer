import type { EnkaZzzStore } from 'lib/games/zzz/importer/enkaParser'

// Browser side of the Enka.Network import: Enka's store files from GitHub (which allows cross-site requests) and
// player profiles through the dev server's /enka-proxy route (vite.config.ts), since Enka doesn't accept requests
// made directly from other sites' pages. Enka asks callers to cache each profile until its ttl runs out.

const STORE_BASE = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz'
export const ENKA_PROXY_PATH = '/enka-proxy'

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

export type FetchResult<T> = { ok: true, data: T } | { ok: false, reason: string }

let storePromise: Promise<EnkaZzzStore> | undefined

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// Loaded once per page visit
export async function loadEnkaZzzStore(): Promise<FetchResult<EnkaZzzStore>> {
  storePromise ??= Promise.all([
    fetchJson(`${STORE_BASE}/equipments.json`),
    fetchJson(`${STORE_BASE}/avatars.json`),
    fetchJson(`${STORE_BASE}/locs.json`),
  ]).then(([equipments, avatars, locs]) => ({
    equipments: equipments as EnkaZzzStore['equipments'],
    avatars: avatars as EnkaZzzStore['avatars'],
    locs: ((locs as Record<string, Record<string, string>>).en ?? {}),
  }))
  try {
    return { ok: true, data: await storePromise }
  } catch (e) {
    storePromise = undefined
    return { ok: false, reason: `Couldn't load Enka's game data from GitHub (${e instanceof Error ? e.message : String(e)})` }
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'That UID isn\'t valid',
  404: 'No player with that UID, or their showcase isn\'t public',
  424: 'The game is under maintenance, try again later',
  429: 'Enka is rate limiting requests, wait a minute and try again',
  500: 'Enka\'s server had a problem, try again later',
  503: 'Enka is temporarily unavailable, try again later',
}

const profileCache = new Map<string, { data: unknown, expires: number }>()

// Reuses the last answer for a UID until Enka's ttl runs out, as Enka asks
export async function fetchEnkaZzzProfile(uid: string, now = Date.now()): Promise<FetchResult<unknown>> {
  if (!isValidZzzUid(uid)) return { ok: false, reason: 'A ZZZ UID is 8 to 11 digits' }
  const cached = profileCache.get(uid)
  if (cached && cached.expires > now) return { ok: true, data: cached.data }

  let response: Response
  try {
    response = await fetch(`${ENKA_PROXY_PATH}/api/zzz/uid/${uid}`)
  } catch {
    return { ok: false, reason: 'Couldn\'t reach Enka.Network' }
  }
  // Without the dev server the route falls through to the site's own page
  if (!(response.headers.get('content-type') ?? '').includes('json')) {
    return {
      ok: false,
      reason: 'One-click import needs the site running locally (npm start). Use "Open my Enka data" instead and import the saved file',
    }
  }
  if (!response.ok) return { ok: false, reason: STATUS_MESSAGES[response.status] ?? `Enka answered with HTTP ${response.status}` }

  const data: unknown = await response.json()
  const ttl = typeof (data as { ttl?: unknown }).ttl === 'number' ? (data as { ttl: number }).ttl : 60
  profileCache.set(uid, { data, expires: now + ttl * 1000 })
  return { ok: true, data }
}
