export type GameId = 'hsr' | 'zzz' | 'wuwa' | 'genshin'

export const DEFAULT_GAME: GameId = 'hsr'

export const GAMES: readonly { id: GameId, label: string, shortLabel: string }[] = [
  { id: 'hsr', label: 'Honkai: Star Rail', shortLabel: 'HSR' },
  { id: 'zzz', label: 'Zenless Zone Zero', shortLabel: 'ZZZ' },
  { id: 'wuwa', label: 'Wuthering Waves', shortLabel: 'WuWa' },
  { id: 'genshin', label: 'Genshin Impact', shortLabel: 'Genshin' },
]

// Anything unknown (missing, corrupted, or from a future version) falls back to the default game
export function parseGameId(value: unknown): GameId {
  return GAMES.some((game) => game.id === value) ? value as GameId : DEFAULT_GAME
}
