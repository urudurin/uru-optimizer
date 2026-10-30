import {
  Button,
  SimpleGrid,
  Table,
  Text,
} from '@mantine/core'
import type { SubstatUpgrade } from 'lib/games/shared/analysis'
import {
  damageByGroup,
  type DamagePart,
} from 'lib/games/shared/damageBreakdown'
import { formatNumber } from 'lib/games/shared/format'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import classes from 'lib/games/shared/ui/Optimizer.module.css'
import type { PinnedCell } from 'lib/games/shared/ui/optimizer/BuildCompare'

// The analysis under an optimizer's picked build, after HSR's expanded data panel: its stats next to the current
// build's, what one more roll of each substat would add to its score, and when ranking by damage, each rotation line's
// share of it (after HSR's damage splits). Shared by the ZZZ, Genshin and WuWa pages.

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

const SHOWN_PARTS = 10

// Each rotation line's share of the build's damage, largest first, with the rest folded into one row
function DamageBreakdown({ parts }: { parts: DamagePart[] }) {
  const total = parts.reduce((sum, part) => sum + part.damage, 0)
  if (total <= 0) return null
  const shown = parts.slice(0, SHOWN_PARTS)
  const rest = parts.slice(SHOWN_PARTS)
  const rows = rest.length > 0
    ? [...shown, { key: 'rest', label: `${rest.length} more lines`, group: '', count: 0, damage: rest.reduce((sum, p) => sum + p.damage, 0) }]
    : shown
  const largest = shown[0]?.damage ?? 0
  const groups = damageByGroup(parts)

  return (
    <div>
      <Text size='sm' fw={600}>Where the damage comes from</Text>
      <Text size='xs' c='dimmed' mb={8}>
        {groups.map((g) => `${g.group} ${formatPercent(g.damage / total)}`).join(' · ')}
      </Text>
      <div className={classes.upgradeList}>
        {rows.map((part) => (
          <div key={part.key} className={classes.upgradeRow}>
            <Text size='xs' className={classes.upgradeLabel} title={part.group ? `${part.group}: ${part.label}` : part.label}>
              {part.count > 1 ? `${part.label} ×${part.count}` : part.label}
            </Text>
            <div className={classes.upgradeTrack}>
              <div className={classes.upgradeBar} style={{ width: `${largest > 0 ? Math.min(100, (part.damage / largest) * 100) : 0}%` }} />
            </div>
            <Text size='xs' fw={600} className={classes.upgradeValue} title={formatNumber(Math.round(part.damage))}>
              {formatPercent(part.damage / total)}
            </Text>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatPercent(share: number): string {
  return `${(share * 100).toFixed(1)}%`
}

export function BuildAnalysis({ buildLabel, rows, upgrades, scoreLabel, formatRoll, breakdown, onPin }: {
  // e.g. 'Build #2'
  buildLabel: string,
  rows: StatDiffRow[],
  upgrades: SubstatUpgrade[],
  // What the build is ranked by, e.g. 'Average ATK hit'
  scoreLabel: string,
  formatRoll: (upgrade: SubstatUpgrade) => string,
  // The rotation's lines and their damage on this build (shared/damageBreakdown.ts), when ranking by damage
  breakdown?: DamagePart[],
  // Pins this build for comparing (shared/ui/optimizer/BuildCompare.tsx) with a snapshot of its rows
  onPin?: (cells: PinnedCell[]) => void,
}) {
  const helpful = upgrades.filter((u) => u.gain > 1e-9).slice(0, SHOWN_UPGRADES)
  const best = helpful[0]?.gain ?? 0
  const hasCurrent = rows.some((row) => row.current !== undefined)

  return (
    <Panel
      title='Build analysis'
      description={`${buildLabel}, compared with the current build and what would improve it next.`}
      actions={onPin && (
        <Button
          size='xs'
          variant='light'
          onClick={() => onPin(rows.map((row) => ({ key: row.key, label: row.label, value: row.build, text: row.format(row.build) })))}
        >
          Pin to compare
        </Button>
      )}
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
        {breakdown && breakdown.length > 0 && <DamageBreakdown parts={breakdown} />}
      </SimpleGrid>
    </Panel>
  )
}
