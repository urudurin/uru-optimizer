import type { GameId } from 'lib/games/games'
import {
  ranksAbove,
  usePriority,
} from 'lib/games/shared/characterPriority'
import { swapsOnEquip } from 'lib/games/shared/gameSettings'
import { todayString } from 'lib/games/shared/importedPresets'
import {
  deleteSavedBuild,
  saveBuild,
  type SavedBuild,
  savedBuilds,
} from 'lib/games/shared/savedBuilds'
import { confirmAction } from 'lib/games/shared/ui/confirm'
import {
  openSaveBuildModal,
  openSavedBuildsModal,
} from 'lib/games/shared/ui/optimizer/SavedBuilds'
import { Message } from 'lib/interactions/message'
import {
  useMemo,
  useReducer,
} from 'react'

// What a game's optimizer page needs to know about its gear for the parts the three pages share, like GearKind does for
// the inventory pages (shared/gear/gearKind.ts): how to name a build and its pieces, and what happens to a previous
// owner when a build takes their pieces
export type OptimizerKind<Piece extends { id: string }> = {
  game: GameId,
  // 'build' (Genshin, ZZZ) or 'loadout' (WuWa)
  buildNoun: string,
  describeSets: (pieces: Piece[]) => string,
  // For the Equip confirmation, after the previous owners' names: with swapping on (Settings) and with replacing
  takenNote: (characterName: string, swap: boolean) => string,
}

// HSR's character priority filter: gear worn by characters ranked above this one is left out (shared/characterPriority.ts),
// unless worn gear is left out anyway
export function useExcludeOwners(game: GameId, ids: string[], characterId: string, priorityFilter: boolean, excludeEquippedByOthers: boolean) {
  const rankOrder = usePriority(game)
  return useMemo(
    () => (priorityFilter && !excludeEquippedByOthers ? ranksAbove(ids, rankOrder, characterId) : undefined),
    [priorityFilter, excludeEquippedByOthers, rankOrder, ids, characterId],
  )
}

// The sidebar's Equip and its Builds Save / Load (after HSR's), for one character
export function useBuildActions<Piece extends { id: string }>(kind: OptimizerKind<Piece>, { characterId, name, gear, equip }: {
  characterId: string,
  name: string,
  // Every piece in the save, to find a saved build's pieces again
  gear: Piece[],
  equip: (pieces: Piece[]) => void,
}) {
  // Read again after a save or delete
  const [version, bump] = useReducer((n: number) => n + 1, 0)
  const savedList = useMemo(() => (version >= 0 ? savedBuilds(kind.game, characterId) : []), [kind.game, characterId, version])

  // Equips a result after asking; previousOwners are the names of whoever loses pieces to it. Resolves whether it did
  async function equipResult(index: number, pieces: Piece[], previousOwners: string[]): Promise<boolean> {
    const taken = previousOwners.length > 0 ? `\n\n${previousOwners.join(', ')} ${kind.takenNote(name, swapsOnEquip(kind.game))}.` : ''
    const noun = kind.buildNoun
    const title = `Equip ${noun}`
    if (!await confirmAction(title, `Equip ${noun} #${index + 1} on ${name} in this browser's save?${taken}`, { confirmLabel: 'Equip' })) return false
    equip(pieces)
    Message.success('Equipped')
    return true
  }

  function saveBuildNow(pieces: Piece[]) {
    const pieceIds = pieces.map((piece) => piece.id)
    openSaveBuildModal({
      defaultName: `Build ${savedList.length + 1}`,
      onSave: (buildName) => {
        saveBuild(kind.game, characterId, buildName, pieceIds, todayString(new Date()))
        bump()
        Message.success(`Saved build ${buildName}`)
      },
    })
  }

  function loadBuilds() {
    const piecesOf = (saved: SavedBuild) => saved.pieceIds.flatMap((id) => gear.find((piece) => piece.id === id) ?? [])
    openSavedBuildsModal({
      name,
      builds: savedList,
      describe: (saved) => {
        const pieces = piecesOf(saved)
        const missing = saved.pieceIds.length - pieces.length
        return `${kind.describeSets(pieces)}${missing ? ` · ${missing} no longer in the save` : ''}`
      },
      onEquip: async (saved) => {
        const pieces = piecesOf(saved)
        if (pieces.length === 0) return
        if (!await confirmAction('Equip saved build', `Equip ${saved.name} on ${name} in this browser's save?`, { confirmLabel: 'Equip' })) return
        equip(pieces)
        Message.success('Equipped')
      },
      onDelete: (saved) => {
        const left = deleteSavedBuild(kind.game, characterId, saved.name)
        bump()
        return left
      },
    })
  }

  return { savedList, equipResult, saveBuildNow, loadBuilds }
}
