import type { GameId } from 'lib/games/games'
import {
  moveToTop,
  readPriority,
  writePriority,
} from 'lib/games/shared/characterPriority'
import { rememberedDamageScore } from 'lib/games/shared/damageScore'
import type { GearOption } from 'lib/games/shared/gear/gearKind'
import type { GearScore } from 'lib/games/shared/gearScore'
import {
  BuildRating,
  DPS_SCORE_LABEL,
} from 'lib/games/shared/ui/BuildRating'
import { CharacterMenu } from 'lib/games/shared/ui/CharacterMenu'
import {
  describeSavedPieces,
  useSavedBuilds,
} from 'lib/games/shared/ui/optimizer/SavedBuilds'
import { openScoringModal } from 'lib/games/shared/ui/ScoringModal'

// What the three Characters pages need to know about a game for their Character menu (after HSR's), like GearKind for
// the gear pages (shared/gear/gearKind.ts) and OptimizerKind for the optimizers. An owner is what wears gear in the
// save: a character (Genshin, WuWa) or a build (ZZZ, where an agent can have several)
export type CharacterKind<Owner, Piece extends { id: string }> = {
  game: GameId,
  // 'artifacts', 'discs', 'echoes'
  gearNoun: string,
  // The id the store's verbs take (ZZZ: the build id)
  ownerId: (owner: Owner) => string,
  // The character it belongs to, for priority, saved builds and scoring (ZZZ: the agent id)
  characterId: (owner: Owner) => string,
  // In the Switch with list
  ownerLabel: (owner: Owner) => string,
  wornBy: (owner: Owner, gearById: Map<string, Piece>) => Piece[],
  setNameOf: (piece: Piece) => string,
  // The loadout's gear score (shared/gearScore.ts scoreBuild), for the rating and Sort by effective substats, and its label
  buildScore: (owner: Owner, worn: Piece[]) => GearScore | undefined,
  buildScoreLabel: string,
  // The Scoring weights window: the substats in the game's order, and the weights now and by default
  scoring: (owner: Owner) => { stats: GearOption[], current: Record<string, number>, defaults: Record<string, number> },
  // The store's verbs (shared/gearStore.ts) and Equip
  switchGear: (a: string, b: string) => void,
  unequipOwner: (ownerId: string) => void,
  deleteOwner: (ownerId: string) => void,
  equip: (owner: Owner, pieces: Piece[]) => void,
}

// The Character menu for one owner, wired to the game's store, saved builds, priority and scoring weights
export function CharacterKindMenu<Owner, Piece extends { id: string }>({ kind, owner, name, owners, gearById, onEdit }: {
  kind: CharacterKind<Owner, Piece>,
  owner: Owner,
  name: string,
  // Every saved owner, for Switch with and the priority actions
  owners: Owner[],
  gearById: Map<string, Piece>,
  onEdit: () => void,
}) {
  const id = kind.ownerId(owner)
  const characterId = kind.characterId(owner)
  const builds = useSavedBuilds(kind.game, characterId)
  const worn = kind.wornBy(owner, gearById)
  const piecesOf = (pieceIds: string[]) => pieceIds.flatMap((pieceId) => gearById.get(pieceId) ?? [])

  return (
    <CharacterMenu
      name={name}
      gearNoun={kind.gearNoun}
      others={owners.filter((o) => kind.ownerId(o) !== id).map((o) => ({ value: kind.ownerId(o), label: kind.ownerLabel(o) }))}
      onEdit={onEdit}
      onSwitch={(other) => kind.switchGear(id, other)}
      onUnequip={() => kind.unequipOwner(id)}
      onDelete={() => kind.deleteOwner(id)}
      onSaveBuild={worn.length > 0 ? () => builds.save(worn.map((piece) => piece.id)) : undefined}
      onViewBuilds={() =>
        builds.view({
          name,
          describe: (b) => describeSavedPieces(piecesOf(b.pieceIds).map(kind.setNameOf), b.pieceIds.length),
          equip: (b) => kind.equip(owner, piecesOf(b.pieceIds)),
        })}
      savedCount={builds.saved.length}
      onMoveToTop={() => writePriority(kind.game, moveToTop([...new Set(owners.map(kind.characterId))], readPriority(kind.game), characterId))}
      onSortByScore={() => {
        // Each character by their first owner's loadout (ZZZ: an agent's first saved build)
        const first = new Map<string, Owner>()
        for (const o of owners) if (!first.has(kind.characterId(o))) first.set(kind.characterId(o), o)
        const scored = [...first].map(([charId, o]) => ({ id: charId, score: kind.buildScore(o, kind.wornBy(o, gearById))?.percent ?? 0 }))
        writePriority(kind.game, scored.sort((a, b) => b.score - a.score).map((s) => s.id))
      }}
      onScoring={() => openScoringModal({ game: kind.game, characterId, name, ...kind.scoring(owner) })}
    />
  )
}

// The rating under the stat list: the optimizer's DPS score for exactly these pieces when it has one (shared/damageScore.ts
// RememberDamageScore), the gear score otherwise
export function CharacterBuildRating<Owner, Piece extends { id: string }>({ kind, owner, worn }: {
  kind: CharacterKind<Owner, Piece>,
  owner: Owner,
  worn: Piece[],
}) {
  const dpsScore = rememberedDamageScore(kind.game, kind.characterId(owner), worn.map((piece) => piece.id))
  return <BuildRating score={dpsScore ?? kind.buildScore(owner, worn)} label={dpsScore ? DPS_SCORE_LABEL : kind.buildScoreLabel} />
}
