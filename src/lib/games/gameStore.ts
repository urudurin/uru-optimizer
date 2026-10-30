import {
  DEFAULT_GAME,
  type GameId,
  parseGameId,
} from 'lib/games/games'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { create } from 'zustand'

// Kept outside of HSR's own 'state' save so the HSR save format is never touched
const STORAGE_KEY = 'active-game'

type GameStore = {
  activeGame: GameId,
  // False until a game has been picked once: first visits see the game picker (GamePicker.tsx)
  chosen: boolean,
  setActiveGame: (game: GameId) => void,
}

export const useGameStore = create<GameStore>()((set) => ({
  // Anything unreadable falls back to the default game
  activeGame: parseGameId(readStorage(STORAGE_KEY) ?? DEFAULT_GAME),
  chosen: readStorage(STORAGE_KEY) !== null,
  setActiveGame: (game) => {
    // Not being able to remember the choice is fine
    writeStorage(STORAGE_KEY, game)
    set({ activeGame: game, chosen: true })
  },
}))
