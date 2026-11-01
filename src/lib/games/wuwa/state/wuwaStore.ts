import { createGearStore } from 'lib/games/shared/gearStore'
import type { ParsedWuwaData } from 'lib/games/wuwa/importer/userDataParser'
import {
  assignWuwaEcho,
  deleteWuwaCharacter,
  deleteWuwaEchoes,
  deserializeWuwaData,
  EMPTY_WUWA_DATA,
  equipWuwaEchoes,
  mergeWuwaData,
  saveWuwaCharacter,
  saveWuwaEcho,
  serializeWuwaData,
  switchWuwaEchoes,
  unequipWuwaCharacter,
  withWuwaCharacter,
  WUWA_STATE_KEY,
  type WuwaData,
} from 'lib/games/wuwa/state/wuwaState'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'

// The WuWa save in this browser (wuwa-state) on the shared gear store (shared/gearStore.ts): saveGear / deleteGear are
// echoes, unequipOwner / switchGear / deleteOwner are Resonators (the Resonators page's Character menu)
export const useWuwaStore = createGearStore<WuwaData, Echo, ParsedWuwaData, string, {
  // Makes these the Resonator's echoes in this browser's save, see equipWuwaEchoes
  // A Resonator not in the save yet (a default one, state/roster.ts) is added first
  equip: (character: CharacterState, echoes: Echo[]) => void,
  // Adds a Resonator by hand or changes their level, sequence and weapon, see saveWuwaCharacter
  saveCharacter: (details: Omit<CharacterState, 'echoIds'>) => void,
}>(
  {
    game: 'wuwa',
    storageKey: WUWA_STATE_KEY,
    empty: EMPTY_WUWA_DATA,
    serialize: serializeWuwaData,
    deserialize: deserializeWuwaData,
    isEmptyImport: (parsed) => parsed.echoes.length === 0 && parsed.characters.length === 0,
    merge: mergeWuwaData,
    saveGear: saveWuwaEcho,
    deleteGear: deleteWuwaEchoes,
    assignGear: assignWuwaEcho,
    unequipOwner: unequipWuwaCharacter,
    switchGear: switchWuwaEchoes,
    deleteOwner: deleteWuwaCharacter,
    itemId: (echo) => echo.id,
  },
  (apply) => ({
    equip: (character, echoes) => apply((data, swap) => equipWuwaEchoes(withWuwaCharacter(data, character), character.charId, echoes, swap)),
    saveCharacter: (details) => apply((data) => saveWuwaCharacter(data, details)),
  }),
)
