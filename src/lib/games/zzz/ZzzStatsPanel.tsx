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
} from '@mantine/core'
import { IconChartBar } from '@tabler/icons-react'
import {
  EmptyState,
  Notices,
  PageHeader,
  Panel,
  PickList,
  SideLayout,
  StatGrid,
} from 'lib/games/shared/ui/GameLayout'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import type {
  ActiveConditions,
  Condition,
} from 'lib/games/zzz/data/dataTypes'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
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
  statScreenConditions,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
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

// Stats people look at first get the highlighted tiles
const HIGHLIGHTED = new Set(['atk', 'critRate', 'critDmg', 'sheerForce'])

type Preset = 'screen' | 'combat' | 'custom'

function presetOf(conditions: ActiveConditions): Preset {
  const screen = statScreenConditions()
  const combat = defaultConditions()
  const same = (a: ActiveConditions) => (Object.keys(a) as Condition[]).every((key) => a[key] === conditions[key])
  return same(screen) ? 'screen' : same(combat) ? 'combat' : 'custom'
}

export function ZzzStatsPanel({ onImport }: { onImport: () => void }) {
  const builds = useZzzStore((s) => s.builds)
  const discs = useZzzStore((s) => s.discs)

  const supportedBuilds = useMemo(() => builds.filter(isSupportedBuild), [builds])
  const otherBuilds = useMemo(() => builds.filter((b) => !isSupportedBuild(b)), [builds])
  const [buildId, setBuildId] = useState<string | null>(null)
  const [coreSkill, setCoreSkill] = useState('6')
  const [conditions, setConditions] = useState<ActiveConditions>(statScreenConditions())

  const selected = supportedBuilds.find((b) => b.id === buildId) ?? supportedBuilds[0]
  const resolved = useMemo(() => selected ? resolveBuild(selected, discs) : undefined, [selected, discs])
  const computed = useMemo(() => {
    if (!resolved?.ok) return undefined
    return computeStats({ ...resolved.build, coreSkillLevel: Number(coreSkill), conditions })
  }, [resolved, coreSkill, conditions])

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
  const display = computed ? toDisplayStats(computed.stats) : undefined
  const rows = STAT_ROWS.filter((row) => !row.ruptureOnly || agent?.specialty === 'Rupture')
  const notes = [...(resolved?.ok ? resolved.notes : []), ...(computed?.warnings ?? [])]
  const preset = presetOf(conditions)

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Agents'
        description='What the in-game stat screen shows for your saved builds, worked out from the discs, W-Engine and Core Skill.'
      />

      <SideLayout
        side={
          <Panel title='Your builds' description={`${supportedBuilds.length} with stat data`}>
            <PickList
              active={selected?.id}
              onPick={setBuildId}
              items={supportedBuilds.map((build) => {
                const wEngine = build.wEngineId ? W_ENGINES[build.wEngineId] : undefined
                return {
                  key: build.id,
                  title: build.name,
                  meta: `${build.specialty} · ${wEngine ? `${wEngine.name} R${build.wEngineRefinement}` : 'No W-Engine'}`,
                  badge: <Badge size='xs' variant='light' color={elementColor(build.element)}>{build.element}</Badge>,
                }
              })}
            />
            {otherBuilds.length > 0 && (
              <Text size='xs' c='dimmed' mt='sm'>
                {`No stat data yet for ${otherBuilds.map((b) => b.name).join(', ')}.`}
              </Text>
            )}
          </Panel>
        }
      >
        {resolved && !resolved.ok && <Notices messages={[resolved.reason]} />}

        {agent && display && (
          <Panel
            title={
              <Group gap={8}>
                <span>{agent.name}</span>
                <Badge size='sm' variant='light' color={elementColor(agent.element)}>{agent.element}</Badge>
                <Badge size='sm' variant='light' color='gray'>{agent.specialty}</Badge>
              </Group>
            }
            description={`Level ${agent.level}`}
            actions={<Select w={150} allowDeselect={false} value={coreSkill} onChange={(value) => setCoreSkill(value ?? '6')} data={CORE_SKILL_OPTIONS} />}
          >
            <Stack gap='md'>
              <Group gap='sm' wrap='wrap'>
                <SegmentedControl
                  value={preset}
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

              <StatGrid
                stats={rows.map((row) => ({
                  key: row.key,
                  label: row.label,
                  value: formatStat(row, display[row.key]),
                  highlight: HIGHLIGHTED.has(row.key),
                }))}
              />

              <Notices messages={notes} />
            </Stack>
          </Panel>
        )}

        {resolved?.ok && (
          <Panel title='Equipped discs'>
            <div className={gear.grid}>
              {resolved.build.discs.map((disc) => <DiscCard key={disc.id} disc={disc} />)}
            </div>
          </Panel>
        )}

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
      </SideLayout>
    </Stack>
  )
}
