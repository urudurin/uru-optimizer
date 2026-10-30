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

// The Home tab (GamePicker.tsx) is stored as 'home' under the same key
const HOME = 'home'

type GameStore = {
  // The last game picked, kept while Home shows so switching back returns to it
  activeGame: GameId,
  // Home is showing: on a first visit, after picking it in the switcher, or after clicking the site logo
  home: boolean,
  setActiveGame: (game: GameId) => void,
  goHome: () => void,
}

export const useGameStore = create<GameStore>()((set) => ({
  // Anything unreadable falls back to the default game
  activeGame: parseGameId(readStorage(STORAGE_KEY) ?? DEFAULT_GAME),
  home: [null, HOME].includes(readStorage(STORAGE_KEY)),
  setActiveGame: (game) => {
    // Not being able to remember the choice is fine
    writeStorage(STORAGE_KEY, game)
    set({ activeGame: game, home: false })
  },
  goHome: () => {
    writeStorage(STORAGE_KEY, HOME)
    set({ home: true })
  },
}))
