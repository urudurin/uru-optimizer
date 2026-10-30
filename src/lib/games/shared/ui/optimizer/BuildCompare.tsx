import {
  ActionIcon,
  Table,
  Text,
} from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import { useState } from 'react'

// Pin builds from the optimizer's results and compare them side by side, after HSR's build comparison: each pinned
// build keeps a snapshot of the Build analysis rows (score and stats), so it stays after a new search. Pins belong to
// one character; at most MAX_PINNED. Shared by the ZZZ, Genshin and WuWa optimizer pages.

export type PinnedCell = { key: string, label: string, value: number, text: string }

export type PinnedBuild = { id: string, characterId: string, label: string, cells: PinnedCell[] }

export const MAX_PINNED = 4

let pinCounter = 0

export function usePinnedBuilds(characterId: string) {
  const [all, setAll] = useState<PinnedBuild[]>([])
  const pinned = all.filter((build) => build.characterId === characterId)
  return {
    pinned,
    pin: (label: string, cells: PinnedCell[]) => {
      pinCounter++
      const build: PinnedBuild = { id: `pin-${pinCounter}`, characterId, label, cells }
      setAll((current) => {
        const others = current.filter((b) => b.characterId !== characterId)
        // The oldest pin of this character makes room for the new one
        const mine = current.filter((b) => b.characterId === characterId).slice(-(MAX_PINNED - 1))
        return [...others, ...mine, build]
      })
    },
    unpin: (id: string) => setAll((current) => current.filter((b) => b.id !== id)),
  }
}

// One column per pinned build; the best value of each row is highlighted
export function BuildCompare({ pinned, onUnpin }: { pinned: PinnedBuild[], onUnpin: (id: string) => void }) {
  if (pinned.length === 0) return null
  // Rows in the first pinned build's order, then any others
  const rows = [...new Map(pinned.flatMap((b) => b.cells.map((c) => [c.key, c.label] as const))).entries()]

  return (
    <Panel title='Pinned builds' description='Builds you pinned from the results, side by side. The best value in each row is highlighted.'>
      <Table verticalSpacing={4} horizontalSpacing='xs'>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Stat</Table.Th>
            {pinned.map((build) => (
              <Table.Th key={build.id} ta='right'>
                <Text size='xs' fw={600} span>{build.label}</Text>
                <ActionIcon size='xs' variant='subtle' color='gray' ml={4} aria-label={`Unpin ${build.label}`} onClick={() => onUnpin(build.id)}>
                  <IconX size={12} />
                </ActionIcon>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(([key, label]) => {
            const cells = pinned.map((build) => build.cells.find((c) => c.key === key))
            const best = Math.max(...cells.map((c) => c?.value ?? -Infinity))
            const differs = cells.some((c) => c && c.text !== cells[0]?.text)
            return (
              <Table.Tr key={key}>
                <Table.Td>
                  <Text size='xs'>{label}</Text>
                </Table.Td>
                {cells.map((cell, i) => (
                  <Table.Td key={pinned[i].id} ta='right'>
                    <Text size='xs' fw={differs && cell?.value === best ? 700 : undefined} c={differs && cell?.value === best ? 'teal' : undefined}>
                      {cell?.text ?? '-'}
                    </Text>
                  </Table.Td>
                ))}
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Panel>
  )
}
