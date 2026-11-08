import { SimpleGrid } from '@mantine/core'
import { useGenshinImages } from 'lib/games/genshin/data/images'
import { GENSHIN_CHARACTER_KIND } from 'lib/games/genshin/GenshinCharactersPage'
import {
  enkaProfilePageUrl,
  fetchEnkaGenshinProfile,
  isValidGenshinUid,
  loadEnkaGenshinStore,
} from 'lib/games/genshin/importer/enkaClient'
import { importEnkaGenshinProfile } from 'lib/games/genshin/importer/enkaImport'
import {
  type ParsedEnkaGenshin,
  parseEnkaGenshin,
} from 'lib/games/genshin/importer/enkaParser'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import { genshinRoster } from 'lib/games/genshin/state/roster'
import {
  genshinArtifactWeights,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import { ArtifactCard } from 'lib/games/genshin/ui/ArtifactCard'
import { GenshinScoring } from 'lib/games/genshin/ui/GenshinScoring'
import { todayString } from 'lib/games/shared/importedPresets'
import { CharacterBuildRating } from 'lib/games/shared/ui/CharacterKind'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import {
  type ShowcaseConfig,
  ShowcaseLookup,
} from 'lib/games/shared/ui/ShowcaseLookup'
import { useMemo } from 'react'

const CONFIG: ShowcaseConfig<ParsedEnkaGenshin> = {
  uidStorageKey: 'genshin-showcase-uid',
  uidLabel: 'Genshin UID',
  uidPlaceholder: 'e.g. 602175084',
  isValidUid: isValidGenshinUid,
  pageUrl: enkaProfilePageUrl,
  fetchProfile: (uid) => fetchEnkaGenshinProfile(uid),
  parse: async (data) => {
    const store = await loadEnkaGenshinStore()
    if (!store.ok) return store
    const parsed = parseEnkaGenshin(data, store.data, todayString(new Date()))
    return parsed.characters.length > 0 ? { ok: true, data: parsed } : { ok: false, reason: parsed.warnings[0] ?? 'No characters in this showcase' }
  },
  importProfile: importEnkaGenshinProfile,
  noun: 'characters',
}

// Genshin's Showcase page (shared/ui/ShowcaseLookup.tsx), after HSR's Showcase tab
export function GenshinShowcasePage() {
  const saved = useGenshinStore((s) => s.characters)
  const ownArtifacts = useGenshinStore((s) => s.artifacts)
  const images = useGenshinImages()
  const roster = useMemo(() => genshinRoster(saved, images), [saved, images])
  return (
    <ShowcaseLookup
      config={CONFIG}
      render={(parsed) => {
        // Their characters first, so teammates in a scoring setup can be theirs too
        const characters = [...parsed.characters, ...roster.filter((c) => !parsed.characters.some((p) => p.id === c.id))]
        const artifacts = [...parsed.artifacts, ...ownArtifacts]
        return parsed.characters.map((character) => {
          const worn = Object.values(character.artifactIds).flatMap((id) => parsed.artifacts.find((a) => a.id === id) ?? [])
          const weights = genshinArtifactWeights(character)
          return (
            <Panel
              key={character.id}
              title={character.name}
              description={`Lv ${character.level} · C${character.constellation} · ${
                character.weapon ? `${character.weapon.name} R${character.weapon.refinement}` : 'No weapon'
              }`}
            >
              <GenshinScoring
                character={character}
                worn={worn}
                roster={characters}
                artifacts={artifacts}
                images={images}
                fallback={<CharacterBuildRating kind={GENSHIN_CHARACTER_KIND} owner={character} worn={worn} />}
              />
              <SimpleGrid cols={{ base: 2, md: 5 }} spacing='xs' mt='md'>
                {worn.map((artifact) => (
                  <ArtifactCard
                    key={artifact.id}
                    artifact={artifact}
                    icon={images.artifacts[artifact.setId]?.[artifact.slot]}
                    score={scoreArtifact(artifact, weights)}
                  />
                ))}
              </SimpleGrid>
            </Panel>
          )
        })
      }}
    />
  )
}
