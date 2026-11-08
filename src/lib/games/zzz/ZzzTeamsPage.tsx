import { CharacterBuildRating } from 'lib/games/shared/ui/CharacterKind'
import { TeamsView } from 'lib/games/shared/ui/TeamsView'
import { useZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import { useZzzImages } from 'lib/games/zzz/data/images'
import { zzzRoster } from 'lib/games/zzz/state/roster'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import { ZZZ_CHARACTER_KIND } from 'lib/games/zzz/ZzzCharactersPage'
import { useMemo } from 'react'

// ZZZ's Teams page (shared/ui/TeamsView.tsx), after HSR's Teams panel: three-agent squads
export function ZzzTeamsPage() {
  const builds = useZzzStore((s) => s.builds)
  const discs = useZzzStore((s) => s.discs)
  const images = useZzzImages()
  const gameData = useZzzGameData()
  const roster = useMemo(() => zzzRoster(builds), [builds, gameData])
  const options = useMemo(
    () => [...new Map(roster.map((b) => [b.agentId, { value: b.agentId, label: b.name, icon: images.agents[b.agentId]?.circle }])).values()],
    [roster, images],
  )
  return (
    <TeamsView
      game='zzz'
      size={3}
      options={options}
      characterPage='Agents'
      rating={(id) => {
        const build = roster.find((b) => b.agentId === id)
        if (!build) return null
        const worn = Object.values(build.discIds).flatMap((discId) => discs.find((d) => d.id === discId) ?? [])
        return <CharacterBuildRating kind={ZZZ_CHARACTER_KIND} owner={build} worn={worn} />
      }}
    />
  )
}
