// A small proxy for Enka.Network player profiles, so the hosted site can use one-click Enka import. Enka doesn't
// accept requests made from other sites' pages, so the site asks this worker, which asks Enka.
// Deliberately narrow, so it can't be used as an open proxy:
//   - only GET requests for a Genshin (/api/uid/<uid>) or ZZZ (/api/zzz/uid/<uid>) profile with a valid UID
//   - only for the sites listed in ALLOWED_ORIGINS
// Follows Enka's API guidelines (https://api.enka.network): a custom User-Agent, and each profile is cached until its
// ttl runs out so repeat imports don't reach Enka. Personal, non-commercial use.

export type Env = {
  // Comma-separated origins allowed to use the proxy, e.g. "https://urudurin.github.io,http://localhost:3000"
  ALLOWED_ORIGINS: string,
}

// The parts of the Workers cache this uses, so tests can pass their own
export type ProfileCache = {
  match: (key: Request) => Promise<Response | undefined>,
  put: (key: Request, response: Response) => Promise<void>,
}

export const ENKA_ORIGIN = 'https://enka.network'
export const USER_AGENT = 'uru-optimizer-enka-proxy/1.0 (personal tool, https://github.com/urudurin/uru-optimizer)'
const DEFAULT_TTL_SECONDS = 60

// Genshin UIDs are 9-10 digits, ZZZ UIDs 8-10
const PROFILE_PATH = /^\/api\/(?:uid\/\d{9,10}|zzz\/uid\/\d{8,10})\/?$/

export function isAllowedPath(path: string): boolean {
  return PROFILE_PATH.test(path)
}

export function allowedOrigin(origin: string | null, env: Env): string | undefined {
  if (!origin) return undefined
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)
  return allowed.includes(origin) ? origin : undefined
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    // Lets the page see whether the profile came from the cache
    'Access-Control-Expose-Headers': 'X-Proxy-Cache',
    'Vary': 'Origin',
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

// Enka's ttl for this profile, in seconds, from the response body
async function ttlOf(response: Response): Promise<number> {
  try {
    const body: unknown = await response.clone().json()
    const ttl = typeof body === 'object' && body !== null ? (body as { ttl?: unknown }).ttl : undefined
    return typeof ttl === 'number' && ttl > 0 ? ttl : DEFAULT_TTL_SECONDS
  } catch {
    return DEFAULT_TTL_SECONDS
  }
}

export async function handleRequest(request: Request, env: Env, fetcher: typeof fetch, cache?: ProfileCache): Promise<Response> {
  const origin = allowedOrigin(request.headers.get('Origin'), env)
  if (!origin) return json(403, { error: 'This proxy only answers the uru-optimizer site' })
  const cors = corsHeaders(origin)

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'GET') return json(405, { error: 'Only GET requests' }, cors)

  const path = new URL(request.url).pathname
  if (!isAllowedPath(path)) return json(404, { error: 'Only Genshin and ZZZ player profiles' }, cors)

  // Cached per Enka URL, shared by every visitor
  const key = new Request(`${ENKA_ORIGIN}${path}`)
  const cached = await cache?.match(key)
  if (cached) return new Response(cached.body, { status: cached.status, headers: { ...Object.fromEntries(cached.headers), ...cors, 'X-Proxy-Cache': 'hit' } })

  let upstream: Response
  try {
    upstream = await fetcher(key.url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } })
  } catch {
    return json(502, { error: 'Couldn\'t reach Enka.Network' }, cors)
  }

  const body = await upstream.text()
  const headers = { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' }
  if (upstream.ok && cache) {
    const ttl = await ttlOf(new Response(body))
    await cache.put(key, new Response(body, { status: upstream.status, headers: { ...headers, 'Cache-Control': `public, max-age=${ttl}` } }))
  }
  return new Response(body, { status: upstream.status, headers: { ...headers, ...cors, 'X-Proxy-Cache': 'miss' } })
}
