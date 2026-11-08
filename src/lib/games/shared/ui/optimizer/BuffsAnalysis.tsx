import {
  Group,
  SegmentedControl,
  Switch,
  Table,
  Text,
} from '@mantine/core'
import { useState } from 'react'

// Every buff on the picked build, grouped by where it comes from, after HSR's buffs analysis in the optimizer's expanded
// panel (BuffsAnalysisDisplay): team, the character's own kit, sets and weapon effects, and buffs typed in by hand.
// Each game turns its applied lists (team/teamBuffs.ts, damage/combatEffects.ts, the extra buffs) into these rows.

export type BuffRow = {
  // 'Team', 'Own effects', 'Set effects', 'Extra'
  group: string,
  source: string,
  label: string,
  // '+20% ATK' when counted, why not otherwise
  detail?: string,
  counted: boolean,
}

export function BuffsAnalysis({ rows }: { rows: BuffRow[] }) {
  const [group, setGroup] = useState('all')
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) return null
  const groups = [...new Set(rows.map((row) => row.group))]
  const shown = rows.filter((row) => (group === 'all' || row.group === group) && (showAll || row.counted))
  const off = rows.filter((row) => !row.counted).length
  return (
    <div>
      <Group justify='space-between' mb={6}>
        <Text size='sm' fw={600}>Buffs</Text>
        <Group gap='sm'>
          <SegmentedControl
            size='xs'
            value={groups.includes(group) ? group : 'all'}
            onChange={setGroup}
            data={[{ value: 'all', label: `All (${rows.filter((row) => row.counted).length})` }, ...groups.map((g) => ({ value: g, label: g }))]}
          />
          {off > 0 && <Switch size='xs' checked={showAll} onChange={(event) => setShowAll(event.currentTarget.checked)} label={`Not counted (${off})`} />}
        </Group>
      </Group>
      <Table verticalSpacing={4} horizontalSpacing='xs' aria-label='Buffs on this build'>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>From</Table.Th>
            <Table.Th>Buff</Table.Th>
            <Table.Th ta='right'>Value</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {shown.map((row, index) => (
            <Table.Tr key={`${row.group}:${row.source}:${row.label}:${index}`}>
              <Table.Td>
                <Text size='xs' c={row.counted ? undefined : 'dimmed'}>{row.source}</Text>
                <Text size='10px' c='dimmed'>{row.group}</Text>
              </Table.Td>
              <Table.Td>
                <Text size='xs' c={row.counted ? undefined : 'dimmed'}>{row.label}</Text>
              </Table.Td>
              <Table.Td ta='right'>
                <Text size='xs' c={row.counted ? undefined : 'dimmed'}>{row.detail ?? (row.counted ? 'On' : 'Off')}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {shown.length === 0 && <Text size='xs' c='dimmed'>Nothing counted in this group.</Text>}
    </div>
  )
}
