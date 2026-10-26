import {
  Anchor,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import {
  IconCloudDownload,
  IconExternalLink,
} from '@tabler/icons-react'
import type { FetchResult } from 'lib/games/shared/enka'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import { useState } from 'react'

// The "Import from Enka.Network" panel, shared by the games Enka covers. The game supplies how to check a UID, fetch
// the profile and import it

export type EnkaImportConfig = {
  // localStorage key for the last UID used
  uidStorageKey: string,
  uidLabel: string,
  uidPlaceholder: string,
  uidHint: string,
  description: string,
  // What to add to the showcase to import more, e.g. "agents" or "characters"
  showcaseNoun: string,
  isValidUid: (uid: string) => boolean,
  apiUrl: (uid: string) => string,
  pageUrl: (uid: string) => string,
  fetchProfile: (uid: string) => Promise<FetchResult<unknown>>,
  importProfile: (data: unknown) => Promise<FetchResult<string>>,
}

export function EnkaImportPanel({ config }: { config: EnkaImportConfig }) {
  const [uid, setUid] = useState(() => readStorage(config.uidStorageKey) ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean, text: string } | null>(null)
  const trimmed = uid.trim()
  const valid = config.isValidUid(trimmed)

  async function handleImport() {
    writeStorage(config.uidStorageKey, trimmed)
    setLoading(true)
    setResult(null)
    try {
      const profile = await config.fetchProfile(trimmed)
      const outcome = profile.ok ? await config.importProfile(profile.data) : profile
      setResult(outcome.ok ? { ok: true, text: outcome.data } : { ok: false, text: outcome.reason })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel title='Import from Enka.Network' description={config.description}>
      <Stack gap='sm'>
        <Group gap='sm' align='flex-end' wrap='nowrap'>
          <TextInput
            size='sm'
            style={{ flex: 1 }}
            label={config.uidLabel}
            placeholder={config.uidPlaceholder}
            value={uid}
            onChange={(event) => setUid(event.currentTarget.value)}
            error={trimmed && !valid ? config.uidHint : undefined}
          />
          <Button size='sm' leftSection={<IconCloudDownload size={16} />} onClick={handleImport} loading={loading} disabled={!valid}>
            Import from Enka
          </Button>
        </Group>
        {result && <Text size='xs' c={result.ok ? 'teal' : 'yellow'}>{result.text}</Text>}
        <Text size='xs' c='dimmed'>
          The button works when the site runs locally (npm start). Elsewhere,{' '}
          <Anchor size='xs' href={valid ? config.apiUrl(trimmed) : undefined} target='_blank' rel='noreferrer' c={valid ? undefined : 'dimmed'}>
            open my Enka data <IconExternalLink size={11} />
          </Anchor>
          , save the page as a .json file and import it in the Import box.
        </Text>
        <Text size='xs' c='dimmed'>
          Data from <Anchor size='xs' href={valid ? config.pageUrl(trimmed) : 'https://enka.network/'} target='_blank' rel='noreferrer'>Enka.Network</Anchor>
          {`. Only your showcased ${config.showcaseNoun} are available, add more to your in-game showcase to import them.`}
        </Text>
      </Stack>
    </Panel>
  )
}
