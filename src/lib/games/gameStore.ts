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
  setActiveGame: (game: GameId) => void,
}

export const useGameStore = create<GameStore>()((set) => ({
  // Anything unreadable falls back to the default game
  activeGame: parseGameId(readStorage(STORAGE_KEY) ?? DEFAULT_GAME),
  setActiveGame: (game) => {
    // Not being able to remember the choice is fine
    writeStorage(STORAGE_KEY, game)
    set({ activeGame: game })
  },
}))
