import type { GenshinImages } from 'lib/games/genshin/data/images'
import { SET_4PC_BUFFS } from 'lib/games/genshin/team/buffs'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import { weaponOptions } from 'lib/games/genshin/ui/CharacterForm'
import { fourPieceSetsOf } from 'lib/games/shared/teammateOverrides'
import type { OverrideMember } from 'lib/games/shared/ui/optimizer/TeammateOverrideCard'

// The teammate override card's members for a Genshin team (the optimizer's Teammates row and the scoring setup): each
// teammate's Constellation, weapon and worn 4-piece from the roster, weapons of their type, sets with team buffs
export function genshinOverrideMembers(
  characterId: string,
  teammates: string[],
  { characters, artifacts, images, setName }: {
    characters: GenshinCharacter[],
    artifacts: Artifact[],
    images: GenshinImages,
    setName: (setId: string) => string,
  },
): OverrideMember[] {
  return teammates.flatMap((id) => {
    const mate = characters.find((c) => c.id === id)
    if (!mate || id === characterId) return []
    const wornSets = Object.values(mate.artifactIds).flatMap((artifactId) => artifacts.find((a) => a.id === artifactId)?.setId ?? [])
    const fourPiece = fourPieceSetsOf(wornSets)[0]
    return [{
      id,
      name: mate.name,
      roster: { rank: mate.constellation, weaponId: mate.weapon?.id, refinement: mate.weapon?.refinement ?? 1, fourPiece },
      weapons: weaponOptions(images.weaponInfo, images.characterInfo[id.startsWith('Traveler') ? 'Traveler' : id]?.weaponType),
      sets: [...new Set([...(fourPiece ? [fourPiece] : []), ...Object.keys(SET_4PC_BUFFS)])].map((setId) => ({ value: setId, label: setName(setId) })),
    }]
  })
}
