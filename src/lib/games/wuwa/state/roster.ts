import {
  CHARACTERS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import {
  type CharacterState,
  MAX_LOADOUT_ECHOES,
} from 'lib/games/wuwa/types'

// Every Resonator is available without adding them first, like HSR: Resonators not in the save get a default build
// (level 90, S0, minor fortes, the best weapon of their type at R1). Changing one (weapon, sequence, Equip...) saves them.

const LEVEL = 90

// The highest-rarity weapon of the type with the most base ATK at level 90
export function bestWuwaWeapon(weaponType: number | null | undefined): string | undefined {
  let best: { id: string, rarity: number, atk: number } | undefined
  for (const weapon of Object.values(WEAPONS)) {
    if (weaponType == null || weapon.weaponType !== weaponType) continue
    const rarity = weapon.rarity ?? 0
    const atk = weapon.baseAtkByLevel[String(LEVEL)] ?? 0
    if (!best || rarity > best.rarity || (rarity === best.rarity && atk > best.atk)) best = { id: weapon.id, rarity, atk }
  }
  return best?.id
}

export function defaultWuwaCharacter(charId: string): CharacterState {
  return {
    charId,
    level: LEVEL,
    sequence: 0,
    weaponId: bestWuwaWeapon(CHARACTERS[charId]?.weaponType),
    weaponLevel: LEVEL,
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
