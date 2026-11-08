import {
  backupSettings,
  restoreBackupSettings,
} from 'lib/games/shared/backup'
import {
  FROM_OPTIMIZER_MIGRATION,
  migrateScoringOverrides,
  readScoringModes,
  readScoringOverrides,
  scoringDefaults,
  scoringStore,
} from 'lib/games/shared/scoringOverrides'
import {
  beforeEach,
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

const kitAlone = { teammates: [] as string[], teammateOverrides: {}, rotation: { counts: { 'skill:Press': 1 } as Record<string, number> }, onField: true }

describe('scoring overrides (after HSR scoringMetadataOverrides)', () => {
  beforeEach(() => storage.clear())

  it('scores the kit alone without a simulation, and its team and rotation with one', () => {
    expect(scoringDefaults(kitAlone, undefined)).toBe(kitAlone)
    const simulation = {
      teammates: [{ id: 'Bennett', rank: 6, weaponId: 'SapwoodBlade', refinement: 5 }, { id: 'Kazuha', fourPiece: 'ViridescentVenerer' }, { id: 'Xingqiu' }],
      rotation: { counts: { 'burst:Hit': 2 } as Record<string, number> },
      sets: [],
      parts: {},
      substats: [],
    }
    expect(scoringDefaults(kitAlone, simulation)).toEqual({
      ...kitAlone,
      teammates: ['Bennett', 'Kazuha', 'Xingqiu'],
      teammateOverrides: { Bennett: { rank: 6, weaponId: 'SapwoodBlade', refinement: 5 }, Kazuha: { fourPiece: 'ViridescentVenerer' } },
      rotation: { counts: { 'burst:Hit': 2 } as Record<string, number> },
    })
  })

  it('copies the optimizer setup in once for characters that scored Custom, and leaves the rest on Default', () => {
    storage.set(
      'test-optimizer-settings',
      JSON.stringify({
        byCharacter: {
          // Never picked a mode, has a team: scored the optimizer's Custom before
          Mizuki: { teammates: ['Odette'], rotation: { counts: { 'reaction:swirl': 4 } }, target: 'damage' },
          // Picked Custom
          Picked: { teammates: [] },
          // Picked Default
          Chose: { teammates: ['Bennett'] },
          // No team, no choice
          Alone: { teammates: [] },
        },
      }),
    )
    storage.set('test-scoring-mode', JSON.stringify({ Picked: 'custom', Chose: 'default' }))
    migrateScoringOverrides('test')
    expect(readScoringOverrides('test')).toEqual({
      byCharacter: {
        Mizuki: { teammates: ['Odette'], rotation: { counts: { 'reaction:swirl': 4 } }, target: 'damage' },
        Picked: { teammates: [] },
      },
      migrations: [FROM_OPTIMIZER_MIGRATION],
    })
    expect(readScoringModes('test')).toEqual({ Mizuki: 'custom', Picked: 'custom', Chose: 'default' })

    // Runs once: later optimizer changes stay in the optimizer
    storage.set('test-optimizer-settings', JSON.stringify({ byCharacter: { Mizuki: { teammates: ['Kazuha'] }, Alone: { teammates: ['Bennett'] } } }))
    migrateScoringOverrides('test')
    expect(readScoringOverrides('test').byCharacter.Mizuki).toEqual({ teammates: ['Odette'], rotation: { counts: { 'reaction:swirl': 4 } }, target: 'damage' })
    expect(readScoringOverrides('test').byCharacter.Alone).toBeUndefined()
  })

  it('saves modes and Custom setups under their own keys, never the optimizer settings', () => {
    storage.set('store-optimizer-settings', JSON.stringify({ byCharacter: { Xiangling: { teammates: ['Bennett'] } } }))
    const store = scoringStore('store')
    store.getState().setOverride('Xiangling', { teammates: ['Xingqiu'] })
    store.getState().setMode('Xiangling', 'default')
    expect(JSON.parse(storage.get('store-scoring-overrides') ?? '{}').byCharacter.Xiangling).toEqual({ teammates: ['Xingqiu'] })
    expect(JSON.parse(storage.get('store-scoring-mode') ?? '{}')).toEqual({ Xiangling: 'default' })
    expect(JSON.parse(storage.get('store-optimizer-settings') ?? '{}').byCharacter.Xiangling).toEqual({ teammates: ['Bennett'] })
    store.getState().setOverride('Xiangling', undefined)
    expect(store.getState().overrides.byCharacter.Xiangling).toBeUndefined()
  })

  it('rides along in backups and comes back on restore', () => {
    storage.set('genshin-scoring-overrides', JSON.stringify({ byCharacter: { Mizuki: { teammates: ['Odette'] } }, migrations: [FROM_OPTIMIZER_MIGRATION] }))
    storage.set('genshin-scoring-mode', JSON.stringify({ Mizuki: 'custom' }))
    const backup = JSON.stringify({ settings: backupSettings('genshin') })
    storage.clear()
    restoreBackupSettings('genshin', backup)
    expect(scoringStore('genshin').getState().overrides.byCharacter.Mizuki).toEqual({ teammates: ['Odette'] })
    expect(scoringStore('genshin').getState().modes.Mizuki).toBe('custom')
  })
})
