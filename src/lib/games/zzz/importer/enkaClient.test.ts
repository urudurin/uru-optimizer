import {
  enkaProfileApiUrl,
  fetchEnkaZzzProfile,
  isValidZzzUid,
} from 'lib/games/zzz/importer/enkaClient'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('Enka client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks UIDs and builds the raw data link', () => {
    expect(isValidZzzUid('1000074590')).toBe(true)
    expect(isValidZzzUid('12a')).toBe(false)
    expect(enkaProfileApiUrl('1000074590')).toBe('https://enka.network/api/zzz/uid/1000074590')
  })

  it('reuses a profile until its ttl runs out', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ uid: '10000001', ttl: 60, PlayerInfo: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchEnkaZzzProfile('10000001', 0)
    await fetchEnkaZzzProfile('10000001', 59_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await fetchEnkaZzzProfile('10000001', 61_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('/enka-proxy/api/zzz/uid/10000001')
  })

  it('explains failures in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 404)))
    expect(await fetchEnkaZzzProfile('10000002')).toEqual({ ok: false, reason: 'No player with that UID, or their showcase isn\'t public' })

    // Without the dev server the route returns the site's own HTML page
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })))
    const result = await fetchEnkaZzzProfile('10000003')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toContain('needs the site running locally')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    expect(await fetchEnkaZzzProfile('10000004')).toEqual({ ok: false, reason: 'Couldn\'t reach Enka.Network' })
    expect(await fetchEnkaZzzProfile('abc')).toEqual({ ok: false, reason: 'A ZZZ UID is 8 to 11 digits' })
  })
})
