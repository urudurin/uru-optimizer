import { fourPieceSetsOf } from 'lib/games/shared/teammateOverrides'
import type { OverrideMember } from 'lib/games/shared/ui/optimizer/TeammateOverrideCard'
import { SETS } from 'lib/games/zzz/data/sets'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import { SET_4PC_BUFFS } from 'lib/games/zzz/team/buffs'
import type { Disc } from 'lib/games/zzz/types'

// The teammate override card's members for a ZZZ squad (the optimizer's Teammates row and the scoring setup): each
// teammate's Mindscape, W-Engine and worn 4-piece from their build, sets with squad buffs
export function zzzOverrideMembers(agentId: string, teammates: string[], builds: ImportedBuild[], discs: Disc[]): OverrideMember[] {
  return teammates.flatMap((id) => {
    const build = builds.find((b) => b.agentId === id)
    if (!build || id === agentId) return []
    const fourPiece = fourPieceSetsOf(Object.values(build.discIds).flatMap((discId) => discs.find((d) => d.id === discId)?.setId ?? []))[0]
    return [{
      id,
      name: build.name,
      roster: { rank: build.mindscapeLevel, weaponId: build.wEngineId, refinement: build.wEngineRefinement ?? 1, fourPiece },
      weapons: Object.values(W_ENGINES).map((w) => ({ value: w.id, label: w.name })),
      sets: [...new Set([...(fourPiece ? [fourPiece] : []), ...Object.keys(SET_4PC_BUFFS)])].map((setId) => ({
        value: setId,
        label: SETS[setId]?.name ?? setId,
      })),
    }]
  })
}
