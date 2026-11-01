import {
  Alert,
  Button,
  Group,
  Text,
} from '@mantine/core'
import { IconFlask } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// Above a game's pages while it shows the "Try with sample data" roster (shared/sampleData.ts), so nobody mistakes the
// made-up gear for their own
export function SampleNotice({ onRemove, onImport }: { onRemove: () => void, onImport: () => void }) {
  const { t } = useTranslation('games', { keyPrefix: 'SampleNotice' })
  return (
    <Alert color='blue' variant='light' icon={<IconFlask size={18} />} mb='md'>
      <Group justify='space-between' gap='sm'>
        <Text size='sm'>{t('Text')}</Text>
        <Group gap='xs'>
          <Button size='xs' variant='light' onClick={onImport}>{t('Import')}</Button>
          <Button size='xs' variant='subtle' color='gray' onClick={onRemove}>{t('Remove')}</Button>
        </Group>
      </Group>
    </Alert>
  )
}
