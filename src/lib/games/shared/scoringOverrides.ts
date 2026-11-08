import type { SimulationMetadata } from 'lib/games/shared/characterMetadata'
import { readOptimizerSettings } from 'lib/games/shared/optimizerSettings'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import type { TeammateOverrides } from 'lib/games/shared/teammateOverrides'
import {
  create,
  type StoreApi,
  type UseBoundStore,
} from 'zustand'

// The characters pages' DPS score setups, after HSR's useScoringStore (scoringMetadataOverrides and the showcase's
// Default / Custom choice): Custom is a scoring setup of its own, kept apart from the optimizer's settings, in
// <game>-scoring-overrides { byCharacter: { [characterId]: damage settings }, migrations }; the choice is in
// <game>-scoring-mode { [characterId]: 'default' | 'custom' } and starts at Default, like HSR's showcase. Default is the
// character's metadata simulation (shared/characterMetadata.ts) when it has one, the kit alone otherwise.

export type ScoringMode = 'default' | 'custom'

export type SavedScoringOverrides = {
  byCharacter: Record<string, Record<string, unknown>>,
  migrations?: string[],
}

const overridesKey = (game: string) => `${game}-scoring-overrides`
const modesKey = (game: string) => `${game}-scoring-mode`

function readObject(key: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readStorage(key) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function readScoringOverrides(game: string): SavedScoringOverrides {
  const { byCharacter, migrations } = readObject(overridesKey(game)) as Partial<SavedScoringOverrides>
  return {
    byCharacter: byCharacter && typeof byCharacter === 'object' && !Array.isArray(byCharacter) ? byCharacter : {},
    ...(Array.isArray(migrations) ? { migrations: migrations.filter((m): m is string => typeof m === 'string') } : {}),
  }
}

export function readScoringModes(game: string): Record<string, ScoringMode> {
  const modes: Record<string, ScoringMode> = {}
  for (const [id, mode] of Object.entries(readObject(modesKey(game)))) {
    if (mode === 'default' || mode === 'custom') modes[id] = mode
  }
  return modes
}

// Until Nov 2026 Custom was the optimizer's own settings and a character with no choice scored Custom. Once per game,
// characters scoring Custom then (picked, or never picked but given a team in the optimizer) get that setup copied in
// as their Custom, and keep Custom; everyone else starts at Default
export const FROM_OPTIMIZER_MIGRATION = 'from-optimizer-settings'

export function migrateScoringOverrides(game: string) {
  const saved = readScoringOverrides(game)
  if (saved.migrations?.includes(FROM_OPTIMIZER_MIGRATION)) return
  const modes = readScoringModes(game)
  const byCharacter = { ...saved.byCharacter }
  for (const [id, optimizer] of Object.entries(readOptimizerSettings(`${game}-optimizer-settings`).byCharacter)) {
    const hadTeam = Array.isArray(optimizer.teammates) && optimizer.teammates.length > 0
    if (modes[id] === 'default' || byCharacter[id] || !(modes[id] === 'custom' || hadTeam)) continue
    byCharacter[id] = optimizer
    modes[id] = 'custom'
  }
  writeStorage(overridesKey(game), JSON.stringify({ ...saved, byCharacter, migrations: [...(saved.migrations ?? []), FROM_OPTIMIZER_MIGRATION] }))
  writeStorage(modesKey(game), JSON.stringify(modes))
}

type ScoringStore = {
  overrides: SavedScoringOverrides,
  modes: Record<string, ScoringMode>,
  setMode: (characterId: string, mode: ScoringMode) => void,
  // Saves a character's Custom setup (undefined removes it: Custom is Default again)
  setOverride: (characterId: string, settings: Record<string, unknown> | undefined) => void,
  // Reads storage again, after a restored backup
  reload: () => void,
}

const stores = new Map<string, UseBoundStore<StoreApi<ScoringStore>>>()

// The store for one game, made on first use (after the one-time migration)
export function scoringStore(game: string): UseBoundStore<StoreApi<ScoringStore>> {
  let store = stores.get(game)
  if (!store) {
    migrateScoringOverrides(game)
    store = create<ScoringStore>()((set, get) => ({
      overrides: readScoringOverrides(game),
      modes: readScoringModes(game),
      setMode: (characterId, mode) => {
        const modes = { ...get().modes, [characterId]: mode }
        writeStorage(modesKey(game), JSON.stringify(modes))
        set({ modes })
      },
      setOverride: (characterId, settings) => {
        const byCharacter = { ...get().overrides.byCharacter }
        if (settings) byCharacter[characterId] = settings
        else delete byCharacter[characterId]
        const overrides = { ...get().overrides, byCharacter }
        writeStorage(overridesKey(game), JSON.stringify(overrides))
        set({ overrides })
      },
      reload: () => set({ overrides: readScoringOverrides(game), modes: readScoringModes(game) }),
    }))
    stores.set(game, store)
  }
  return store
}

export function reloadScoringOverrides(game: string) {
  stores.get(game)?.getState().reload()
}

// The settings fields a scoring Default takes from a metadata simulation
type SimulatedFields<Rotation> = { teammates: string[], teammateOverrides: TeammateOverrides, rotation: Rotation }

// The Default setup: the kit alone, with the simulation's team (ranks, weapons and 4-pieces as teammate overrides; a
// field left out uses the roster's) and rotation laid over it when the character's metadata has one
export function scoringDefaults<Rotation, T extends SimulatedFields<Rotation>>(kitAlone: T, simulation: SimulationMetadata<Rotation> | undefined): T {
  if (!simulation) return kitAlone
  const teammateOverrides: TeammateOverrides = {}
  for (const { id, rank, weaponId, refinement, fourPiece } of simulation.teammates) {
    const override = {
      ...(rank !== undefined ? { rank } : {}),
      ...(weaponId !== undefined ? { weaponId } : {}),
      ...(refinement !== undefined ? { refinement } : {}),
      ...(fourPiece !== undefined ? { fourPiece } : {}),
    }
    if (Object.keys(override).length > 0) teammateOverrides[id] = override
  }
  return { ...kitAlone, teammates: simulation.teammates.map((mate) => mate.id), teammateOverrides, rotation: simulation.rotation }
}
