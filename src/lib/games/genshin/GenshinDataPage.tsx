import {
  Button,
  FileInput,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconDownload,
  IconFileImport,
} from '@tabler/icons-react'
import {
  enkaProfileApiUrl,
  enkaProfilePageUrl,
  fetchEnkaGenshinProfile,
  isValidGenshinUid,
} from 'lib/games/genshin/importer/enkaClient'
import { importEnkaGenshinProfile } from 'lib/games/genshin/importer/enkaImport'
import { isEnkaGenshinResponse } from 'lib/games/genshin/importer/enkaParser'
import { importGoodFile } from 'lib/games/genshin/importer/goodImport'
import { isGoodFile } from 'lib/games/genshin/importer/goodParser'
import {
  createGenshinBackup,
  readGenshinBackup,
} from 'lib/games/genshin/state/genshinState'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import {
  backupFileName,
  recordBackup,
  downloadTextFile,
} from 'lib/games/shared/backup'
import { parseJsonOrUndefined } from 'lib/games/shared/enka'
import { formatNumber } from 'lib/games/shared/format'
import { todayString } from 'lib/games/shared/importedPresets'
import {
  type EnkaImportConfig,
  EnkaImportPanel,
} from 'lib/games/shared/ui/EnkaImportPanel'
import {
  Notices,
  PageHeader,
  Panel,
  StatGrid,
} from 'lib/games/shared/ui/GameLayout'
import { useState } from 'react'

const ENKA_CONFIG: EnkaImportConfig = {
  uidStorageKey: 'genshin-enka-uid',
  uidLabel: 'Genshin UID',
  uidPlaceholder: 'e.g. 602175084',
  uidHint: '9 or 10 digits',
  description: 'Loads the characters in your in-game showcase with their stats, weapon and artifacts. Turn on "Show Character Details" in the game.',
  showcaseNoun: 'characters',
  isValidUid: isValidGenshinUid,
  apiUrl: enkaProfileApiUrl,
  pageUrl: enkaProfilePageUrl,
  fetchProfile: (uid) => fetchEnkaGenshinProfile(uid),
  importProfile: importEnkaGenshinProfile,
}

export function GenshinDataPage() {
  const artifacts = useGenshinStore((s) => s.artifacts)
  const characters = useGenshinStore((s) => s.characters)
  const warnings = useGenshinStore((s) => s.lastWarnings)
  const importParsed = useGenshinStore((s) => s.importParsed)
  const clear = useGenshinStore((s) => s.clear)
  const [message, setMessage] = useState<{ ok: boolean, text: string } | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    const text = await file.text()
    // A backup saved from this page restores as-is, a GOOD file replaces the inventory, a saved Enka profile merges in
    const backup = readGenshinBackup(text)
    const parsed = parseJsonOrUndefined(text)
    if (backup) {
      importParsed({ ...backup, warnings: [] }, 'replace')
      setMessage({ ok: true, text: `Restored a backup with ${backup.characters.length} characters and ${backup.artifacts.length} artifacts` })
    } else if (isGoodFile(parsed)) {
      setMessage({ ok: true, text: 'Reading the GOOD file...' })
      const outcome = await importGoodFile(parsed)
      setMessage(outcome.ok ? { ok: true, text: outcome.data } : { ok: false, text: outcome.reason })
    } else if (isEnkaGenshinResponse(parsed)) {
      const outcome = await importEnkaGenshinProfile(parsed)
      setMessage(outcome.ok ? { ok: true, text: outcome.data } : { ok: false, text: outcome.reason })
    } else {
      setMessage({ ok: false, text: 'That file isn\'t a GOOD file, a saved Enka.Network Genshin profile or a backup from this page' })
    }
  }

  function handleSave() {
    const savedAt = todayString(new Date())
    downloadTextFile(backupFileName('genshin', savedAt), createGenshinBackup({ artifacts, characters }, savedAt))
    recordBackup('genshin', savedAt)
  }

  function handleClear() {
    if (window.confirm('Remove all stored Genshin characters and artifacts from this browser?')) clear()
  }

  const hasData = artifacts.length > 0 || characters.length > 0

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Import / Save'
        description='Your characters and artifacts are kept in this browser only. Nothing is uploaded. Save a backup to keep a copy or move them to another browser.'
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing='lg'>
        <EnkaImportPanel config={ENKA_CONFIG} />

        <Panel
          title='Import'
          description='A GOOD file from an artifact scanner (Irminsul, Inventory Kamera), a saved Enka.Network profile, or a backup saved here. A GOOD file or backup replaces what is here; Enka stats are kept.'
        >
          <Stack gap='sm'>
            <FileInput
              size='sm'
              leftSection={<IconFileImport size={16} />}
              placeholder='Choose a .json file'
              accept='application/json,.json'
              clearable
              onChange={handleFile}
            />
            {message && <Text size='xs' c={message.ok ? 'teal' : 'yellow'}>{message.text}</Text>}
          </Stack>
        </Panel>

        <Panel title='Save a backup' description='Downloads your characters and artifacts as a .json file. Import it here to restore them.'>
          <Stack gap='sm'>
            <Button leftSection={<IconDownload size={16} />} onClick={handleSave} disabled={!hasData}>
              Save a backup
            </Button>
            <Text size='xs' c='dimmed'>{hasData ? `${characters.length} characters and ${artifacts.length} artifacts.` : 'Nothing to save yet.'}</Text>
          </Stack>
        </Panel>

        <Panel
          title='In this browser'
          actions={hasData ? <Button size='xs' variant='subtle' color='red' onClick={handleClear}>Clear data</Button> : undefined}
        >
          <StatGrid
            stats={[
              { key: 'characters', label: 'Characters', value: formatNumber(characters.length) },
              { key: 'artifacts', label: 'Artifacts', value: formatNumber(artifacts.length) },
            ]}
          />
        </Panel>
      </SimpleGrid>

      <Notices title={`${warnings.length} note${warnings.length === 1 ? '' : 's'} from the last import`} messages={warnings} max={8} />
    </Stack>
  )
}
