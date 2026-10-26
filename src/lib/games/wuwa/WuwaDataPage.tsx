import {
  Button,
  FileInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { IconFileImport } from '@tabler/icons-react'
import { formatNumber } from 'lib/games/shared/format'
import type { ImportMode } from 'lib/games/shared/storage'
import {
  Notices,
  PageHeader,
  Panel,
  StatGrid,
} from 'lib/games/shared/ui/GameLayout'
import { parseWuwaUserDataJson } from 'lib/games/wuwa/importer/userDataParser'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import { useState } from 'react'

export function WuwaDataPage() {
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const warnings = useWuwaStore((s) => s.lastWarnings)
  const importParsed = useWuwaStore((s) => s.importParsed)
  const clear = useWuwaStore((s) => s.clear)
  const [mode, setMode] = useState<ImportMode>('merge')

  async function handleFile(file: File | null) {
    if (!file) return
    importParsed(parseWuwaUserDataJson(await file.text()), mode)
  }

  function handleClear() {
    if (window.confirm('Remove all stored WuWa echoes and characters from this browser?')) clear()
  }

  return (
    <Stack gap='lg'>
      <PageHeader title='Import & data' description='Your echoes and characters are kept in this browser only. Nothing is uploaded.' />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing='lg'>
        <Panel title='Import echoes and characters' description='Use the user-data file (.json) exported from WuwaEchoScorer.'>
          <Stack gap='sm'>
            <FileInput
              size='sm'
              leftSection={<IconFileImport size={16} />}
              placeholder='Choose a user-data file (.json)'
              accept='application/json,.json'
              clearable
              onChange={handleFile}
            />
            <SegmentedControl
              value={mode}
              onChange={(value) => setMode(value === 'replace' ? 'replace' : 'merge')}
              data={[
                { value: 'merge', label: 'Merge with what is here' },
                { value: 'replace', label: 'Replace everything' },
              ]}
            />
            <Text size='xs' c='dimmed'>Echoes that break a game rule are skipped and listed below, so stats never use impossible gear.</Text>
          </Stack>
        </Panel>

        <Panel
          title='In this browser'
          actions={echoes.length > 0 || characters.length > 0
            ? <Button size='xs' variant='subtle' color='red' onClick={handleClear}>Clear data</Button>
            : undefined}
        >
          <StatGrid
            stats={[
              { key: 'echoes', label: 'Echoes', value: formatNumber(echoes.length) },
              { key: 'characters', label: 'Characters', value: formatNumber(characters.length) },
            ]}
          />
        </Panel>
      </SimpleGrid>

      <Notices title={`${warnings.length} note${warnings.length === 1 ? '' : 's'} from the last import`} messages={warnings} max={8} />
    </Stack>
  )
}
