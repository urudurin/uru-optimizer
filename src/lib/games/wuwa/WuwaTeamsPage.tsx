import { CharacterBuildRating } from 'lib/games/shared/ui/CharacterKind'
import { TeamsView } from 'lib/games/shared/ui/TeamsView'
import { characterName } from 'lib/games/wuwa/data/gameData'
import { useUserArt } from 'lib/games/wuwa/data/userArt'
import { wuwaRoster } from 'lib/games/wuwa/state/roster'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import { WUWA_CHARACTER_KIND } from 'lib/games/wuwa/WuwaCharactersPage'
import { useMemo } from 'react'

// WuWa's Teams page (shared/ui/TeamsView.tsx), after HSR's Teams panel: three-Resonator teams
export function WuwaTeamsPage() {
  const saved = useWuwaStore((s) => s.characters)
  const echoes = useWuwaStore((s) => s.echoes)
  const art = useUserArt()
  const roster = useMemo(() => wuwaRoster(saved), [saved])
  const options = useMemo(
    () => roster.map((c) => ({ value: c.charId, label: characterName(c.charId), icon: art[c.charId]?.icon ?? art[c.charId]?.portrait })),
    [roster, art],
  )
  return (
    <TeamsView
      game='wuwa'
      size={3}
      options={options}
      characterPage='Resonators'
      rating={(id) => {
        const character = roster.find((c) => c.charId === id)
        if (!character) return null
        const worn = character.echoIds.flatMap((echoId) => echoes.find((e) => e.id === echoId) ?? [])
        return <CharacterBuildRating kind={WUWA_CHARACTER_KIND} owner={character} worn={worn} />
      }}
    />
  )
}
