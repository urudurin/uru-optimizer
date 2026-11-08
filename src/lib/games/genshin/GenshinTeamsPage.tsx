import { useGenshinImages } from 'lib/games/genshin/data/images'
import {
  GENSHIN_CHARACTER_KIND,
} from 'lib/games/genshin/GenshinCharactersPage'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import { genshinRoster } from 'lib/games/genshin/state/roster'
import { CharacterBuildRating } from 'lib/games/shared/ui/CharacterKind'
import { TeamsView } from 'lib/games/shared/ui/TeamsView'
import { useMemo } from 'react'

// Genshin's Teams page (shared/ui/TeamsView.tsx), after HSR's Teams panel: four-person teams
export function GenshinTeamsPage() {
  const saved = useGenshinStore((s) => s.characters)
  const artifacts = useGenshinStore((s) => s.artifacts)
  const images = useGenshinImages()
  const roster = useMemo(() => genshinRoster(saved, images), [saved, images])
  const options = useMemo(
    () =>
      roster.map((c) => ({
        value: c.id,
        label: c.name,
        icon: images.characters[c.id.startsWith('Traveler') ? 'Traveler' : c.id]?.icon ?? images.characters[c.id]?.icon,
      })),
    [roster, images],
  )
  return (
    <TeamsView
      game='genshin'
      size={4}
      options={options}
      characterPage='Characters'
      rating={(id) => {
        const character = roster.find((c) => c.id === id)
        if (!character) return null
        const worn = Object.values(character.artifactIds).flatMap((artifactId) => artifacts.find((a) => a.id === artifactId) ?? [])
        return <CharacterBuildRating kind={GENSHIN_CHARACTER_KIND} owner={character} worn={worn} />
      }}
    />
  )
}
