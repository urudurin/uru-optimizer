import {
  ENKA_ORIGIN_URL,
  enkaStoreLoader,
} from 'lib/games/shared/enka'
import { elementOf } from 'lib/games/zzz/importer/enkaParser'
import { slugifySetName } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  useEffect,
  useState,
} from 'react'

// Agent, W-Engine and disc set art from Enka.Network, the way HSR's pages show character and relic art. Enka's ZZZ store
// files name every image (API docs: "Icons and Images"), and enka.network serves them to other sites
// (Access-Control-Allow-Origin: *). They're loaded when the page is viewed, never copied into this repo.
// Personal, non-commercial use; the art belongs to HoYoverse.

export type AgentArt = {
  // Full character art, around 600 KB
  portrait: string,
  // Small round icon
  circle: string,
  // The agent's theme color, for backgrounds
  accent?: string,
}

export type ZzzImages = {
  agents: Record<string, AgentArt>,
  wEngines: Record<string, string>,
  // By our set id (slugified English name)
  sets: Record<string, string>,
  // Every agent's name, element and specialty, by agent id (for the Agents page roster)
  agentInfo: Record<string, { name: string, element: string, specialty: string }>,
}

type AvatarEntry = { Name?: string, ProfessionType?: string, ElementTypes?: string[], Image?: string, CircleIcon?: string, Colors?: { Accent?: string } }
type WeaponEntry = { ImagePath?: string }
type SuitEntry = { Icon?: string, Name?: string }

const url = (path: string) => `${ENKA_ORIGIN_URL}${path}`

export const loadZzzImages = enkaStoreLoader(
  ['zzz/avatars.json', 'zzz/weapons.json', 'zzz/equipments.json', 'zzz/locs.json'],
  ([avatars, weapons, equipments, locs]): ZzzImages => {
    const names = (locs as Record<string, Record<string, string>>).en ?? {}
    const agents: Record<string, AgentArt> = {}
    const agentInfo: ZzzImages['agentInfo'] = {}
    for (const [id, entry] of Object.entries(avatars as Record<string, AvatarEntry>)) {
      if (entry.Image && entry.CircleIcon) agents[id] = { portrait: url(entry.Image), circle: url(entry.CircleIcon), accent: entry.Colors?.Accent }
      const name = entry.Name ? names[entry.Name] : undefined
      if (name) agentInfo[id] = { name, element: elementOf(id, entry.ElementTypes), specialty: entry.ProfessionType ?? 'Unknown' }
    }
    const wEngines: Record<string, string> = {}
    for (const [id, entry] of Object.entries(weapons as Record<string, WeaponEntry>)) if (entry.ImagePath) wEngines[id] = url(entry.ImagePath)
    const sets: Record<string, string> = {}
    for (const suit of Object.values((equipments as { Suits?: Record<string, SuitEntry> }).Suits ?? {})) {
      const name = suit.Name ? names[suit.Name] : undefined
      if (name && suit.Icon) sets[slugifySetName(name)] = url(suit.Icon)
    }
    return { agents, wEngines, sets, agentInfo }
  },
)

const EMPTY: ZzzImages = { agents: {}, wEngines: {}, sets: {}, agentInfo: {} }

// The images once loaded; empty maps until then, or when Enka can't be reached (pages show initials instead)
export function useZzzImages(): ZzzImages {
  const [images, setImages] = useState<ZzzImages>(EMPTY)
  useEffect(() => {
    let live = true
    void loadZzzImages().then((result) => {
      if (live && result.ok) setImages(result.data)
    })
    return () => {
      live = false
    }
  }, [])
  return images
}
