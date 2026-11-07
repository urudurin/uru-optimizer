import {
  Accordion,
  Badge,
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Text,
} from '@mantine/core'
import {
  orderByPriority,
  usePriority,
} from 'lib/games/shared/characterPriority'
import { scoreBuild } from 'lib/games/shared/gearScore'
import { useScoreWeightsVersion } from 'lib/games/shared/scoreWeights'
import {
  CharacterBuildRating,
  type CharacterKind,
  CharacterKindMenu,
} from 'lib/games/shared/ui/CharacterKind'
import {
  Notices,
} from 'lib/games/shared/ui/GameLayout'
import {
  RosterLayout,
  ShowcaseCard,
  StatList,
  sumRolls,
} from 'lib/games/shared/ui/Showcase'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type {
  ActiveConditions,
  Condition,
} from 'lib/games/zzz/data/dataTypes'
import { useZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import {
  useZzzImages,
  type ZzzImages,
} from 'lib/games/zzz/data/images'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import { SUBSTAT_STATS } from 'lib/games/zzz/discStats'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import { defaultZzzBuild } from 'lib/games/zzz/state/roster'
import { zzzRoster } from 'lib/games/zzz/state/roster'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import {
  CONDITION_LABELS,
  CORE_SKILL_OPTIONS,
} from 'lib/games/zzz/statLabels'
import {
  computeStats,
  defaultConditions,
  statScreenConditions,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
import {
  defaultDiscWeights,
  scoreDisc,
  zzzDiscWeights,
} from 'lib/games/zzz/stats/discScore'
import { resolveBuild } from 'lib/games/zzz/stats/resolveBuild'
import type { Disc } from 'lib/games/zzz/types'
import {
  AgentForm,
} from 'lib/games/zzz/ui/AgentForm'
import { zzzStatRows } from 'lib/games/zzz/ui/agentStats'
import {
  DiscCard,
  elementColor,
} from 'lib/games/zzz/ui/DiscCard'
import { ZzzScoring } from 'lib/games/zzz/ui/ZzzScoring'
import {
  useMemo,
  useState,
} from 'react'

// The Agents page, after HSR's Characters page: a roster of art banners with search and filters, and one showcase card
// with the agent's art, W-Engine, stat screen and discs (shared/ui/Showcase.tsx). The roster lists every agent Enka
// knows (or every agent with stat data until Enka loads); ones not in the save are dimmed, and those with stat data can
// be added by hand (Mindscape, W-Engine). Art comes from Enka (data/images.ts); without it the page shows initials.

type Preset = 'screen' | 'combat' | 'custom'

function presetOf(conditions: ActiveConditions): Preset {
  const same = (a: ActiveConditions) => (Object.keys(a) as Condition[]).every((key) => a[key] === conditions[key])
  return same(statScreenConditions()) ? 'screen' : same(defaultConditions()) ? 'combat' : 'custom'
}

// One roster entry per agent, with every saved build of theirs. Agents with stat data but no saved build get a default
// one (state/roster.ts), like HSR where every character is available; agents without stat data have none
type RosterAgent = { agentId: string, name: string, element: string, specialty: string, builds: ImportedBuild[] }

export function ZzzCharactersPage() {
  const builds = useZzzStore((s) => s.builds)
  const images = useZzzImages()
  // Every agent and W-Engine, once Enka's data has loaded (data/enkaGameData.ts)
  const gameData = useZzzGameData()
  const [agentId, setAgentId] = useState<string | null>(null)

  // Saved agents first, then everyone else by name
  // Saved ones in priority order (shared/characterPriority.ts)
  const rankOrder = usePriority('zzz')
  const roster = useMemo(() => {
    const byAgent = new Map<string, RosterAgent>()
    for (const build of builds) {
      const entry = byAgent.get(build.agentId) ?? { agentId: build.agentId, name: build.name, element: build.element, specialty: build.specialty, builds: [] }
      entry.builds.push(build)
      byAgent.set(build.agentId, entry)
    }
    const known: RosterAgent[] = [
      ...Object.entries(images.agentInfo).map(([id, info]) => ({ agentId: id, ...info, builds: [] })),
      ...Object.values(AGENTS).map((agent) => ({ agentId: agent.id, name: agent.name, element: agent.element, specialty: agent.specialty, builds: [] })),
    ]
    const others = new Map<string, RosterAgent>()
    for (const agent of known) {
      if (byAgent.has(agent.agentId) || others.has(agent.agentId)) continue
      const data = AGENTS[agent.agentId]
      others.set(agent.agentId, data ? { ...agent, builds: [defaultZzzBuild(data)] } : agent)
    }
    return [
      ...orderByPriority([...byAgent.keys()], rankOrder).map((id) => byAgent.get(id)!),
      ...[...others.values()].sort((a, b) => a.name.localeCompare(b.name)),
    ]
  }, [builds, images, gameData, rankOrder])

  const entry = roster.find((a) => a.agentId === agentId) ?? roster[0]

  return (
    <Stack gap='lg'>
      <RosterLayout
        active={entry?.agentId}
        onPick={setAgentId}
        groupColor={elementColor}
        entries={roster.map((agent) => {
          const first = agent.builds[0]
          const engine = first?.wEngineId ? W_ENGINES[first.wEngineId] : undefined
          const meta = !first || !AGENTS[agent.agentId]
            ? `${agent.specialty} · no stat data yet`
            : `${agent.specialty} · ${engine ? `${engine.name} R${first.wEngineRefinement}` : 'No W-Engine'}`
          return {
            key: agent.agentId,
            name: agent.name,
            meta,
            group: agent.element,
            subgroup: agent.specialty,
            portrait: images.agents[agent.agentId]?.portrait,
            circle: images.agents[agent.agentId]?.circle,
            // Agents without stat data can't be used yet
            dimmed: !AGENTS[agent.agentId],
          }
        })}
      >
        {entry && (AGENTS[entry.agentId] && entry.builds.length > 0
          ? <SavedAgent key={entry.agentId} entry={entry} images={images} />
          : <NoDataAgent key={entry.agentId} entry={entry} images={images} />)}
      </RosterLayout>
    </Stack>
  )
}

// The Character menu's game parts (shared/ui/CharacterKind.tsx); owners are builds, an agent can have several
const ZZZ_CHARACTER_KIND: CharacterKind<ImportedBuild, Disc> = {
  game: 'zzz',
  gearNoun: 'discs',
  ownerId: (build) => build.id,
  characterId: (build) => build.agentId,
  ownerLabel: (build) => build.name,
  wornBy: (build, byId) => Object.values(build.discIds).flatMap((id) => (id ? byId.get(id) ?? [] : [])),
  setNameOf: (disc) => disc.setName,
  buildScore: (build, worn) => {
    const agent = AGENTS[build.agentId]
    return agent ? scoreBuild(worn.map((disc) => scoreDisc(disc, zzzDiscWeights(agent))), 6) : undefined
  },
  buildScoreLabel: 'Disc score',
  scoring: (build) => {
    const agent = AGENTS[build.agentId]
    return {
      stats: SUBSTAT_STATS.map((stat) => ({ value: stat, label: stat })),
      current: zzzDiscWeights(agent),
      defaults: defaultDiscWeights(agent),
    }
  },
  switchGear: (a, b) => useZzzStore.getState().switchGear(a, b),
  unequipOwner: (id) => useZzzStore.getState().unequipOwner(id),
  deleteOwner: (id) => useZzzStore.getState().deleteOwner(id),
  equip: (build, pieces) => useZzzStore.getState().equip(AGENTS[build.agentId], { id: build.wEngineId ?? '', refinement: build.wEngineRefinement }, pieces),
}

function SavedAgent({ entry, images }: { entry: RosterAgent, images: ZzzImages }) {
  const discs = useZzzStore((s) => s.discs)
  const saveBuild = useZzzStore((s) => s.saveBuild)
  const [buildIndex, setBuildIndex] = useState(0)
  const [coreSkill, setCoreSkill] = useState('6')
  const [conditions, setConditions] = useState<ActiveConditions>(statScreenConditions())
  const [editing, setEditing] = useState(false)
  // The Character menu (after HSR's), on the build shown: other saved builds to switch with, and saved builds
  const allBuilds = useZzzStore((s) => s.builds)
  // Every agent's build, for the DPS score's squad
  const roster = useMemo(() => zzzRoster(allBuilds), [allBuilds])
  const discById = useMemo(() => new Map(discs.map((disc) => [disc.id, disc])), [discs])
  // Re-render when scoring weights are saved
  useScoreWeightsVersion()

  const build = entry.builds[Math.min(buildIndex, entry.builds.length - 1)]
  const resolved = useMemo(() => resolveBuild(build, discs), [build, discs])
  const computed = useMemo(
    () => (resolved.ok ? computeStats({ ...resolved.build, coreSkillLevel: Number(coreSkill), conditions }) : undefined),
    [resolved, coreSkill, conditions],
  )

  const agent = resolved.ok ? resolved.build.agent : undefined
  const wEngine = build.wEngineId ? W_ENGINES[build.wEngineId] : undefined
  const art = images.agents[entry.agentId]
  const display = computed ? toDisplayStats(computed.stats) : undefined
  const notes = [...(resolved.ok ? resolved.notes : []), ...(computed?.warnings ?? [])]
  const discWeights = agent ? zzzDiscWeights(agent) : {}
  const worn = resolved.ok ? resolved.build.discs : []

  const form = editing && (
    <AgentForm
      initial={build}
      images={images}
      submitLabel='Save'
      onSubmit={(changed) => {
        saveBuild(changed)
        setEditing(false)
      }}
      onCancel={() => setEditing(false)}
    />
  )

  return (
    <>
      {!resolved.ok && (
        <>
          <Notices messages={[resolved.reason]} />
          {form || <Button size='xs' variant='light' w='fit-content' onClick={() => setEditing(true)}>Edit build</Button>}
        </>
      )}

      {agent && display && (
        <ShowcaseCard
          sidePanel
          heading={{ rank: images.agentInfo[entry.agentId]?.rank }}
          colorKey={`zzz:${entry.agentId}`}
          breakdown={{
            pieces: worn.map((d) => ({ key: d.id, label: `Slot ${d.slot} · ${d.setName}`, score: scoreDisc(d, discWeights) })),
            rolls: sumRolls(worn.flatMap((d) => d.substats.map((s) => ({ stat: s.stat, rolls: s.rolls }))), (stat) => stat, discWeights),
            rollUnit: 'rolls',
          }}
          name={agent.name}
          accent={art?.accent}
          portrait={art?.portrait}
          weapon={wEngine && { image: images.wEngines[wEngine.id], name: wEngine.name, meta: `${wEngine.rarity}-rank · R${build.wEngineRefinement}` }}
          info={
            <>
              <div>
                <Group justify='space-between' wrap='nowrap'>
                  <Text size='xl' fw={700}>{agent.name}</Text>
                  {!editing && (
                    <CharacterKindMenu
                      kind={ZZZ_CHARACTER_KIND}
                      owner={build}
                      name={agent.name}
                      owners={allBuilds}
                      gearById={discById}
                      onEdit={() => setEditing(true)}
                    />
                  )}
                </Group>
                <Group gap={6} mt={4}>
                  <Badge size='sm' variant='light' color={elementColor(agent.element)}>{agent.element}</Badge>
                  <Badge size='sm' variant='light' color='gray'>{agent.specialty}</Badge>
                  <Text size='xs' c='dimmed'>{`Lv ${agent.level} · M${build.mindscapeLevel}`}</Text>
                </Group>
              </div>
              {form}
              <Select size='xs' allowDeselect={false} value={coreSkill} onChange={(value) => setCoreSkill(value ?? '6')} data={CORE_SKILL_OPTIONS} />
              {entry.builds.length > 1 && (
                <Select
                  size='xs'
                  allowDeselect={false}
                  value={String(Math.min(buildIndex, entry.builds.length - 1))}
                  onChange={(value) => setBuildIndex(Number(value ?? 0))}
                  data={entry.builds.map((b, i) => ({
                    value: String(i),
                    label: `Build ${i + 1}: ${b.wEngineId ? W_ENGINES[b.wEngineId]?.name ?? 'W-Engine' : 'No W-Engine'}`,
                  }))}
                />
              )}

              <StatList rows={zzzStatRows(display, entry.specialty)} />
              {agent
                ? (
                  <ZzzScoring
                    agent={agent}
                    wEngine={wEngine}
                    build={build}
                    worn={worn}
                    coreSkill={Number(coreSkill)}
                    roster={roster}
                    discs={discs}
                    images={images}
                    fallback={<CharacterBuildRating kind={ZZZ_CHARACTER_KIND} owner={build} worn={worn} />}
                  />
                )
                : <CharacterBuildRating kind={ZZZ_CHARACTER_KIND} owner={build} worn={worn} />}

              <SegmentedControl
                size='xs'
                value={presetOf(conditions)}
                onChange={(value) => {
                  if (value === 'screen') setConditions(statScreenConditions())
                  if (value === 'combat') setConditions(defaultConditions())
                }}
                data={[
                  { value: 'screen', label: 'Stat screen' },
                  { value: 'combat', label: 'In combat' },
                  { value: 'custom', label: 'Custom', disabled: true },
                ]}
              />
              {/* Switches, not chips: their labels wrap, so long ones stay inside the column */}
              <Stack gap={6}>
                {(Object.keys(CONDITION_LABELS) as Condition[]).map((condition) => (
                  <Switch
                    key={condition}
                    size='xs'
                    label={CONDITION_LABELS[condition]}
                    checked={conditions[condition]}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked
                      setConditions((prev) => ({ ...prev, [condition]: checked }))
                    }}
                  />
                ))}
              </Stack>
            </>
          }
          gear={worn.length > 0
            ? worn.map((disc) => <DiscCard key={disc.id} disc={disc} icon={images.sets[disc.setId]} score={scoreDisc(disc, discWeights)} />)
            : <Text size='sm' c='dimmed'>No discs equipped. Pick some on the Optimizer page and equip them.</Text>}
        />
      )}

      <Notices messages={notes} />

      {computed && (
        <Accordion variant='separated' radius='md'>
          <Accordion.Item value='breakdown'>
            <Accordion.Control>
              <Text size='sm' fw={600}>Where the numbers come from</Text>
              <Text size='xs' c='dimmed'>{`${computed.contributions.length} bonuses from discs, sets, W-Engine and Core Skill`}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Table.ScrollContainer minWidth={480}>
                <Table striped verticalSpacing={4}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Source</Table.Th>
                      <Table.Th>Stat</Table.Th>
                      <Table.Th ta='right'>Value</Table.Th>
                      <Table.Th>Only when</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {computed.contributions.map((c, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{c.source}</Table.Td>
                        <Table.Td>{c.stat}</Table.Td>
                        <Table.Td ta='right'>{c.value}</Table.Td>
                        <Table.Td c='dimmed'>{c.condition ? CONDITION_LABELS[c.condition] : ''}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
    </>
  )
}

// An agent this site has no stat data for yet, saved or not
function NoDataAgent({ entry, images }: { entry: RosterAgent, images: ZzzImages }) {
  const art = images.agents[entry.agentId]
  return (
    <ShowcaseCard
      sidePanel
      heading={{ rank: images.agentInfo[entry.agentId]?.rank }}
      colorKey={`zzz:${entry.agentId}`}
      name={entry.name}
      accent={art?.accent}
      portrait={art?.portrait}
      info={
        <>
          <AgentHeading entry={entry} status='No stat data yet' />
          <Text size='sm' c='dimmed'>
            {`No stat data for ${entry.name}: it comes from Enka.Network's game data, which hasn't loaded (or doesn't have them yet).`}
          </Text>
        </>
      }
      gear={null}
    />
  )
}

function AgentHeading({ entry, status }: { entry: RosterAgent, status: string }) {
  return (
    <div>
      <Text size='xl' fw={700}>{entry.name}</Text>
      <Group gap={6} mt={4}>
        <Badge size='sm' variant='light' color={elementColor(entry.element)}>{entry.element}</Badge>
        <Badge size='sm' variant='light' color='gray'>{entry.specialty}</Badge>
        <Text size='xs' c='dimmed'>{status}</Text>
      </Group>
    </div>
  )
}
