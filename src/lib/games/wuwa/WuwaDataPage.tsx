import {
  Button,
  FileInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconDownload,
  IconFileImport,
} from '@tabler/icons-react'
import {
  backupFileName,
  downloadTextFile,
  recordBackup,
} from 'lib/games/shared/backup'
import { formatNumber } from 'lib/games/shared/format'
import { todayString } from 'lib/games/shared/importedPresets'
import type { ImportMode } from 'lib/games/shared/storage'
import {
  Notices,
  PageHeader,
  Panel,
  StatGrid,
} from 'lib/games/shared/ui/GameLayout'
import { parseWuwaUserDataJson } from 'lib/games/wuwa/importer/userDataParser'
import {
  createWuwaBackup,
  readWuwaBackup,
} from 'lib/games/wuwa/state/wuwaState'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import { useState } from 'react'

export function WuwaDataPage() {
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const teams = useWuwaStore((s) => s.teams)
  const priority = useWuwaStore((s) => s.priority)
  const warnings = useWuwaStore((s) => s.lastWarnings)
  const importParsed = useWuwaStore((s) => s.importParsed)
  const clear = useWuwaStore((s) => s.clear)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [restored, setRestored] = useState<string | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    const text = await file.text()
    // A backup saved from this page restores as-is, anything else is read as a WuwaEchoScorer user-data file
    const backup = readWuwaBackup(text)
    if (backup) {
      importParsed({ ...backup, warnings: [] }, mode)
      setRestored(`Restored a backup with ${backup.echoes.length} echoes and ${backup.characters.length} Resonators`)
    } else {
      importParsed(parseWuwaUserDataJson(text), mode)
      setRestored(null)
    }
  }

  function handleSave() {
    const savedAt = todayString(new Date())
    downloadTextFile(backupFileName('wuwa', savedAt), createWuwaBackup({ echoes, characters, teams, priority }, savedAt))
    recordBackup('wuwa', savedAt)
  }

  function handleClear() {
    if (window.confirm('Remove all stored WuWa echoes and Resonators from this browser?')) clear()
  }

  const hasData = echoes.length > 0 || characters.length > 0

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Import / Save'
        description='Your echoes and Resonators are kept in this browser only. Nothing is uploaded. Save a backup to keep a copy or move them to another browser.'
      />

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing='lg'>
        <Panel title='Import' description='The user-data file (.json) exported from WuwaEchoScorer, or a backup saved here.'>
          <Stack gap='sm'>
            <FileInput
              size='sm'
              leftSection={<IconFileImport size={16} />}
              placeholder='Choose a user-data file or backup (.json)'
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
            {restored && <Text size='xs' c='teal'>{restored}</Text>}
          </Stack>
        </Panel>

        <Panel title='Save a backup' description='Downloads your echoes and Resonators as a .json file. Import it here to restore them.'>
          <Stack gap='sm'>
            <Button leftSection={<IconDownload size={16} />} onClick={handleSave} disabled={!hasData}>
              Save a backup
            </Button>
            <Text size='xs' c='dimmed'>{hasData ? `${echoes.length} echoes and ${characters.length} Resonators.` : 'Nothing to save yet.'}</Text>
          </Stack>
        </Panel>

        <Panel
          title='In this browser'
          actions={hasData ? <Button size='xs' variant='subtle' color='red' onClick={handleClear}>Clear data</Button> : undefined}
        >
          <StatGrid
            stats={[
              { key: 'echoes', label: 'Echoes', value: formatNumber(echoes.length) },
              { key: 'characters', label: 'Resonators', value: formatNumber(characters.length) },
            ]}
          />
        </Panel>
      </SimpleGrid>

      <Notices title={`${warnings.length} note${warnings.length === 1 ? '' : 's'} from the last import`} messages={warnings} max={8} />
    </Stack>
  )
}
