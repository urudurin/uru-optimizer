import {
  Group,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import type { CharacterMetadata } from 'lib/games/shared/characterMetadata'
import type {
  BenchmarkBuilds,
  DamageScore,
} from 'lib/games/shared/damageScore'
import { formatNumber } from 'lib/games/shared/format'
import type { ScoringMode } from 'lib/games/shared/scoringOverrides'
import {
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import type { ReactNode } from 'react'

// The Benchmarks page of every game, after HSR's Benchmarks tab: pick a character and see the three builds the DPS score
// compares with (shared/damageScore.ts benchmarkBuilds): the baseline (0%), the benchmark (100%, SS) and the perfect
// build (200%), with their main stats, sets, rolls per substat and rotation damage. The team, enemy and rotation are
// the character's scoring setup (Default or Custom, shared with the Characters page); the sets and mains come from the
// metadata simulation when it has some, the character's worn gear (or a plain build when they have none) otherwise.

export type BenchmarksData = {
  builds: BenchmarkBuilds,
  // The pieces' slot names, in the order of builds.mains
  slots: string[],
  // The benchmark's set bonus, e.g. "4pc Viridescent Venerer"
  sets: string,
  // The character's own gear, when complete: its damage and DPS score
  current?: { damage: number, score?: DamageScore },
  // Where the pieces came from
  basis: string,
}

export function BenchmarksView({ description, picker, mode, onMode, metadata, team, data, emptyText, statLabel, unit }: {
  description: string,
  // The character picker (each game's card select)
  picker: ReactNode,
  mode: ScoringMode,
  onMode: (mode: ScoringMode) => void,
  metadata: CharacterMetadata<unknown> | undefined,
  // The scoring team's names
  team: string[],
  data: BenchmarksData | undefined,
  // Why there's nothing to show (no damage data, ...)
  emptyText: string,
  statLabel: (stat: string) => string,
  // What a roll is called for this game ('rolls', 'average rolls')
  unit: string,
}) {
  const stats = data ? [...new Set([...Object.keys(data.builds.benchmark.rolls), ...Object.keys(data.builds.perfect.rolls)])] : []
  stats.sort((a, b) => (data!.builds.benchmark.rolls[b] ?? 0) - (data!.builds.benchmark.rolls[a] ?? 0))
  const rolls = (value: number | undefined) => (value === undefined ? '-' : formatNumber(Math.round(value * 10) / 10))
  return (
    <Stack gap='md'>
      <PageHeader title='Benchmarks' description={description} />
      <Panel>
        <Stack gap='sm'>
          <Group align='flex-end' gap='md'>
            {picker}
            <SegmentedControl
              size='xs'
              value={mode}
              onChange={(value) => onMode(value as ScoringMode)}
              data={[{ value: 'default', label: 'Default' }, { value: 'custom', label: 'Custom' }]}
            />
          </Group>
          {metadata && (
            <Text size='xs' c='dimmed'>
              {`${metadata.source} · ${metadata.confidence} · reviewed ${metadata.reviewed}. Team: ${
                team.length > 0 ? team.join(', ') : 'none (the kit alone)'
              }.`}
            </Text>
          )}
        </Stack>
      </Panel>
      {!data
        ? (
          <Panel>
            <Text size='sm' c='dimmed'>{emptyText}</Text>
          </Panel>
        )
        : (
          <Panel>
            <Stack gap='sm'>
              <Text size='xs' c='dimmed'>{`${data.basis} Sets: ${data.sets || 'none'}.`}</Text>
              <Group gap='lg'>
                {data.slots.map((slot, index) => (
                  <Text key={`${slot}-${index}`} size='xs'>
                    <Text span size='xs' c='dimmed'>{`${slot} `}</Text>
                    {statLabel(data.builds.mains[index] ?? '')}
                  </Text>
                ))}
              </Group>
              <Table striped withTableBorder fz='xs' aria-label='Benchmark builds'>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{`Substat (${unit})`}</Table.Th>
                    <Table.Th>Baseline · 0%</Table.Th>
                    <Table.Th>Benchmark · 100%</Table.Th>
                    <Table.Th>Perfect · 200%</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stats.map((stat) => (
                    <Table.Tr key={stat}>
                      <Table.Td>{statLabel(stat)}</Table.Td>
                      <Table.Td>{rolls(data.builds.baseline.rolls[stat])}</Table.Td>
                      <Table.Td>{rolls(data.builds.benchmark.rolls[stat])}</Table.Td>
                      <Table.Td>{rolls(data.builds.perfect.rolls[stat])}</Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td fw={600}>Rotation damage</Table.Td>
                    <Table.Td fw={600}>{formatNumber(Math.round(data.builds.baseline.score))}</Table.Td>
                    <Table.Td fw={600}>{formatNumber(Math.round(data.builds.benchmark.score))}</Table.Td>
                    <Table.Td fw={600}>{formatNumber(Math.round(data.builds.perfect.score))}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
              {data.current && (
                <Text size='xs'>
                  {`Your build: ${formatNumber(Math.round(data.current.damage))} damage${
                    data.current.score ? ` · DPS score ${data.current.score.percent}% · ${data.current.score.rating}` : ''
                  }`}
                </Text>
              )}
            </Stack>
          </Panel>
        )}
    </Stack>
  )
}
