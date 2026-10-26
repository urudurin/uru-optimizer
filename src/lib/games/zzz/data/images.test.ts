import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

// Small copies of Enka's ZZZ store files, just the fields the image map reads
const FILES: Record<string, unknown> = {
  'zzz/avatars.json': { 1091: { Image: '/ui/zzz/IconRole13.png', CircleIcon: '/ui/zzz/IconRoleCircle13.png', Colors: { Accent: '#5ed6f2' } } },
  'zzz/weapons.json': { 14109: { ImagePath: '/ui/zzz/Weapon_S_1091.png' } },
  'zzz/equipments.json': { Items: {}, Suits: { 31000: { Icon: '/ui/zzz/SuitWoodpeckerElectro.png', Name: 'EquipmentSuit_31000_name' } } },
  'zzz/locs.json': { en: { EquipmentSuit_31000_name: 'Woodpecker Electro' } },
}

describe('ZZZ images', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('maps agents, W-Engines and disc sets (by our set id) to Enka image addresses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const file = Object.keys(FILES).find((path) => url.endsWith(path))
        return new Response(JSON.stringify(file ? FILES[file] : {}), { status: file ? 200 : 404 })
      }),
    )
    const { loadZzzImages } = await import('lib/games/zzz/data/images')
    const result = await loadZzzImages()
    if (!result.ok) throw new Error(result.reason)

    expect(result.data.agents['1091']).toEqual({
      portrait: 'https://enka.network/ui/zzz/IconRole13.png',
      circle: 'https://enka.network/ui/zzz/IconRoleCircle13.png',
      accent: '#5ed6f2',
    })
    expect(result.data.wEngines['14109']).toBe('https://enka.network/ui/zzz/Weapon_S_1091.png')
    expect(result.data.sets['woodpecker-electro']).toBe('https://enka.network/ui/zzz/SuitWoodpeckerElectro.png')
  })
})
