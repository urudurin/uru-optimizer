import type { DatamineFile } from 'lib/games/wuwa/data/dataTypes'
import datamine from 'lib/games/wuwa/data/generated/datamine.json'

// WuWa game data from the community datamine. See data/README.md for where it came from and how it may be used
// (personal, non-commercial). Nothing in here comes from guide sites.

const data = datamine as DatamineFile

export const DATA_PROVENANCE = data.provenance
export const CHARACTER_BASES = data.bases
export const WEAPONS = data.weapons
export const ECHO_DEFINITIONS = data.echoes
export const SONATA_SETS = data.sets
export const CHARACTERS = data.characters

// The in-game name from the datamine, or one derived from the id for characters it doesn't have: "rover-havoc" -> "Rover Havoc"
export function characterName(id: string): string {
  return CHARACTERS[id]?.name ?? id.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
