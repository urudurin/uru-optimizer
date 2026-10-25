import {
  Alert,
  Button,
  FileInput,
  Group,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { getSubstatValue } from 'lib/games/zzz/discStats'
import { parseZzzBuildsExportJson } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import type { ImportMode } from 'lib/games/zzz/state/zzzState'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import type {
  Disc,
  DiscSubstat,
} from 'lib/games/zzz/types'
import { ZzzStatsPanel } from 'lib/games/zzz/ZzzStatsPanel'
import {
  useMemo,
  useState,
} from 'react'

const MAX_WARNINGS_SHOWN = 8

function formatSubstat(disc: Disc, substat: DiscSubstat): string {
  const value = getSubstatValue(disc.rarity, substat.stat, substat.rolls)
  return value === undefined ? `${substat.stat} x${substat.rolls}` : `${substat.stat} +${value}`
}

export function ZzzApp() {
  const discs = useZzzStore((s) => s.discs)
  const builds = useZzzStore((s) => s.builds)
  const warnings = useZzzStore((s) => s.lastWarnings)
  const importParsed = useZzzStore((s) => s.importParsed)
  const clear = useZzzStore((s) => s.clear)
  const [mode, setMode] = useState<ImportMode>('merge')

  const sortedDiscs = useMemo(
    () => [...discs].sort((a, b) => a.slot - b.slot || a.setName.localeCompare(b.setName)),
    [discs],
  )

  async function handleFile(file: File | null) {
    if (!file) return
    importParsed(parseZzzBuildsExportJson(await file.text()), mode)
  }

  function handleClear() {
    if (window.confirm('Remove all stored ZZZ discs and builds?')) clear()
  }

  return (
    <Stack p='md' gap='md' style={{ flex: 1, minWidth: 0 }}>
      <Title order={3}>Zenless Zone Zero</Title>

      <Group align='flex-end' gap='md'>
        <FileInput
          label='Import discs'
          placeholder='Choose a builds export (.json)'
          accept='application/json,.json'
          clearable
          onChange={handleFile}
        />
        <SegmentedControl
          size='xs'
          value={mode}
          onChange={(value) => setMode(value === 'replace' ? 'replace' : 'merge')}
          data={[
            { value: 'merge', label: 'Merge' },
            { value: 'replace', label: 'Replace' },
          ]}
        />
        <Button variant='default' size='xs' onClick={handleClear} disabled={discs.length === 0 && builds.length === 0}>
          Clear data
        </Button>
      </Group>

      <Text size='sm'>{`${discs.length} discs, ${builds.length} saved builds`}</Text>

      {warnings.length > 0 && (
        <Alert color='yellow' title={`${warnings.length} warning${warnings.length === 1 ? '' : 's'} during the last import`}>
          <Stack gap={2}>
            {warnings.slice(0, MAX_WARNINGS_SHOWN).map((warning, i) => (
              <Text key={i} size='xs'>{`${warning.code}: ${warning.message}${warning.discId ? ` (${warning.discId})` : ''}`}</Text>
            ))}
            {warnings.length > MAX_WARNINGS_SHOWN && <Text size='xs'>{`...and ${warnings.length - MAX_WARNINGS_SHOWN} more`}</Text>}
          </Stack>
        </Alert>
      )}

      <ZzzStatsPanel />

      {sortedDiscs.length > 0 && (
        <Table.ScrollContainer minWidth={640}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Slot</Table.Th>
                <Table.Th>Set</Table.Th>
                <Table.Th>Rarity / level</Table.Th>
                <Table.Th>Main stat</Table.Th>
                <Table.Th>Substats</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedDiscs.map((disc) => (
                <Table.Tr key={disc.id}>
                  <Table.Td>{disc.slot}</Table.Td>
                  <Table.Td>{disc.setName}</Table.Td>
                  <Table.Td>{`${disc.rarity} ${disc.level}`}</Table.Td>
                  <Table.Td>{`${disc.main.stat} ${disc.main.value}`}</Table.Td>
                  <Table.Td>{disc.substats.map((substat) => formatSubstat(disc, substat)).join(', ')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  )
}
