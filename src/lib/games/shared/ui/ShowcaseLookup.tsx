import {
  Anchor,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import {
  IconExternalLink,
  IconSearch,
} from '@tabler/icons-react'
import type { FetchResult } from 'lib/games/shared/enka'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import {
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import {
  type ReactNode,
  useState,
} from 'react'

// The Showcase page of the games Enka.Network covers (Genshin, ZZZ), after HSR's Showcase tab: look up any UID and see
// its showcased characters read-only, with their DPS score and gear, without touching the save; Import adds them to the
// save like the Import page does. Profiles come through the same Enka proxy as imports (shared/enka.ts).

export type ShowcaseConfig<Parsed> = {
  uidStorageKey: string,
  uidLabel: string,
  uidPlaceholder: string,
  isValidUid: (uid: string) => boolean,
  pageUrl: (uid: string) => string,
  fetchProfile: (uid: string) => Promise<FetchResult<unknown>>,
  // The profile's characters and gear, not saved
  parse: (data: unknown) => Promise<FetchResult<Parsed>>,
  importProfile: (data: unknown) => Promise<FetchResult<string>>,
  // What the game calls them ('characters', 'agents')
  noun: string,
}

export function ShowcaseLookup<Parsed>({ config, render }: { config: ShowcaseConfig<Parsed>, render: (parsed: Parsed) => ReactNode }) {
  const [uid, setUid] = useState(() => readStorage(config.uidStorageKey) ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [profile, setProfile] = useState<{ uid: string, data: unknown, parsed: Parsed } | undefined>()
  const [imported, setImported] = useState<string | undefined>()
  const trimmed = uid.trim()

  async function lookUp() {
    writeStorage(config.uidStorageKey, trimmed)
    setLoading(true)
    setError(undefined)
    setImported(undefined)
    try {
      const fetched = await config.fetchProfile(trimmed)
      if (!fetched.ok) return setError(fetched.reason)
      const parsed = await config.parse(fetched.data)
      if (!parsed.ok) return setError(parsed.reason)
      setProfile({ uid: trimmed, data: fetched.data, parsed: parsed.data })
    } finally {
      setLoading(false)
    }
  }

  async function importIt() {
    if (!profile) return
    const outcome = await config.importProfile(profile.data)
    setImported(outcome.ok ? outcome.data : outcome.reason)
  }

  return (
    <Stack gap='md'>
      <PageHeader
        title='Showcase'
        description={`Look up any UID's showcased ${config.noun} and their DPS scores without adding them to your save, like HSR's Showcase tab.`}
      />
      <Panel>
        <Group align='flex-end' gap='sm'>
          <TextInput
            size='xs'
            w={220}
            label={config.uidLabel}
            placeholder={config.uidPlaceholder}
            value={uid}
            onChange={(event) => setUid(event.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Enter' && config.isValidUid(trimmed) && void lookUp()}
          />
          <Button size='xs' leftSection={<IconSearch size={14} />} loading={loading} disabled={!config.isValidUid(trimmed)} onClick={() => void lookUp()}>
            Look up
          </Button>
          {profile && <Button size='xs' variant='light' onClick={() => void importIt()}>{`Import these ${config.noun}`}</Button>}
          {config.isValidUid(trimmed) && (
            <Anchor size='xs' href={config.pageUrl(trimmed)} target='_blank' rel='noreferrer'>
              <Group gap={4}>
                Enka.Network page
                <IconExternalLink size={12} />
              </Group>
            </Anchor>
          )}
        </Group>
        {error && <Text size='xs' c='red' mt='xs'>{error}</Text>}
        {imported && <Text size='xs' mt='xs'>{imported}</Text>}
      </Panel>
      {profile && render(profile.parsed)}
    </Stack>
  )
}
