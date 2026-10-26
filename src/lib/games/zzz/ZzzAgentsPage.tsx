import {
  Accordion,
  Badge,
  Button,
  Chip,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import {
  IconArrowBigRightLines,
  IconAtom,
  IconBattery3,
  IconChartBar,
  IconDroplet,
  IconFlame,
  IconHammer,
  IconHeart,
  IconSearch,
  IconShield,
  IconSparkles,
  IconSword,
  IconSwords,
  IconTarget,
  IconTargetArrow,
} from '@tabler/icons-react'
import {
  EmptyState,
  Notices,
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
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
  isSupportedBuild,
  resolveBuild,
} from 'lib/games/zzz/stats/resolveBuild'
import classes from 'lib/games/zzz/ui/AgentShowcase.module.css'
import {
  DiscCard,
  elementColor,
} from 'lib/games/zzz/ui/DiscCard'
import {
  type CSSProperties,
  type ReactNode,
  useMemo,
  useState,
} from 'react'

// The Agents page, after HSR's Characters page: a roster of art banners with search and filters, and one showcase card
// with the agent's art, W-Engine, stat screen and discs. Art comes from Enka (data/images.ts); without it the page
// shows initials instead.

const HIGHLIGHTED = new Set<keyof FinalStats>(['atk', 'critRate', 'critDmg', 'sheerForce'])

const STAT_ICONS: Record<keyof FinalStats, ReactNode> = {
  hp: <IconHeart size={16} />,
  atk: <IconSword size={16} />,
  def: <IconShield size={16} />,
  impact: <IconHammer size={16} />,
  anomalyMastery: <IconSparkles size={16} />,
  anomalyProficiency: <IconAtom size={16} />,
  critRate: <IconTarget size={16} />,
  critDmg: <IconFlame size={16} />,
  penRatio: <IconTargetArrow size={16} />,
  pen: <IconArrowBigRightLines size={16} />,
  energyRegen: <IconBattery3 size={16} />,
  elementDmg: <IconDroplet size={16} />,
  sheerForce: <IconSwords size={16} />,
}

type Preset = 'screen' | 'combat' | 'custom'

function presetOf(conditions: ActiveConditions): Preset {
  const same = (a: ActiveConditions) => (Object.keys(a) as Condition[]).every((key) => a[key] === conditions[key])
  return same(statScreenConditions()) ? 'screen' : same(defaultConditions()) ? 'combat' : 'custom'
}

function initials(name: string): string {
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
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
  const [search, setSearch] = useState('')
  const [elements, setElements] = useState<string[]>([])
  const [specialties, setSpecialties] = useState<string[]>([])
  const [compact, setCompact] = useState(false)
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

  const shown = roster.filter((a) =>
    a.name.toLowerCase().includes(search.trim().toLowerCase())
    && (elements.length === 0 || elements.includes(a.element))
    && (specialties.length === 0 || specialties.includes(a.specialty))
  )
  const allElements = [...new Set(roster.map((a) => a.element))]
  const allSpecialties = [...new Set(roster.map((a) => a.specialty))]

  const agent = resolved?.ok ? resolved.build.agent : undefined
  const wEngine = build?.wEngineId ? W_ENGINES[build.wEngineId] : undefined
  const art = agent ? images.agents[agent.id] : undefined
  const display = computed ? toDisplayStats(computed.stats) : undefined
  const rows = STAT_ROWS.filter((row) => !row.ruptureOnly || agent?.specialty === 'Rupture')
  const notes = [...(resolved?.ok ? resolved.notes : []), ...(computed?.warnings ?? [])]

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Agents'
        description='What the in-game stat screen shows for your saved builds, worked out from the discs, W-Engine and Core Skill.'
      />

      <div className={classes.layout}>
        <div className={classes.roster}>
          <TextInput
            size='sm'
            placeholder='Search'
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Chip.Group multiple value={elements} onChange={setElements}>
            <div className={classes.filters}>
              {allElements.map((element) => <Chip key={element} value={element} size='xs' color={elementColor(element)} variant='light'>{element}</Chip>)}
            </div>
          </Chip.Group>
          <Chip.Group multiple value={specialties} onChange={setSpecialties}>
            <div className={classes.filters}>
              {allSpecialties.map((specialty) => <Chip key={specialty} value={specialty} size='xs' variant='light'>{specialty}</Chip>)}
            </div>
          </Chip.Group>

          <div className={classes.rosterList}>
            {shown.map((entry) => {
              const entryArt = images.agents[entry.agentId]
              const first = entry.builds[0]
              const entryEngine = first.wEngineId ? W_ENGINES[first.wEngineId] : undefined
              return (
                <button
                  key={entry.agentId}
                  type='button'
                  className={classes.banner}
                  data-active={entry === agentEntry || undefined}
                  data-compact={compact || undefined}
                  style={entryArt ? { backgroundImage: `url(${entryArt.portrait})` } : undefined}
                  onClick={() => {
                    setAgentId(entry.agentId)
                    setBuildIndex(0)
                  }}
                >
                  {entryArt
                    ? <img className={classes.circle} src={entryArt.circle} alt='' />
                    : <span className={`${classes.circle} ${classes.initials}`}>{initials(entry.name)}</span>}
                  <span className={classes.bannerText}>
                    <span className={classes.bannerName} style={{ display: 'block' }}>{entry.name}</span>
                    <span className={classes.bannerMeta} style={{ display: 'block' }}>
                      {`${entry.specialty} · ${entryEngine ? `${entryEngine.name} R${first.wEngineRefinement}` : 'No W-Engine'}`}
                    </span>
                  </span>
                </button>
              )
            })}
            {shown.length === 0 && <Text size='xs' c='dimmed'>No agents match.</Text>}
          </div>

          <SegmentedControl
            size='xs'
            value={compact ? 'compact' : 'default'}
            onChange={(value) => setCompact(value === 'compact')}
            data={['default', 'compact'].map((v) => ({ value: v, label: v === 'default' ? 'Default' : 'Compact' }))}
          />
          {unsupported.length > 0 && <Text size='xs' c='dimmed'>{`No stat data yet for ${unsupported.join(', ')}.`}</Text>}
        </div>

        <Stack gap='md'>
          {resolved && !resolved.ok && <Notices messages={[resolved.reason]} />}

          {agent && display && build && (
            <div className={classes.showcase} style={{ '--accent': art?.accent } as CSSProperties}>
              <div className={classes.artColumn}>
                <div className={classes.portrait}>
                  {art ? <img src={art.portrait} alt={agent.name} /> : <div className={classes.portraitFallback}>{initials(agent.name)}</div>}
                </div>
                {wEngine && (
                  <div className={classes.wEngine}>
                    {images.wEngines[wEngine.id] && <img src={images.wEngines[wEngine.id]} alt='' />}
                    <div>
                      <Text size='sm' fw={600}>{wEngine.name}</Text>
                      <Text size='xs' c='dimmed'>{`${wEngine.rarity}-rank · R${build.wEngineRefinement}`}</Text>
                    </div>
                  </div>
                )}
              </div>

              <div className={classes.statsColumn}>
                <div>
                  <Group gap={6}>
                    <Text size='xl' fw={700}>{agent.name}</Text>
                  </Group>
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

                <div className={classes.statList}>
                  {rows.map((row) => (
                    <div key={row.key} className={classes.statRow} data-highlight={HIGHLIGHTED.has(row.key) || undefined}>
                      {STAT_ICONS[row.key]}
                      <span>{row.label}</span>
                      <span className={classes.statValue}>{formatStat(row, display[row.key])}</span>
                    </div>
                  ))}
                </div>

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
                <Group gap={4}>
                  {(Object.keys(CONDITION_LABELS) as Condition[]).map((condition) => (
                    <Chip
                      key={condition}
                      size='xs'
                      variant='light'
                      checked={conditions[condition]}
                      onChange={(checked) => setConditions((prev) => ({ ...prev, [condition]: checked }))}
                    >
                      {CONDITION_LABELS[condition]}
                    </Chip>
                  ))}
                </Group>
              </div>

              <div className={classes.discs}>
                {resolved?.ok && resolved.build.discs.map((disc) => <DiscCard key={disc.id} disc={disc} icon={images.sets[disc.setId]} />)}
              </div>
            </div>
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
        </Stack>
      </div>
    </Stack>
  )
}
