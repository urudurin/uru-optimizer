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

// Characters have no display name in the datamine tables, so it's derived from the id: "rover-havoc" -> "Rover Havoc"
export function characterName(id: string): string {
  return id.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
