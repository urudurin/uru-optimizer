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
import { scoreBuild } from 'lib/games/shared/gearScore'
import { BuildRating } from 'lib/games/shared/ui/BuildRating'
import {
  Notices,
  PageHeader,
} from 'lib/games/shared/ui/GameLayout'
import {
  Roster,
  RosterLayout,
  ShowcaseCard,
  StatList,
} from 'lib/games/shared/ui/Showcase'
import {
  statIcon,
  type StatIconKind,
} from 'lib/games/shared/ui/statIcons'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type {
  ActiveConditions,
  Condition,
} from 'lib/games/zzz/data/dataTypes'
import {
  useZzzImages,
  type ZzzImages,
} from 'lib/games/zzz/data/images'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import {
  CONDITION_LABELS,
  CORE_SKILL_OPTIONS,
  formatStat,
  STAT_ROWS,
} from 'lib/games/zzz/statLabels'
import {
  computeStats,
  defaultConditions,
  type FinalStats,
  statScreenConditions,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
import {
  scoreDisc,
  zzzDiscWeights,
} from 'lib/games/zzz/stats/discScore'
import { resolveBuild } from 'lib/games/zzz/stats/resolveBuild'
import {
  AgentForm,
  defaultWEngine,
} from 'lib/games/zzz/ui/AgentForm'
import {
  DiscCard,
  elementColor,
} from 'lib/games/zzz/ui/DiscCard'
import {
  useMemo,
  useState,
} from 'react'

// The Agents page, after HSR's Characters page: a roster of art banners with search and filters, and one showcase card
// with the agent's art, W-Engine, stat screen and discs (shared/ui/Showcase.tsx). The roster lists every agent Enka
// knows (or every agent with stat data until Enka loads); ones not in the save are dimmed, and those with stat data can
// be added by hand (Mindscape, W-Engine). Art comes from Enka (data/images.ts); without it the page shows initials.

const HIGHLIGHTED = new Set<keyof FinalStats>(['atk', 'critRate', 'critDmg', 'sheerForce'])

const STAT_ICON_KINDS: Record<keyof FinalStats, StatIconKind> = {
  hp: 'hp',
  atk: 'atk',
  def: 'def',
  impact: 'impact',
  anomalyMastery: 'mastery',
  anomalyProficiency: 'proficiency',
  critRate: 'critRate',
  critDmg: 'critDmg',
  penRatio: 'penRatio',
  pen: 'pen',
  energyRegen: 'energy',
  elementDmg: 'elementDmg',
  sheerForce: 'sheer',
}

type Preset = 'screen' | 'combat' | 'custom'

function presetOf(conditions: ActiveConditions): Preset {
  const same = (a: ActiveConditions) => (Object.keys(a) as Condition[]).every((key) => a[key] === conditions[key])
  return same(statScreenConditions()) ? 'screen' : same(defaultConditions()) ? 'combat' : 'custom'
}

// One roster entry per agent, with every saved build of theirs (none for agents not in the save)
type RosterAgent = { agentId: string, name: string, element: string, specialty: string, builds: ImportedBuild[] }

export function ZzzAgentsPage({ onImport }: { onImport: () => void }) {
  const builds = useZzzStore((s) => s.builds)
  const images = useZzzImages()
  const [agentId, setAgentId] = useState<string | null>(null)

  // Saved agents first, then everyone else by name
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
    for (const agent of known) if (!byAgent.has(agent.agentId) && !others.has(agent.agentId)) others.set(agent.agentId, agent)
    return [...byAgent.values(), ...[...others.values()].sort((a, b) => a.name.localeCompare(b.name))]
  }, [builds, images])

  const entry = roster.find((a) => a.agentId === agentId) ?? roster[0]

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Agents'
        description='What the in-game stat screen shows for your saved builds, worked out from the discs, W-Engine and Core Skill.'
      />

      <RosterLayout
        roster={
          <Roster
            active={entry?.agentId}
            onPick={setAgentId}
            groupColor={elementColor}
            entries={roster.map((agent) => {
              const first = agent.builds[0]
              const engine = first?.wEngineId ? W_ENGINES[first.wEngineId] : undefined
              const meta = !first
                ? AGENTS[agent.agentId] ? 'Not added' : 'Not added · no stat data yet'
                : !AGENTS[agent.agentId]
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
                dimmed: !first,
              }
            })}
          />
        }
      >
        {entry && (AGENTS[entry.agentId]
          ? entry.builds.length > 0
            ? <SavedAgent key={entry.agentId} entry={entry} images={images} />
            : <NewAgent key={entry.agentId} entry={entry} images={images} onImport={builds.length === 0 ? onImport : undefined} />
          : <NoDataAgent key={entry.agentId} entry={entry} images={images} />)}
      </RosterLayout>
    </Stack>
  )
}

function SavedAgent({ entry, images }: { entry: RosterAgent, images: ZzzImages }) {
  const discs = useZzzStore((s) => s.discs)
  const saveBuild = useZzzStore((s) => s.saveBuild)
  const [buildIndex, setBuildIndex] = useState(0)
  const [coreSkill, setCoreSkill] = useState('6')
  const [conditions, setConditions] = useState<ActiveConditions>(statScreenConditions())
  const [editing, setEditing] = useState(false)

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
  const rows = STAT_ROWS.filter((row) => !row.ruptureOnly || entry.specialty === 'Rupture')
  const notes = [...(resolved.ok ? resolved.notes : []), ...(computed?.warnings ?? [])]
  const discWeights = agent ? zzzDiscWeights(agent) : {}
  const worn = resolved.ok ? resolved.build.discs : []

  const form = editing && (
    <AgentForm
      initial={build}
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
          name={agent.name}
          accent={art?.accent}
          portrait={art?.portrait}
          weapon={wEngine && { image: images.wEngines[wEngine.id], name: wEngine.name, meta: `${wEngine.rarity}-rank · R${build.wEngineRefinement}` }}
          info={
            <>
              <div>
                <Group justify='space-between' wrap='nowrap'>
                  <Text size='xl' fw={700}>{agent.name}</Text>
                  {!editing && <Button size='compact-xs' variant='subtle' onClick={() => setEditing(true)}>Edit</Button>}
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

              <StatList
                rows={rows.map((row) => ({
                  key: row.key,
                  icon: statIcon(STAT_ICON_KINDS[row.key]),
                  label: row.label,
                  value: formatStat(row, display[row.key]),
                  highlight: HIGHLIGHTED.has(row.key),
                }))}
              />
              <BuildRating score={scoreBuild(worn.map((disc) => scoreDisc(disc, discWeights)), 6)} label='Disc score' />

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

// An agent with stat data who isn't in the save yet
function NewAgent({ entry, images, onImport }: { entry: RosterAgent, images: ZzzImages, onImport?: () => void }) {
  const saveBuild = useZzzStore((s) => s.saveBuild)
  const agent = AGENTS[entry.agentId]
  const art = images.agents[entry.agentId]
  const initial: ImportedBuild = {
    id: `uru-${agent.id}`,
    agentId: agent.id,
    name: agent.name,
    element: agent.element,
    specialty: agent.specialty,
    level: agent.level,
    mindscapeLevel: 0,
    wEngineId: defaultWEngine(agent.specialty),
    wEngineRefinement: 1,
    discIds: {},
  }

  return (
    <ShowcaseCard
      name={agent.name}
      accent={art?.accent}
      portrait={art?.portrait}
      info={
        <>
          <AgentHeading entry={entry} status='Not added' />
          <Text size='sm' c='dimmed'>Add their Mindscape and W-Engine to see their stats. Discs come from an import or the Optimizer.</Text>
          <AgentForm initial={initial} submitLabel='Add agent' onSubmit={saveBuild} />
          {onImport && <Button size='xs' variant='light' onClick={onImport}>Import data instead</Button>}
        </>
      }
      gear={<Text size='sm' c='dimmed'>No discs yet.</Text>}
    />
  )
}

// An agent this site has no stat data for yet, saved or not
function NoDataAgent({ entry, images }: { entry: RosterAgent, images: ZzzImages }) {
  const art = images.agents[entry.agentId]
  return (
    <ShowcaseCard
      name={entry.name}
      accent={art?.accent}
      portrait={art?.portrait}
      info={
        <>
          <AgentHeading entry={entry} status={entry.builds.length > 0 ? 'Saved' : 'Not added'} />
          <Text size='sm' c='dimmed'>
            {`No stat data for ${entry.name} yet, so their stats can't be worked out. Agents with data: ${
              Object.values(AGENTS).map((a) => a.name).join(', ')
            }.`}
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
