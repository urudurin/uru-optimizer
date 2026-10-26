import {
  useEffect,
  useState,
} from 'react'

// Character art the user saved into wuwa/user-art/ themselves (see the README there). The folder is gitignored and the
// site never fetches art from anywhere: there's no image source for WuWa we can use (Enka doesn't cover it, the datamine
// is text only, Fandom's terms forbid automated access). Vite lists the files at build time and only hands out their
// addresses; the images load when a banner or card shows them. Without a file, pages show initials.

export type ResonatorArt = {
  portrait: string,
  icon?: string,
}

// File path -> a loader for its address
const FILES = import.meta.glob<string>('../user-art/*.{png,jpg,jpeg,webp}', { query: '?url', import: 'default' })

// '../user-art/hsin-icon.png' -> ['hsin', true]
export function parseArtPath(path: string): [id: string, isIcon: boolean] | undefined {
  const name = /([^/]+)\.(png|jpe?g|webp)$/i.exec(path)?.[1]?.toLowerCase()
  if (!name) return undefined
  return name.endsWith('-icon') ? [name.slice(0, -'-icon'.length), true] : [name, false]
}

let pending: Promise<Record<string, ResonatorArt>> | undefined

export function loadUserArt(): Promise<Record<string, ResonatorArt>> {
  pending ??= Promise.all(Object.entries(FILES).map(async ([path, load]) => [path, await load()] as const)).then((entries) => {
    const portraits: Record<string, string> = {}
    const icons: Record<string, string> = {}
    for (const [path, url] of entries) {
      const parsed = parseArtPath(path)
      if (parsed) (parsed[1] ? icons : portraits)[parsed[0]] = url
    }
    // An icon alone still gives the roster something; the card then shows it too
    const ids = new Set([...Object.keys(portraits), ...Object.keys(icons)])
    return Object.fromEntries([...ids].map((id) => [id, { portrait: portraits[id] ?? icons[id], icon: icons[id] }]))
  })
  return pending
}

export function useUserArt(): Record<string, ResonatorArt> {
  const [art, setArt] = useState<Record<string, ResonatorArt>>({})
  useEffect(() => {
    let live = true
    void loadUserArt().then((result) => {
      if (live) setArt(result)
    })
    return () => {
      live = false
    }
  }, [])
  return art
}
