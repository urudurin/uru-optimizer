import {
  Button,
  FileInput,
  Group,
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
import { parseZzzBuildsExportJson } from 'lib/games/zzz/importer/zzzBuildsExportParser'
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

  async function handleFile(file: File | null) {
    if (!file) return
    importParsed(parseZzzBuildsExportJson(await file.text()), mode)
  }

  function handleClear() {
    if (window.confirm('Remove all stored ZZZ discs and builds from this browser?')) clear()
  }

  const supported = builds.filter(isSupportedBuild).length

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Import & data'
        description='Your discs and builds are kept in this browser only. Nothing is uploaded.'
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing='lg'>
        <Panel title='Import discs' description='Use a builds export (.json) from your ZZZ optimizer tool. It includes every disc and saved build.'>
          <Stack gap='sm'>
            <FileInput
              size='sm'
              leftSection={<IconFileImport size={16} />}
              placeholder='Choose a builds export (.json)'
              accept='application/json,.json'
              clearable
              onChange={handleFile}
            />
            <Group gap='sm'>
              <SegmentedControl
                value={mode}
                onChange={(value) => setMode(value === 'replace' ? 'replace' : 'merge')}
                data={[
                  { value: 'merge', label: 'Merge with what is here' },
                  { value: 'replace', label: 'Replace everything' },
                ]}
              />
            </Group>
            <Text size='xs' c='dimmed'>
              Merge keeps your current discs and updates any that appear in the file again. Replace starts over from the file.
            </Text>
          </Stack>
        </Panel>

        <Panel
          title='In this browser'
          actions={discs.length > 0 || builds.length > 0
            ? <Button size='xs' variant='subtle' color='red' onClick={handleClear}>Clear data</Button>
            : undefined}
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
