import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  allowedOrigin,
  handleRequest,
  isAllowedPath,
  type ProfileCache,
  USER_AGENT,
} from './proxy'

const env = { ALLOWED_ORIGINS: 'https://urudurin.github.io, http://localhost:3000/' }
const SITE = 'https://urudurin.github.io'

function request(path: string, init: { method?: string, origin?: string | null } = {}) {
  const headers = new Headers()
  if (init.origin !== null) headers.set('Origin', init.origin ?? SITE)
  return new Request(`https://proxy.example.workers.dev${path}`, { method: init.method ?? 'GET', headers })
}

function enka(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

function memoryCache(): ProfileCache & { entries: Map<string, Response> } {
  const entries = new Map<string, Response>()
  return {
    entries,
    match: async (key) => entries.get(key.url)?.clone(),
    put: async (key, response) => void entries.set(key.url, response),
  }
}

describe('Enka proxy', () => {
  it('only allows Genshin and ZZZ profile paths with a valid UID', () => {
    expect(isAllowedPath('/api/uid/602175084/')).toBe(true)
    expect(isAllowedPath('/api/zzz/uid/1000074590')).toBe(true)
    expect(isAllowedPath('/api/uid/123')).toBe(false)
    expect(isAllowedPath('/api/hsr/uid/602175084')).toBe(false)
    expect(isAllowedPath('/u/602175084/')).toBe(false)
    expect(isAllowedPath('/api/uid/602175084/../../secret')).toBe(false)
  })

  it('only answers the listed sites', async () => {
    expect(allowedOrigin('http://localhost:3000', env)).toBe('http://localhost:3000')
    expect(allowedOrigin('https://evil.example', env)).toBeUndefined()

    const fetcher = enka({})
    expect((await handleRequest(request('/api/uid/602175084/', { origin: 'https://evil.example' }), env, fetcher)).status).toBe(403)
    expect((await handleRequest(request('/api/uid/602175084/', { origin: null }), env, fetcher)).status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('forwards a profile with the custom User-Agent and CORS headers', async () => {
    const fetcher = enka({ uid: '602175084', ttl: 30 })
    const response = await handleRequest(request('/api/uid/602175084/'), env, fetcher)

    expect(fetcher).toHaveBeenCalledWith('https://enka.network/api/uid/602175084/', { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } })
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(SITE)
    expect(await response.json()).toEqual({ uid: '602175084', ttl: 30 })
  })

  it('caches each profile for its ttl and serves repeats from the cache', async () => {
    const cache = memoryCache()
    const fetcher = enka({ uid: '602175084', ttl: 45 })
    await handleRequest(request('/api/uid/602175084/'), env, fetcher, cache)
    const again = await handleRequest(request('/api/uid/602175084/'), env, fetcher, cache)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(cache.entries.get('https://enka.network/api/uid/602175084/')?.headers.get('Cache-Control')).toBe('public, max-age=45')
    expect(again.headers.get('X-Proxy-Cache')).toBe('hit')
    expect(await again.json()).toEqual({ uid: '602175084', ttl: 45 })
  })

  it('passes Enka\'s errors through without caching them, and refuses everything else', async () => {
    const cache = memoryCache()
    const notFound = await handleRequest(request('/api/zzz/uid/10000001'), env, enka({ error: 'not found' }, 404), cache)
    expect(notFound.status).toBe(404)
    expect(cache.entries.size).toBe(0)

    expect((await handleRequest(request('/api/uid/602175084/', { method: 'POST' }), env, enka({}))).status).toBe(405)
    expect((await handleRequest(request('/u/602175084/'), env, enka({}))).status).toBe(404)
    const preflight = await handleRequest(request('/api/uid/602175084/', { method: 'OPTIONS' }), env, enka({}))
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')

    const unreachable = await handleRequest(request('/api/uid/602175084/'), env, vi.fn(async () => Promise.reject(new Error('down'))))
    expect(unreachable.status).toBe(502)
  })
})
