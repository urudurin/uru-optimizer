import { CHARACTERS } from 'lib/games/wuwa/data/gameData'
import {
  type CharacterState,
  MAX_LOADOUT_ECHOES,
} from 'lib/games/wuwa/types'

// Every Resonator is available without adding them first, like HSR: Resonators not in the save get a default build
// (level 90, S0, minor fortes, no weapon and no echoes). Changing one (weapon, sequence, Equip...) saves them.

export function defaultWuwaCharacter(charId: string): CharacterState {
  return {
    charId,
    level: 90,
    sequence: 0,
    weaponLevel: 90,
    refinement: 1,
    minorFortes: true,
    echoIds: Array.from({ length: MAX_LOADOUT_ECHOES }, () => null),
  }
}

// The saved Resonators, then a default one for everyone else by name
export function wuwaRoster(saved: CharacterState[]): CharacterState[] {
  const have = new Set(saved.map((c) => c.charId))
  const others = Object.values(CHARACTERS).filter((c) => !have.has(c.id)).sort((a, b) => a.name.localeCompare(b.name))
  return [...saved, ...others.map((c) => defaultWuwaCharacter(c.id))]
}
