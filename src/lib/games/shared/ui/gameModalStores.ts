import type { GearOption } from 'lib/games/shared/gear/gearKind'
import type { SavedBuild } from 'lib/games/shared/savedBuilds'
import { createOverlayStore } from 'lib/stores/infrastructure/createOverlayStore'

// The games' modals, after HSR's overlays (lib/stores/infrastructure/createOverlayStore.ts, lib/overlays/GlobalModals.tsx):
// one store per modal holding what it was opened with, each modal mounted once by shared/ui/GameModals.tsx. The
// open* functions next to each modal fill its store.

export type SaveBuildModalConfig = {
  defaultName: string,
  onSave: (name: string) => void,
}

export type SavedBuildsModalConfig = {
  // Whose builds, for the title
  name: string,
  builds: SavedBuild[],
  // A line about a build: its sets, and pieces no longer in the save
  describe: (build: SavedBuild) => string,
  onEquip: (build: SavedBuild) => void,
  // Deletes it and returns the builds left
  onDelete: (build: SavedBuild) => SavedBuild[],
}

export type ScoringModalConfig = {
  game: string,
  characterId: string,
  name: string,
  // The substats, in the game's order
  stats: GearOption[],
  current: Record<string, number>,
  defaults: Record<string, number>,
}

export type SwitchGearModalConfig = {
  name: string,
  gearNoun: string,
  others: GearOption[],
  onSwitch: (otherId: string) => void,
}

export const useSaveBuildModalStore = createOverlayStore<SaveBuildModalConfig>()
export const useSavedBuildsModalStore = createOverlayStore<SavedBuildsModalConfig>()
export const useScoringModalStore = createOverlayStore<ScoringModalConfig>()
export const useSwitchGearModalStore = createOverlayStore<SwitchGearModalConfig>()
