import { SegmentedControl } from '@mantine/core'
import {
  GAMES,
  parseGameId,
} from 'lib/games/games'
import { useGameStore } from 'lib/games/gameStore'

export function GameSwitcher() {
  const activeGame = useGameStore((s) => s.activeGame)
  const setActiveGame = useGameStore((s) => s.setActiveGame)
  const home = useGameStore((s) => s.home)
  const goHome = useGameStore((s) => s.goHome)

  return (
    <SegmentedControl
      size='xs'
      value={home ? 'home' : activeGame}
      onChange={(value) => (value === 'home' ? goHome() : setActiveGame(parseGameId(value)))}
      data={[{ value: 'home', label: 'Home' }, ...GAMES.map((game) => ({ value: game.id, label: game.shortLabel }))]}
    />
  )
}
