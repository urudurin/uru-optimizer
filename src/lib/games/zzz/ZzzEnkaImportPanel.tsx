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
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import {
  enkaProfileApiUrl,
  enkaProfilePageUrl,
  fetchEnkaZzzProfile,
  isValidZzzUid,
} from 'lib/games/zzz/importer/enkaClient'
import { importEnkaZzzProfile } from 'lib/games/zzz/importer/enkaImport'
import { useState } from 'react'

const UID_KEY = 'zzz-enka-uid'

export function ZzzEnkaImportPanel() {
  const [uid, setUid] = useState(() => readStorage(UID_KEY) ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean, text: string } | null>(null)
  const trimmed = uid.trim()
  const valid = isValidZzzUid(trimmed)

  async function handleImport() {
    writeStorage(UID_KEY, trimmed)
    setLoading(true)
    setResult(null)
    try {
      const profile = await fetchEnkaZzzProfile(trimmed)
      const outcome = profile.ok ? await importEnkaZzzProfile(profile.data) : profile
      setResult(outcome.ok ? { ok: true, text: outcome.data } : { ok: false, text: outcome.reason })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel
      title='Import from Enka.Network'
      description='Loads the agents in your in-game showcase and the discs they wear. Your other discs stay as they are.'
    >
      <Stack gap='sm'>
        <Group gap='sm' align='flex-end' wrap='nowrap'>
          <TextInput
            size='sm'
            style={{ flex: 1 }}
            label='ZZZ UID'
            placeholder='e.g. 1000074590'
            value={uid}
            onChange={(event) => setUid(event.currentTarget.value)}
            error={trimmed && !valid ? '8 to 11 digits' : undefined}
          />
          <Button size='sm' leftSection={<IconCloudDownload size={16} />} onClick={handleImport} loading={loading} disabled={!valid}>
            Import from Enka
          </Button>
        </Group>
        {result && <Text size='xs' c={result.ok ? 'teal' : 'yellow'}>{result.text}</Text>}
        <Text size='xs' c='dimmed'>
          The button works when the site runs locally (npm start). Elsewhere,{' '}
          <Anchor size='xs' href={valid ? enkaProfileApiUrl(trimmed) : undefined} target='_blank' rel='noreferrer' c={valid ? undefined : 'dimmed'}>
            open my Enka data <IconExternalLink size={11} />
          </Anchor>
          , save the page as a .json file and import it in the Import box.
        </Text>
        <Text size='xs' c='dimmed'>
          Data from{' '}
          <Anchor size='xs' href={valid ? enkaProfilePageUrl(trimmed) : 'https://enka.network/'} target='_blank' rel='noreferrer'>Enka.Network</Anchor>
          . Only your showcased agents are available, add more to your in-game showcase to import them.
        </Text>
      </Stack>
    </Panel>
  )
}
