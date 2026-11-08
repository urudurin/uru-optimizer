import type { OverrideMember } from 'lib/games/shared/ui/optimizer/TeammateOverrideCard'
import { characterName } from 'lib/games/wuwa/data/gameData'
import type { CharacterState } from 'lib/games/wuwa/types'
import { WEAPON_OPTIONS } from 'lib/games/wuwa/ui/ResonatorForm'

// The teammate override card's members for a WuWa team (the optimizer's Teammates row and the scoring setup): each
// teammate's Sequence, weapon and rank from the save (WuWa has no set team buffs)
export function wuwaOverrideMembers(charId: string, teammates: string[], characters: CharacterState[]): OverrideMember[] {
  return teammates.flatMap((id) => {
    const mate = characters.find((c) => c.charId === id)
    if (!mate || id === charId) return []
    return [{ id, name: characterName(id), roster: { rank: mate.sequence, weaponId: mate.weaponId, refinement: mate.refinement }, weapons: WEAPON_OPTIONS }]
  })
}
