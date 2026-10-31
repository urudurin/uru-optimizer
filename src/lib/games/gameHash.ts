import {
  type GameId,
  GAMES,
} from 'lib/games/games'
import {
  BASE_PATH,
  HashToPage,
} from 'lib/tabs/navigation/constants'
import { parseHash } from 'lib/tabs/navigation/parseHash'

// Page addresses for Home and the other games, after HSR's tab hashes (lib/tabs/navigation/constants.ts): '#games'
// for Home, '#<game>-<page>' for a game page, e.g. '#genshin-characters'. HSR's Tabs ignore hashes they don't know,
// so these never move HSR's own page; HSR's hashes (including '' for its home) mean HSR is showing.

export const HOME_HASH = '#games'

export type OtherGame = Exclude<GameId, 'hsr'>

export type GameHash =
  | { kind: 'home' }
  | { kind: 'hsr' }
  | { kind: 'game', game: OtherGame, page: string }

const OTHER_GAMES = GAMES.map((game) => game.id).filter((id): id is OtherGame => id !== 'hsr')

export function readGameHash(hash = parseHash().hash): GameHash | null {
  if (hash === HOME_HASH) return { kind: 'home' }
  const match = /^#([a-z]+)-([a-z]+)$/.exec(hash)
  if (match && OTHER_GAMES.includes(match[1] as OtherGame)) return { kind: 'game', game: match[1] as OtherGame, page: match[2] }
  if (hash in HashToPage) return { kind: 'hsr' }
  return null
}

export function gamePageHash(game: OtherGame, page: string) {
  return `#${game}-${page}`
}

// A new history entry, so Back returns to the previous page; replace keeps the current entry (first render)
export function showHash(hash: string, replace = false) {
  if (parseHash().hash === hash) return
  const url = BASE_PATH + hash
  if (replace) history.replaceState({}, '', url)
  else history.pushState({}, '', url)
}
