import {
  DEFAULT_GAME,
  type GameId,
  parseGameId,
} from 'lib/games/games'
import { create } from 'zustand'

// Kept outside of HSR's own 'state' save so the HSR save format is never touched
const STORAGE_KEY = 'active-game'

function readStoredGame(): GameId {
  try {
    return parseGameId(typeof localStorage === 'undefined' ? undefined : localStorage.getItem(STORAGE_KEY))
  } catch {
    // Storage can be unavailable (private mode, tests)
    return DEFAULT_GAME
  }
}

type GameStore = {
  activeGame: GameId,
  setActiveGame: (game: GameId) => void,
}

export const useGameStore = create<GameStore>()((set) => ({
  activeGame: readStoredGame(),
  setActiveGame: (game) => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, game)
    } catch {
      // Not being able to remember the choice is fine
    }
    set({ activeGame: game })
  },
}))
