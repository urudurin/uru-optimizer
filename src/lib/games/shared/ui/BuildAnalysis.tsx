import {
  SimpleGrid,
  Table,
  Text,
} from '@mantine/core'
import type { SubstatUpgrade } from 'lib/games/shared/analysis'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import classes from 'lib/games/shared/ui/Optimizer.module.css'

// The analysis under an optimizer's picked build, after HSR's expanded data panel: its stats next to the current
// build's, and what one more roll of each substat would add to its score. Shared by the ZZZ, Genshin and WuWa pages.
// HSR's damage splits aren't here, none of these games has a damage calculation yet.

export type StatDiffRow = {
  key: string,
  label: string,
  build: number,
  // Undefined when there's no current build to compare with
  current?: number,
  format: (value: number) => string,
}

const SHOWN_UPGRADES = 6

function Change({ row }: { row: StatDiffRow }) {
  if (row.current === undefined) return <Text size='xs' c='dimmed'>-</Text>
  const diff = row.build - row.current
  if (Math.abs(diff) < 1e-6 || row.format(Math.abs(diff)) === row.format(0)) return <Text size='xs' c='dimmed'>=</Text>
  return <Text size='xs' c={diff > 0 ? 'teal' : 'red'}>{`${diff > 0 ? '+' : '-'}${row.format(Math.abs(diff))}`}</Text>
}

export function BuildAnalysis({ buildLabel, rows, upgrades, scoreLabel, formatRoll }: {
  // e.g. 'Build #2'
  buildLabel: string,
  rows: StatDiffRow[],
  upgrades: SubstatUpgrade[],
  // What the build is ranked by, e.g. 'Average ATK hit'
  scoreLabel: string,
  formatRoll: (upgrade: SubstatUpgrade) => string,
}) {
  const helpful = upgrades.filter((u) => u.gain > 1e-9).slice(0, SHOWN_UPGRADES)
  const best = helpful[0]?.gain ?? 0
  const hasCurrent = rows.some((row) => row.current !== undefined)

  return (
    <Panel title='Build analysis' description={`${buildLabel}, compared with the current build and what would improve it next.`}>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing='lg'>
        <div>
          <Text size='sm' fw={600} mb={6}>Compared with current</Text>
          <Table verticalSpacing={4} horizontalSpacing='xs'>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Stat</Table.Th>
                <Table.Th ta='right'>Now</Table.Th>
                <Table.Th ta='right'>Build</Table.Th>
                <Table.Th ta='right'>Change</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.key}>
                  <Table.Td>
                    <Text size='xs'>{row.label}</Text>
                  </Table.Td>
                  <Table.Td ta='right'>
                    <Text size='xs' c='dimmed'>{row.current === undefined ? '-' : row.format(row.current)}</Text>
                  </Table.Td>
                  <Table.Td ta='right'>
                    <Text size='xs'>{row.format(row.build)}</Text>
                  </Table.Td>
                  <Table.Td ta='right'>
                    <Change row={row} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {!hasCurrent && <Text size='xs' c='dimmed' mt={6}>No current build to compare with.</Text>}
        </div>

        <div>
          <Text size='sm' fw={600}>Next substat roll</Text>
          <Text size='xs' c='dimmed' mb={8}>{`One more average roll of each substat on this build, and how much it raises ${scoreLabel}.`}</Text>
          {helpful.length === 0
            ? <Text size='xs' c='dimmed'>{`No substat raises ${scoreLabel}.`}</Text>
            : (
              <div className={classes.upgradeList}>
                {helpful.map((upgrade) => (
                  <div key={upgrade.stat} className={classes.upgradeRow}>
                    <Text size='xs' className={classes.upgradeLabel}>{`${upgrade.label} +${formatRoll(upgrade)}`}</Text>
                    <div className={classes.upgradeTrack}>
                      <div className={classes.upgradeBar} style={{ width: `${best > 0 ? (upgrade.gain / best) * 100 : 0}%` }} />
                    </div>
                    <Text size='xs' fw={600} className={classes.upgradeValue}>{`+${upgrade.percent.toFixed(2)}%`}</Text>
                  </div>
                ))}
              </div>
            )}
        </div>
      </SimpleGrid>
    </Panel>
  )
}
