// Enka.Network access shared by the ZZZ and Genshin imports. Enka doesn't accept requests made directly from other
// sites' pages, so player profiles go through a proxy: the dev server's /enka-proxy route (vite.config.ts) under
// npm start, or the hosted Cloudflare Worker in workers/enka-proxy when the site is built with VITE_ENKA_PROXY_URL set.
// Enka's store files (ids to names) come from GitHub, which allows cross-site requests, and are downloaded at import
// time rather than copied into this repo. Enka asks callers to cache each profile until its ttl runs out.

// The hosted proxy's address from the build, e.g. https://uru-enka-proxy.<account>.workers.dev, else the dev server's.
// Written exactly as import.meta.env.VITE_..., the form Vite replaces at build time
const HOSTED_PROXY = import.meta.env.VITE_ENKA_PROXY_URL
export const ENKA_PROXY_PATH = HOSTED_PROXY ? HOSTED_PROXY.replace(/\/$/, '') : '/enka-proxy'
export const ENKA_STORE_BASE = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store'

export type FetchResult<T> = { ok: true, data: T } | { ok: false, reason: string }

const STATUS_MESSAGES: Record<number, string> = {
  400: 'That UID isn\'t valid',
  403: 'The Enka proxy doesn\'t accept requests from this site, add it to the proxy\'s ALLOWED_ORIGINS',
  404: 'No player with that UID, or their showcase isn\'t public',
  424: 'The game is under maintenance, try again later',
  429: 'Enka is rate limiting requests, wait a minute and try again',
  500: 'Enka\'s server had a problem, try again later',
  503: 'Enka is temporarily unavailable, try again later',
}

const profileCache = new Map<string, { data: unknown, expires: number }>()

// apiPath is the part after https://enka.network, e.g. /api/zzz/uid/1000074590.
// Reuses the last answer for the same path until Enka's ttl runs out
export async function fetchEnkaProfile(apiPath: string, now = Date.now()): Promise<FetchResult<unknown>> {
  const cached = profileCache.get(apiPath)
  if (cached && cached.expires > now) return { ok: true, data: cached.data }

  let response: Response
  try {
    response = await fetch(`${ENKA_PROXY_PATH}${apiPath}`)
  } catch {
    return { ok: false, reason: 'Couldn\'t reach Enka.Network' }
  }
  // Without the dev server the route falls through to the site's own page
  if (!(response.headers.get('content-type') ?? '').includes('json')) {
    return {
      ok: false,
      reason:
        'One-click import needs the site running locally (npm start) or a hosted Enka proxy (workers/enka-proxy). Use "Open my Enka data" instead and import the saved file',
    }
  }
  if (!response.ok) return { ok: false, reason: STATUS_MESSAGES[response.status] ?? `Enka answered with HTTP ${response.status}` }

  const data: unknown = await response.json()
  const ttl = typeof (data as { ttl?: unknown }).ttl === 'number' ? (data as { ttl: number }).ttl : 60
  profileCache.set(apiPath, { data, expires: now + ttl * 1000 })
  return { ok: true, data }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// Downloads several store files (paths under ENKA_STORE_BASE) once per page visit and builds the game's store from them
export function enkaStoreLoader<T>(paths: string[], build: (files: unknown[]) => T): () => Promise<FetchResult<T>> {
  let pending: Promise<T> | undefined
  return async () => {
    pending ??= Promise.all(paths.map((path) => fetchJson(`${ENKA_STORE_BASE}/${path}`))).then(build)
    try {
      return { ok: true, data: await pending }
    } catch (e) {
      pending = undefined
      return { ok: false, reason: `Couldn't load Enka's game data from GitHub (${e instanceof Error ? e.message : String(e)})` }
    }
  }
}

// A saved Enka profile file, or undefined for any other text. Never throws
export function parseJsonOrUndefined(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
