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
import { useTranslation } from 'react-i18next'

// A gentle note above a game's pages: everything lives in this browser only, so clearing site data or a fresh browser
// profile loses it. Shown when there is data and no backup in the last two weeks; "Later" puts it off for a week
export function BackupReminder({ game, hasData, onSave }: { game: string, hasData: boolean, onSave: () => void }) {
  const [hidden, setHidden] = useState(false)
  const { t } = useTranslation('games', { keyPrefix: 'BackupReminder' })
  const { due, daysSince } = backupReminder(game, hasData, new Date())
  if (!due || hidden) return null

  const when = daysSince === undefined ? t('Never') : t('DaysAgo', { days: daysSince })
  return (
    <Alert color='yellow' variant='light' icon={<IconDeviceFloppy size={18} />} mb='md'>
      <Group justify='space-between' gap='sm'>
        <Text size='sm'>
          {`${when} ${t('BrowserOnly')}`}
        </Text>
        <Group gap='xs'>
          <Button size='xs' variant='light' onClick={onSave}>{t('Save')}</Button>
          <Button
            size='xs'
            variant='subtle'
            color='gray'
            onClick={() => {
              snoozeBackupReminder(game, new Date())
              setHidden(true)
            }}
          >
            {t('Later')}
          </Button>
        </Group>
      </Group>
    </Alert>
  )
}
