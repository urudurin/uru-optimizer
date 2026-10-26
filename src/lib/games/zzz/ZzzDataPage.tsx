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
import { parseZzzBuildsExportJson } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  createZzzBackup,
  readZzzBackup,
} from 'lib/games/zzz/state/zzzState'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import { isSupportedBuild } from 'lib/games/zzz/stats/resolveBuild'
import { useState } from 'react'

export function ZzzDataPage() {
  const discs = useZzzStore((s) => s.discs)
  const builds = useZzzStore((s) => s.builds)
  const warnings = useZzzStore((s) => s.lastWarnings)
  const importParsed = useZzzStore((s) => s.importParsed)
  const clear = useZzzStore((s) => s.clear)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [restored, setRestored] = useState<string | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    const text = await file.text()
    // A backup saved from this page restores as-is, anything else is read as a builds export
    const backup = readZzzBackup(text)
    if (backup) {
      importParsed({ ...backup, warnings: [] }, mode)
      setRestored(`Restored a backup with ${backup.discs.length} discs and ${backup.builds.length} builds`)
    } else {
      importParsed(parseZzzBuildsExportJson(text), mode)
      setRestored(null)
    }
  }

  function handleSave() {
    const savedAt = todayString(new Date())
    downloadTextFile(backupFileName('zzz', savedAt), createZzzBackup({ discs, builds }, savedAt))
  }

  function handleClear() {
    if (window.confirm('Remove all stored ZZZ discs and builds from this browser?')) clear()
  }

  const supported = builds.filter(isSupportedBuild).length
  const hasData = discs.length > 0 || builds.length > 0

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Import / Save'
        description='Your discs and builds are kept in this browser only. Nothing is uploaded. Save a backup to keep a copy or move them to another browser.'
      />

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing='lg'>
        <Panel title='Import' description='A builds export (.json) from your ZZZ optimizer tool, or a backup saved here.'>
          <Stack gap='sm'>
            <FileInput
              size='sm'
              leftSection={<IconFileImport size={16} />}
              placeholder='Choose a builds export or backup (.json)'
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
            <Text size='xs' c='dimmed'>
              Merge keeps your current discs and updates any that appear in the file again. Replace starts over from the file.
            </Text>
            {restored && <Text size='xs' c='teal'>{restored}</Text>}
          </Stack>
        </Panel>

        <Panel title='Save a backup' description='Downloads your discs and builds as a .json file. Import it here to restore them.'>
          <Stack gap='sm'>
            <Button leftSection={<IconDownload size={16} />} onClick={handleSave} disabled={!hasData}>
              Save a backup
            </Button>
            <Text size='xs' c='dimmed'>
              {hasData ? `${discs.length} discs and ${builds.length} builds. Imported presets aren't included.` : 'Nothing to save yet.'}
            </Text>
          </Stack>
        </Panel>

        <Panel
          title='In this browser'
          actions={hasData ? <Button size='xs' variant='subtle' color='red' onClick={handleClear}>Clear data</Button> : undefined}
        >
          <StatGrid
            stats={[
              { key: 'discs', label: 'Discs', value: formatNumber(discs.length) },
              { key: 'builds', label: 'Saved builds', value: formatNumber(builds.length) },
              { key: 'supported', label: 'Builds with stat data', value: formatNumber(supported) },
            ]}
          />
        </Panel>
      </SimpleGrid>

      <Notices title={`${warnings.length} note${warnings.length === 1 ? '' : 's'} from the last import`} messages={warnings.map((w) => w.message)} max={8} />
    </Stack>
  )
}
