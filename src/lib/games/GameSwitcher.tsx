import { SegmentedControl } from '@mantine/core'
import {
  GAMES,
  parseGameId,
} from 'lib/games/games'
import { useGameStore } from 'lib/games/gameStore'

export function GameSwitcher() {
  const activeGame = useGameStore((s) => s.activeGame)
  const setActiveGame = useGameStore((s) => s.setActiveGame)

  return (
    <SegmentedControl
      size='xs'
      value={activeGame}
      onChange={(value) => setActiveGame(parseGameId(value))}
      data={GAMES.map((game) => ({ value: game.id, label: game.shortLabel }))}
    />
  )
}
