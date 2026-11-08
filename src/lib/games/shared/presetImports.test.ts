import {
  GENSHIN_PRESET_RESOLVER,
  genshinMetadata,
} from 'lib/games/genshin/data/metadata'
import { genshinScoringDefaults } from 'lib/games/genshin/optimizer/damageSetup'
import {
  parseImportedMetadata,
  presetImportStore,
  withImported,
} from 'lib/games/shared/presetImports'
import { wuwaMetadata } from 'lib/games/wuwa/data/metadata'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

// Tests run without a browser, so a Map stands in for localStorage
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
})

const mizuki = {
  character: 'Yumemizuki Mizuki',
  substatPriority: ['Elemental Mastery', 'Energy Recharge', 'CRIT Rate'],
  mainStats: { sands: ['Elemental Mastery'], goblet: ['Elemental Mastery', 'Anemo DMG Bonus'], circlet: ['elementalMastery', 'CRIT Rate'] },
  sets: [['Viridescent Venerer'], ['Gilded Dreams', 'Wanderer\'s Troupe']],
  rankBy: 'damage',
  team: [{ character: 'Odette', rank: 0 }, { character: 'Faruzan', rank: 6, weapon: 'Favonius Warbow', refinement: 3 }],
  rotation: { 'reaction:swirl:Pyro': 4 },
  substats: ['Elemental Mastery'],
}
const file = (presets: unknown[], game = 'genshin') => JSON.stringify({ version: 2, game, source: 'My KQM notes', updated: '2026-11-07', presets })

describe('imported presets v2 (metadata from the user\'s own file)', () => {
  afterEach(() => {
    presetImportStore('genshin').getState().clear()
    storage.clear()
  })

  it('reads weights, mains, sets, rank, team and rotation with the game\'s names', () => {
    const parsed = parseImportedMetadata({ text: file([mizuki]), importedAt: '2026-11-08' }, 'genshin', GENSHIN_PRESET_RESOLVER)
    expect(parsed.warnings).toEqual([])
    const entry = parsed.byCharacter.YumemizukiMizuki
    expect(entry.stats).toEqual({ elementalMastery: 1, energyRecharge: 0.8, critRate: 0.6 })
    expect(entry.parts).toEqual({ sands: ['elementalMastery'], goblet: ['elementalMastery', 'anemoDmg'], circlet: ['elementalMastery', 'critRate'] })
    expect(entry.sets).toEqual([['ViridescentVenerer'], ['GildedDreams', 'WanderersTroupe']])
    expect(entry.sortOption).toBe('damage')
    expect(entry.teammates).toEqual([{ id: 'Odette', rank: 0 }, { id: 'Faruzan', rank: 6, weaponId: 'FavoniusWarbow', refinement: 3 }])
    expect(entry.rotationCounts).toEqual({ 'reaction:swirl:Pyro': 4 })
    expect(entry.reviewed).toBe('2026-11-07')
  })

  it('skips what it doesn\'t know with a warning, never throws', () => {
    const parsed = parseImportedMetadata(
      {
        text: file([{ character: 'Nobody' }, {
          character: 'Xiangling',
          mainStats: { sands: ['CRIT Rate'], hat: ['ATK%'] },
          rankBy: 'vibes',
          team: ['Xiangling'],
        }]),
        importedAt: '2026-11-08',
      },
      'genshin',
      GENSHIN_PRESET_RESOLVER,
    )
    expect(parsed.byCharacter.Xiangling.parts).toEqual({ sands: [] })
    expect(parsed.warnings).toEqual([
      'Preset 1: no character "Nobody", skipped',
      'Xiangling: "critRate" can\'t be a sands main stat, skipped',
      'Xiangling: unknown slot "hat", skipped',
      'Xiangling: can\'t rank by "vibes", skipped',
      'Xiangling: teammate "Xiangling" skipped',
    ])
    expect(parseImportedMetadata({ text: '{', importedAt: '2026-11-08' }, 'genshin', GENSHIN_PRESET_RESOLVER).warnings).toEqual(['The file isn\'t valid JSON'])
    expect(parseImportedMetadata({ text: file([], 'zzz'), importedAt: '2026-11-08' }, 'genshin', GENSHIN_PRESET_RESOLVER).warnings)
      .toEqual(['This file is for "zzz", not "genshin"'])
  })

  it('lays the import over the metadata, fills the DPS score Default, and switches off', () => {
    const before = genshinMetadata('YumemizukiMizuki', 2)
    expect(before.simulation?.teammates ?? []).toEqual([])
    presetImportStore('genshin').getState().importText(file([mizuki]))

    const after = genshinMetadata('YumemizukiMizuki', 2)
    expect(after.stats).toEqual({ elementalMastery: 1, energyRecharge: 0.8, critRate: 0.6 })
    expect(after.source).toBe('My KQM notes (imported)')
    expect(after.confidence).toBe('guide')
    expect(after.simulation?.teammates.map((mate) => mate.id)).toEqual(['Odette', 'Faruzan'])
    // The imported rotation replaces the counts and keeps the rest of the default rotation
    expect(after.simulation?.rotation).toEqual({ ...before.rotation, counts: { 'reaction:swirl:Pyro': 4 } })
    // Other characters and games are untouched
    expect(genshinMetadata('Xiangling')).toEqual(withImported(genshinMetadata('Xiangling'), undefined))
    expect(wuwaMetadata('1102').simulation).toBeUndefined()

    const scoring = genshinScoringDefaults('YumemizukiMizuki', 2)
    expect(scoring.teammates).toEqual(['Odette', 'Faruzan'])
    expect(scoring.teammateOverrides).toEqual({ Odette: { rank: 0 }, Faruzan: { rank: 6, weaponId: 'FavoniusWarbow', refinement: 3 } })

    presetImportStore('genshin').getState().setEnabled(false)
    expect(genshinMetadata('YumemizukiMizuki', 2)).toBe(before)
  })
})
