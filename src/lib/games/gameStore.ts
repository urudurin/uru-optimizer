import {
  gamePageHash,
  HOME_HASH,
  readGameHash,
  showHash,
} from 'lib/games/gameHash'
import {
  DEFAULT_GAME,
  type GameId,
  parseGameId,
} from 'lib/games/games'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { useGlobalStore } from 'lib/stores/app/appStore'
import { PageToHash } from 'lib/tabs/navigation/constants'
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

// The page address wins over the stored game (gameHash.ts); a bare address (HSR's home hash '') keeps the stored one
function initialState(): Pick<GameStore, 'activeGame' | 'home'> {
  const fromHash = readGameHash()
  if (fromHash?.kind === 'home') return remember(HOME)
  if (fromHash?.kind === 'game') return remember(fromHash.game)
  if (fromHash?.kind === 'hsr' && window.location.hash) return remember('hsr')
  const stored = readStorage(STORAGE_KEY)
  return { activeGame: parseGameId(stored ?? DEFAULT_GAME), home: [null, HOME].includes(stored) }
}

function remember(value: GameId | typeof HOME): Pick<GameStore, 'activeGame' | 'home'> {
  const previous = parseGameId(readStorage(STORAGE_KEY))
  // Not being able to remember the choice is fine
  writeStorage(STORAGE_KEY, value)
  return value === HOME ? { activeGame: previous, home: true } : { activeGame: value, home: false }
}

// Where switching to a game lands: HSR's current tab, or the game's last page (its app corrects an unknown one)
function hashForGame(game: GameId) {
  if (game === 'hsr') return PageToHash[useGlobalStore.getState().activeKey]
  return gamePageHash(game, readStorage(`${game}-page`) ?? 'optimizer')
}

export const useGameStore = create<GameStore>()((set) => ({
  ...initialState(),
  setActiveGame: (game) => {
    set(remember(game))
    showHash(hashForGame(game))
  },
  goHome: () => {
    writeStorage(STORAGE_KEY, HOME)
    set({ home: true })
    showHash(HOME_HASH)
  },
}))

// Back / Forward and typed addresses: show the game the address names (game pages follow it in useGamePage)
window.addEventListener('hashchange', () => {
  const fromHash = readGameHash()
  if (!fromHash) return
  if (fromHash.kind === 'home') {
    writeStorage(STORAGE_KEY, HOME)
    useGameStore.setState({ home: true })
  } else {
    useGameStore.setState(remember(fromHash.kind === 'game' ? fromHash.game : 'hsr'))
  }
})
