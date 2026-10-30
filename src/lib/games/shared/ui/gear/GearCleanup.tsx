import {
  SimpleGrid,
  Table,
  Text,
} from '@mantine/core'
import type { GearKind } from 'lib/games/shared/gear/gearKind'
import {
  type CleanupCandidate,
  type CleanupRow,
  cleanupRows,
  fodder,
  FODDER_PERCENT,
  levelNext,
} from 'lib/games/shared/gearCleanup'
import type { GearScore } from 'lib/games/shared/gearScore'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import { useMemo } from 'react'

// Clean-up suggestions under a gear inventory (ZZZ Discs, Genshin Artifacts, WuWa Echoes): unworn pieces nobody saved
// would want, and unfinished pieces worth leveling, from shared/gearCleanup.ts
export function GearCleanup<T>({ kind, items, candidates, scoreAs, maxLevel }: {
  kind: GearKind<T>,
  items: T[],
  // The saved characters, who each piece is scored for
  candidates: CleanupCandidate[],
  scoreAs: (item: T, characterId: string) => GearScore | undefined,
  maxLevel: (item: T) => number,
}) {
  const rows = useMemo(
    () =>
      cleanupRows(items, candidates, scoreAs, { equipped: (item) => kind.ownerOf(item) !== undefined, maxed: (item) => kind.levelOf(item) >= maxLevel(item) }),
    [items, candidates, scoreAs, kind, maxLevel],
  )
  if (items.length === 0 || candidates.length === 0) return null
  const low = fodder(rows)
  const next = levelNext(rows)
  const noun = kind.noun.toLowerCase()

  return (
    <Panel
      title='Clean-up suggestions'
      description={`Each ${noun} scored for every saved character by its substats (the Score column), to see which ones nobody would wear and which to level next. Sets and main stats aren't weighed, so check before deleting.`}
    >
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing='lg'>
        <div>
          <Text size='sm' fw={600}>{`Nobody would wear (${low.length})`}</Text>
          <Text size='xs' c='dimmed' mb={6}>{`Not worn, and under ${FODDER_PERCENT}% for every saved character: fodder candidates.`}</Text>
          <CleanupTable kind={kind} rows={low.slice(0, 15)} empty={`Every unworn ${noun} scores ${FODDER_PERCENT}%+ for someone.`} />
          {low.length > 15 && <Text size='xs' c='dimmed' mt={4}>{`${low.length - 15} more; sort the inventory by Score to see them all.`}</Text>}
        </div>
        <div>
          <Text size='sm' fw={600}>Worth leveling next</Text>
          <Text size='xs' c='dimmed' mb={6}>{`Not at their top level yet, and already scoring well for someone.`}</Text>
          <CleanupTable kind={kind} rows={next} empty={`No unfinished ${noun} scores ${FODDER_PERCENT}%+ for anyone.`} />
        </div>
      </SimpleGrid>
    </Panel>
  )
}

function CleanupTable<T>({ kind, rows, empty }: { kind: GearKind<T>, rows: CleanupRow<T>[], empty: string }) {
  if (rows.length === 0) return <Text size='xs' c='dimmed'>{empty}</Text>
  return (
    <Table verticalSpacing={4} horizontalSpacing='xs'>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{kind.noun}</Table.Th>
          <Table.Th>Main</Table.Th>
          <Table.Th ta='right'>Level</Table.Th>
          <Table.Th>Best for</Table.Th>
          <Table.Th ta='right'>Score</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row, i) => (
          <Table.Tr key={i}>
            <Table.Td>
              <Text size='xs'>
                {`${kind.slots.find((s) => s.value === kind.slotOf(row.item))?.label ?? kind.slotOf(row.item)} · ${kind.setName(row.item)}`}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size='xs'>{`${kind.statLabel(kind.mainStatOf(row.item))} ${kind.mainValueText(row.item)}`}</Text>
            </Table.Td>
            <Table.Td ta='right'>
              <Text size='xs'>{`+${kind.levelOf(row.item)}`}</Text>
            </Table.Td>
            <Table.Td>
              <Text size='xs' c={row.best ? undefined : 'dimmed'}>{row.best?.name ?? 'Nobody'}</Text>
            </Table.Td>
            <Table.Td ta='right'>
              <Text size='xs'>{row.best ? `${row.best.percent.toFixed(0)}% ${row.best.rating}` : '-'}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
