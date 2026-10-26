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
import { IconChartBar } from '@tabler/icons-react'
import { scoreBuild } from 'lib/games/shared/gearScore'
import { BuildRating } from 'lib/games/shared/ui/BuildRating'
import {
  EmptyState,
  Notices,
  PageHeader,
  Panel,
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
import type {
  ActiveConditions,
  Condition,
} from 'lib/games/zzz/data/dataTypes'
import { useZzzImages } from 'lib/games/zzz/data/images'
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
import {
  isSupportedBuild,
  resolveBuild,
} from 'lib/games/zzz/stats/resolveBuild'
import {
  DiscCard,
  elementColor,
} from 'lib/games/zzz/ui/DiscCard'
import {
  useMemo,
  useState,
} from 'react'

// The Agents page, after HSR's Characters page: a roster of art banners with search and filters, and one showcase card
// with the agent's art, W-Engine, stat screen and discs (shared/ui/Showcase.tsx). Art comes from Enka (data/images.ts);
// without it the page shows initials instead.

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

// One roster entry per agent, with every saved build of theirs
type RosterAgent = { agentId: string, name: string, element: string, specialty: string, builds: ImportedBuild[] }

export function ZzzAgentsPage({ onImport }: { onImport: () => void }) {
  const builds = useZzzStore((s) => s.builds)
  const discs = useZzzStore((s) => s.discs)
  const images = useZzzImages()

  const roster = useMemo(() => {
    const byAgent = new Map<string, RosterAgent>()
    for (const build of builds.filter(isSupportedBuild)) {
      const entry = byAgent.get(build.agentId) ?? { agentId: build.agentId, name: build.name, element: build.element, specialty: build.specialty, builds: [] }
      entry.builds.push(build)
      byAgent.set(build.agentId, entry)
    }
    return [...byAgent.values()]
  }, [builds])
  const unsupported = useMemo(() => [...new Set(builds.filter((b) => !isSupportedBuild(b)).map((b) => b.name))], [builds])

  const [agentId, setAgentId] = useState<string | null>(null)
  const [buildIndex, setBuildIndex] = useState(0)
  const [coreSkill, setCoreSkill] = useState('6')
  const [conditions, setConditions] = useState<ActiveConditions>(statScreenConditions())

  const agentEntry = roster.find((a) => a.agentId === agentId) ?? roster[0]
  const build = agentEntry?.builds[Math.min(buildIndex, agentEntry.builds.length - 1)]
  const resolved = useMemo(() => (build ? resolveBuild(build, discs) : undefined), [build, discs])
  const computed = useMemo(
    () => (resolved?.ok ? computeStats({ ...resolved.build, coreSkillLevel: Number(coreSkill), conditions }) : undefined),
    [resolved, coreSkill, conditions],
  )

  if (builds.length === 0) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Agents' />
        <Panel>
          <EmptyState icon={<IconChartBar size={24} />} title='Import your builds to get started' action={<Button onClick={onImport}>Import discs</Button>}>
            See the exact numbers your in-game stat screen shows, and where each one comes from.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  const agent = resolved?.ok ? resolved.build.agent : undefined
  const wEngine = build?.wEngineId ? W_ENGINES[build.wEngineId] : undefined
  const art = agent ? images.agents[agent.id] : undefined
  const display = computed ? toDisplayStats(computed.stats) : undefined
  const rows = STAT_ROWS.filter((row) => !row.ruptureOnly || agent?.specialty === 'Rupture')
  const notes = [...(resolved?.ok ? resolved.notes : []), ...(computed?.warnings ?? [])]
  const discWeights = agent ? zzzDiscWeights(agent) : {}

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Agents'
        description='What the in-game stat screen shows for your saved builds, worked out from the discs, W-Engine and Core Skill.'
      />

      <RosterLayout
        roster={
          <Roster
            active={agentEntry?.agentId}
            onPick={(key) => {
              setAgentId(key)
              setBuildIndex(0)
            }}
            groupColor={elementColor}
            entries={roster.map((entry) => {
              const first = entry.builds[0]
              const engine = first.wEngineId ? W_ENGINES[first.wEngineId] : undefined
              return {
                key: entry.agentId,
                name: entry.name,
                meta: `${entry.specialty} · ${engine ? `${engine.name} R${first.wEngineRefinement}` : 'No W-Engine'}`,
                group: entry.element,
                subgroup: entry.specialty,
                portrait: images.agents[entry.agentId]?.portrait,
                circle: images.agents[entry.agentId]?.circle,
              }
            })}
            footer={unsupported.length > 0 && <Text size='xs' c='dimmed'>{`No stat data yet for ${unsupported.join(', ')}.`}</Text>}
          />
        }
      >
        {resolved && !resolved.ok && <Notices messages={[resolved.reason]} />}

        {agent && display && build && (
          <ShowcaseCard
            name={agent.name}
            accent={art?.accent}
            portrait={art?.portrait}
            weapon={wEngine && { image: images.wEngines[wEngine.id], name: wEngine.name, meta: `${wEngine.rarity}-rank · R${build.wEngineRefinement}` }}
            info={
              <>
                <div>
                  <Text size='xl' fw={700}>{agent.name}</Text>
                  <Group gap={6} mt={4}>
                    <Badge size='sm' variant='light' color={elementColor(agent.element)}>{agent.element}</Badge>
                    <Badge size='sm' variant='light' color='gray'>{agent.specialty}</Badge>
                    <Text size='xs' c='dimmed'>{`Lv ${agent.level}`}</Text>
                  </Group>
                </div>
                <Select size='xs' allowDeselect={false} value={coreSkill} onChange={(value) => setCoreSkill(value ?? '6')} data={CORE_SKILL_OPTIONS} />
                {agentEntry.builds.length > 1 && (
                  <Select
                    size='xs'
                    allowDeselect={false}
                    value={String(Math.min(buildIndex, agentEntry.builds.length - 1))}
                    onChange={(value) => setBuildIndex(Number(value ?? 0))}
                    data={agentEntry.builds.map((b, i) => ({
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
                <BuildRating
                  score={resolved?.ok ? scoreBuild(resolved.build.discs.map((disc) => scoreDisc(disc, discWeights)), 6) : undefined}
                  label='Disc score'
                />

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
            gear={resolved?.ok
              && resolved.build.discs.map((disc) => <DiscCard key={disc.id} disc={disc} icon={images.sets[disc.setId]} score={scoreDisc(disc, discWeights)} />)}
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
      </RosterLayout>
    </Stack>
  )
}
