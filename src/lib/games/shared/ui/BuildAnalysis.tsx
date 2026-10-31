import {
  SimpleGrid,
  Table,
  Text,
} from '@mantine/core'
import type { SubstatUpgrade } from 'lib/games/shared/analysis'
import type { DamagePart } from 'lib/games/shared/damageBreakdown'
import { formatNumber } from 'lib/games/shared/format'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import type { PinnedCell } from 'lib/games/shared/ui/optimizer/BuildCompare'
import {
  ComboBreakdown,
  ComboDistribution,
} from 'lib/games/shared/ui/optimizer/DamageCharts'
import tableClasses from 'lib/tabs/tabOptimizer/analysis/UpgradeTable.module.css'

// The analysis under an optimizer's picked build, after HSR's expanded data panel: its stats next to the current
// build's, HSR's substat upgrades table (what one more roll of each substat adds to its score, and as a percent), and
// when ranking by damage, HSR's Combo Breakdown and Combo Distribution charts (shared/ui/optimizer/DamageCharts.tsx).
// Shared by the ZZZ, Genshin and WuWa pages.

export type StatDiffRow = {
  key: string,
  label: string,
  build: number,
  // Undefined when there's no current build to compare with
  current?: number,
  format: (value: number) => string,
}

function Change({ row }: { row: StatDiffRow }) {
  if (row.current === undefined) return <Text size='xs' c='dimmed'>-</Text>
  const diff = row.build - row.current
  if (Math.abs(diff) < 1e-6 || row.format(Math.abs(diff)) === row.format(0)) return <Text size='xs' c='dimmed'>=</Text>
  return <Text size='xs' c={diff > 0 ? 'teal' : 'red'}>{`${diff > 0 ? '+' : '-'}${row.format(Math.abs(diff))}`}</Text>
}

// What a roll adds to the score: whole numbers for damage-sized scores, decimals for small ones (Crit Value, a stat)
function formatGain(gain: number): string {
  if (gain >= 100) return formatNumber(Math.round(gain))
  return gain.toFixed(gain >= 10 ? 1 : 2)
}

// A snapshot of the rows for Pin build in the sidebar (shared/ui/optimizer/BuildCompare.tsx)
export function pinnedCells(rows: StatDiffRow[]): PinnedCell[] {
  return rows.map((row) => ({ key: row.key, label: row.label, value: row.build, text: row.format(row.build) }))
}

export function BuildAnalysis({ buildLabel, rows, upgrades, scoreLabel, formatRoll, breakdown }: {
  // e.g. 'Build #2'
  buildLabel: string,
  rows: StatDiffRow[],
  upgrades: SubstatUpgrade[],
  // What the build is ranked by, e.g. 'Average ATK hit'
  scoreLabel: string,
  formatRoll: (upgrade: SubstatUpgrade) => string,
  // The rotation's lines and their damage on this build (shared/damageBreakdown.ts), when ranking by damage
  breakdown?: DamagePart[],
}) {
  const helpful = upgrades.filter((u) => u.gain > 1e-9)
  const hasCurrent = rows.some((row) => row.current !== undefined)

  return (
    <Panel
      title='Build analysis'
      description={`${buildLabel}, compared with the current build and what would improve it next.`}
    >
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
          <Text size='sm' fw={600}>Substat upgrades</Text>
          <Text size='xs' c='dimmed' mb={8}>{`One more average roll of each substat on this build, and how much it raises ${scoreLabel}.`}</Text>
          {helpful.length === 0
            ? <Text size='xs' c='dimmed'>{`No substat raises ${scoreLabel}.`}</Text>
            : (
              <Table className={tableClasses.upgradeTable} verticalSpacing={4}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th className={tableClasses.substatHeader}>Substat</Table.Th>
                    <Table.Th className={tableClasses.columnHeader}>Δ %</Table.Th>
                    <Table.Th className={tableClasses.columnHeader} title={scoreLabel}>Δ</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {helpful.map((upgrade) => (
                    <Table.Tr key={upgrade.stat}>
                      <Table.Td className={tableClasses.centeredCell}>
                        <Text size='xs' span>{upgrade.label}</Text>
                        <Text size='xs' span c='dimmed'>{` +${formatRoll(upgrade)}`}</Text>
                      </Table.Td>
                      <Table.Td className={tableClasses.centeredCell}>
                        <Text size='xs'>{`${upgrade.percent.toFixed(2)}%`}</Text>
                      </Table.Td>
                      <Table.Td className={tableClasses.centeredCell}>
                        <Text size='xs'>{formatGain(upgrade.gain)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
        </div>
      </SimpleGrid>
      {breakdown && breakdown.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 'var(--mantine-spacing-lg)', alignItems: 'flex-start' }}>
          <ComboBreakdown parts={breakdown} />
          <ComboDistribution parts={breakdown} />
        </div>
      )}
    </Panel>
  )
}
