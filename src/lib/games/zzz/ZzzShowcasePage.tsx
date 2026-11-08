import { SimpleGrid } from '@mantine/core'
import { CharacterBuildRating } from 'lib/games/shared/ui/CharacterKind'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import {
  type ShowcaseConfig,
  ShowcaseLookup,
} from 'lib/games/shared/ui/ShowcaseLookup'
import { AGENTS } from 'lib/games/zzz/data/agents'
import { useZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import { useZzzImages } from 'lib/games/zzz/data/images'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import {
  enkaProfilePageUrl,
  fetchEnkaZzzProfile,
  isValidZzzUid,
  loadEnkaZzzStore,
} from 'lib/games/zzz/importer/enkaClient'
import { importEnkaZzzProfile } from 'lib/games/zzz/importer/enkaImport'
import {
  type ParsedEnkaZzz,
  parseEnkaZzz,
} from 'lib/games/zzz/importer/enkaParser'
import { zzzRoster } from 'lib/games/zzz/state/roster'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import {
  scoreDisc,
  zzzDiscWeights,
} from 'lib/games/zzz/stats/discScore'
import { DiscCard } from 'lib/games/zzz/ui/DiscCard'
import { ZzzScoring } from 'lib/games/zzz/ui/ZzzScoring'
import { ZZZ_CHARACTER_KIND } from 'lib/games/zzz/ZzzCharactersPage'
import { useMemo } from 'react'

const CONFIG: ShowcaseConfig<ParsedEnkaZzz> = {
  uidStorageKey: 'zzz-showcase-uid',
  uidLabel: 'ZZZ UID',
  uidPlaceholder: 'e.g. 1000074590',
  isValidUid: isValidZzzUid,
  pageUrl: enkaProfilePageUrl,
  fetchProfile: (uid) => fetchEnkaZzzProfile(uid),
  parse: async (data) => {
    const store = await loadEnkaZzzStore()
    if (!store.ok) return store
    // Parsed on its own, so nothing is matched to (or changes) the saved discs
    const parsed = parseEnkaZzz(data, store.data, { discs: [], builds: [] })
    return parsed.builds.length > 0 ? { ok: true, data: parsed } : { ok: false, reason: parsed.warnings[0]?.message ?? 'No agents in this showcase' }
  },
  importProfile: importEnkaZzzProfile,
  noun: 'agents',
}

// ZZZ's Showcase page (shared/ui/ShowcaseLookup.tsx), after HSR's Showcase tab
export function ZzzShowcasePage() {
  const builds = useZzzStore((s) => s.builds)
  const ownDiscs = useZzzStore((s) => s.discs)
  const images = useZzzImages()
  const gameData = useZzzGameData()
  const roster = useMemo(() => zzzRoster(builds), [builds, gameData])
  return (
    <ShowcaseLookup
      config={CONFIG}
      render={(parsed) => {
        // Their agents first, so squad members in a scoring setup can be theirs too
        const squad = [...parsed.builds, ...roster.filter((b) => !parsed.builds.some((p) => p.agentId === b.agentId))]
        const discs = [...parsed.discs, ...ownDiscs]
        return parsed.builds.map((build) => {
          const agent = AGENTS[build.agentId]
          const worn = Object.values(build.discIds).flatMap((id) => parsed.discs.find((d) => d.id === id) ?? [])
          const weights = agent ? zzzDiscWeights(agent) : {}
          const wEngine = build.wEngineId ? W_ENGINES[build.wEngineId] : undefined
          return (
            <Panel
              key={build.id}
              title={build.name}
              description={`Lv ${build.level} · M${build.mindscapeLevel} · ${wEngine ? `${wEngine.name} R${build.wEngineRefinement ?? 1}` : 'No W-Engine'}`}
            >
              {agent
                ? (
                  <ZzzScoring
                    agent={agent}
                    wEngine={wEngine}
                    build={build}
                    worn={worn}
                    coreSkill={6}
                    roster={squad}
                    discs={discs}
                    images={images}
                    fallback={<CharacterBuildRating kind={ZZZ_CHARACTER_KIND} owner={build} worn={worn} />}
                  />
                )
                : <CharacterBuildRating kind={ZZZ_CHARACTER_KIND} owner={build} worn={worn} />}
              <SimpleGrid cols={{ base: 2, md: 6 }} spacing='xs' mt='md'>
                {worn.map((disc) => <DiscCard key={disc.id} disc={disc} icon={images.sets[disc.setId]} score={scoreDisc(disc, weights)} />)}
              </SimpleGrid>
            </Panel>
          )
        })
      }}
    />
  )
}
