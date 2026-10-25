import {
  Alert,
  Button,
  Group,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core'
import type {
  ActiveConditions,
  Condition,
  Specialty,
} from 'lib/games/zzz/data/dataTypes'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import {
  type ComputeResult,
  computeStats,
  type FinalStats,
  statScreenConditions,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
import {
  isSupportedBuild,
  resolveBuild,
} from 'lib/games/zzz/stats/resolveBuild'
import {
  useMemo,
  useState,
} from 'react'

const CONDITION_LABELS: Record<Condition, string> = {
  onField: 'Agent is on the field (combat)',
  inEtherVeil: 'Inside an Ether Veil',
  veilTriggered: 'Ether Veil just activated',
}

const CORE_SKILL_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F'].map((label, i) => ({ value: String(i + 1), label: `Core Skill ${label}` }))

const STAT_ROWS: { key: keyof FinalStats, label: string, suffix?: string, ruptureOnly?: boolean }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
  { key: 'impact', label: 'Impact' },
  { key: 'critRate', label: 'CRIT Rate', suffix: '%' },
  { key: 'critDmg', label: 'CRIT DMG', suffix: '%' },
  { key: 'anomalyMastery', label: 'Anomaly Mastery' },
  { key: 'anomalyProficiency', label: 'Anomaly Proficiency' },
  { key: 'penRatio', label: 'PEN Ratio', suffix: '%' },
  { key: 'pen', label: 'PEN' },
  { key: 'energyRegen', label: 'Energy Regen' },
  { key: 'elementDmg', label: 'Element DMG bonus (stats and sets)', suffix: '%' },
  { key: 'sheerForce', label: 'Sheer Force', ruptureOnly: true },
]

type ComputedView =
  | { ok: false, reason: string }
  | { ok: true, result: ComputeResult, notes: string[], display: FinalStats, agentSpecialty: Specialty }

export function ZzzStatsPanel() {
  const builds = useZzzStore((s) => s.builds)
  const discs = useZzzStore((s) => s.discs)

  const supportedBuilds = useMemo(() => builds.filter(isSupportedBuild), [builds])
  const [buildId, setBuildId] = useState<string | null>(null)
  const [coreSkill, setCoreSkill] = useState('6')
  const [conditions, setConditions] = useState<ActiveConditions>(statScreenConditions())

  const selected = supportedBuilds.find((b) => b.id === buildId) ?? supportedBuilds[0]

  const computed = useMemo((): ComputedView | undefined => {
    if (!selected) return undefined
    const resolved = resolveBuild(selected, discs)
    if (!resolved.ok) return { ok: false, reason: resolved.reason }

    const result = computeStats({
      agent: resolved.build.agent,
      wEngine: resolved.build.wEngine,
      wEngineRefinement: resolved.build.wEngineRefinement,
      coreSkillLevel: Number(coreSkill),
      discs: resolved.build.discs,
      conditions,
    })
    return {
      ok: true,
      result,
      notes: resolved.notes,
      display: toDisplayStats(result.stats),
      agentSpecialty: resolved.build.agent.specialty,
    }
  }, [selected, discs, coreSkill, conditions])

  return (
    <Stack gap='sm'>
      <Title order={4}>Agent stats</Title>

      {supportedBuilds.length === 0 && (
        <Text size='sm'>
          Import a builds export with a Ye Shunguang, Miyabi, Yixuan or Soldier 0 - Anby build to see their stats. More agents will be added over time.
        </Text>
      )}

      {selected && (
        <Group align='flex-end' gap='md'>
          <Select
            label='Build'
            allowDeselect={false}
            value={selected.id}
            onChange={setBuildId}
            data={supportedBuilds.map((b) => ({ value: b.id, label: `${b.name}: ${b.id}` }))}
          />
          <Select
            label='Core Skill level'
            allowDeselect={false}
            value={coreSkill}
            onChange={(value) => setCoreSkill(value ?? '6')}
            data={CORE_SKILL_OPTIONS}
          />
          <Button variant='default' size='xs' onClick={() => setConditions(statScreenConditions())}>
            Match in-game stat screen
          </Button>
        </Group>
      )}

      {selected && (
        <Group gap='lg'>
          {(Object.keys(CONDITION_LABELS) as Condition[]).map((condition) => (
            <Switch
              key={condition}
              label={CONDITION_LABELS[condition]}
              checked={conditions[condition]}
              onChange={(event) => {
                const checked = event.currentTarget.checked
                setConditions((prev) => ({ ...prev, [condition]: checked }))
              }}
            />
          ))}
        </Group>
      )}

      {computed && !computed.ok && <Alert color='yellow'>{computed.reason}</Alert>}

      {computed?.ok && (
        <>
          {[...computed.notes, ...computed.result.warnings].length > 0 && (
            <Alert color='yellow' title='Heads up'>
              <Stack gap={2}>
                {[...computed.notes, ...computed.result.warnings].map((message, i) => <Text key={i} size='xs'>{message}</Text>)}
              </Stack>
            </Alert>
          )}

          <Group align='flex-start' gap='xl'>
            <Table w={360} striped>
              <Table.Tbody>
                {STAT_ROWS.filter((row) => !row.ruptureOnly || computed.agentSpecialty === 'Rupture').map((row) => (
                  <Table.Tr key={row.key}>
                    <Table.Td>{row.label}</Table.Td>
                    <Table.Td ta='right'>{`${computed.display[row.key].toLocaleString('en-US')}${row.suffix ?? ''}`}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Table.ScrollContainer minWidth={420} style={{ flex: 1 }}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Stat</Table.Th>
                    <Table.Th ta='right'>Value</Table.Th>
                    <Table.Th>Only when</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {computed.result.contributions.map((c, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{c.source}</Table.Td>
                      <Table.Td>{c.stat}</Table.Td>
                      <Table.Td ta='right'>{c.value}</Table.Td>
                      <Table.Td>{c.condition ? CONDITION_LABELS[c.condition] : ''}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Group>
        </>
      )}
    </Stack>
  )
}
