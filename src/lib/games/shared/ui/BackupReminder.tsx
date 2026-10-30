import {
  Alert,
  Button,
  Group,
  Text,
} from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import {
  backupReminder,
  snoozeBackupReminder,
} from 'lib/games/shared/backup'
import { useState } from 'react'

// A gentle note above a game's pages: everything lives in this browser only, so clearing site data or a fresh browser
// profile loses it. Shown when there is data and no backup in the last two weeks; "Later" puts it off for a week
export function BackupReminder({ game, hasData, onSave }: { game: string, hasData: boolean, onSave: () => void }) {
  const [hidden, setHidden] = useState(false)
  const { due, daysSince } = backupReminder(game, hasData, new Date())
  if (!due || hidden) return null

  const when = daysSince === undefined ? 'You haven\'t saved a backup yet.' : `Your last backup was ${daysSince} days ago.`
  return (
    <Alert color='yellow' variant='light' icon={<IconDeviceFloppy size={18} />} mb='md'>
      <Group justify='space-between' gap='sm'>
        <Text size='sm'>
          {when} Your data is kept in this browser only, so clearing site data or switching browsers would lose it.
        </Text>
        <Group gap='xs'>
          <Button size='xs' variant='light' onClick={onSave}>Save a backup</Button>
          <Button
            size='xs'
            variant='subtle'
            color='gray'
            onClick={() => {
              snoozeBackupReminder(game, new Date())
              setHidden(true)
            }}
          >
            Later
          </Button>
        </Group>
      </Group>
    </Alert>
  )
}
