import {
  assignGenshinArtifact,
  deleteGenshinArtifacts,
  deleteGenshinCharacter,
  deserializeGenshinData,
  EMPTY_GENSHIN_DATA,
  equipGenshinArtifacts,
  GENSHIN_STATE_KEY,
  type GenshinCharacterDetails,
  type GenshinData,
  mergeGenshinData,
  saveGenshinArtifact,
  saveGenshinCharacter,
  serializeGenshinData,
  switchGenshinArtifacts,
  unequipGenshinCharacter,
  withGenshinCharacter,
} from 'lib/games/genshin/state/genshinState'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import { createGearStore } from 'lib/games/shared/gearStore'
import { restrictOwners } from 'lib/games/shared/importChoice'

// The Genshin save in this browser (genshin-state) on the shared gear store (shared/gearStore.ts): saveGear / deleteGear
// are artifacts, unequipOwner / switchGear / deleteOwner are characters (the Characters page's Character menu)
export const useGenshinStore = createGearStore<GenshinData, Artifact, GenshinData & { warnings: string[] }, string, {
  // Makes these the character's artifacts in this browser's save, see equipGenshinArtifacts. A character not in the save
  // yet (a default one, state/roster.ts) is added first
  equip: (character: GenshinCharacter, artifacts: Artifact[]) => void,
  // Adds a character by hand or changes their level, constellation or weapon, see saveGenshinCharacter
  saveCharacter: (details: GenshinCharacterDetails) => void,
}>(
  {
    game: 'genshin',
    storageKey: GENSHIN_STATE_KEY,
    empty: EMPTY_GENSHIN_DATA,
    serialize: serializeGenshinData,
    deserialize: deserializeGenshinData,
    isEmptyImport: (parsed) => parsed.artifacts.length === 0 && parsed.characters.length === 0,
    merge: mergeGenshinData,
    // Kept characters not in the import lose the artifacts a replacing import takes away
    restrict: (data, parsed, choice, mode) => ({
      ...parsed,
      characters: restrictOwners(data.characters, parsed.characters, (c) => c.id, choice, mode)
        .map((c) => (mode === 'replace' && !parsed.characters.includes(c) ? { ...c, artifactIds: {} } : c)),
    }),
    saveGear: saveGenshinArtifact,
    deleteGear: deleteGenshinArtifacts,
    assignGear: assignGenshinArtifact,
    unequipOwner: unequipGenshinCharacter,
    switchGear: switchGenshinArtifacts,
    deleteOwner: deleteGenshinCharacter,
    itemId: (artifact) => artifact.id,
  },
  (apply) => ({
    equip: (character, artifacts) => apply((data, swap) => equipGenshinArtifacts(withGenshinCharacter(data, character), character.id, artifacts, swap)),
    saveCharacter: (details) => apply((data) => saveGenshinCharacter(data, details)),
  }),
)
