import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

describe('Enka proxy address', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses the dev server route by default', async () => {
    vi.stubEnv('VITE_ENKA_PROXY_URL', '')
    const { ENKA_PROXY_PATH } = await import('lib/games/shared/enka')
    expect(ENKA_PROXY_PATH).toBe('/enka-proxy')
  })

  it('uses the hosted proxy when the build sets one', async () => {
    vi.stubEnv('VITE_ENKA_PROXY_URL', 'https://uru-enka-proxy.example.workers.dev/')
    const { ENKA_PROXY_PATH } = await import('lib/games/shared/enka')
    expect(ENKA_PROXY_PATH).toBe('https://uru-enka-proxy.example.workers.dev')
  })
})
