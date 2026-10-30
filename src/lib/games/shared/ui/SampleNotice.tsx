import {
  Alert,
  Button,
  Group,
  Text,
} from '@mantine/core'
import { IconFlask } from '@tabler/icons-react'

// Above a game's pages while it shows the "Try with sample data" roster (shared/sampleData.ts), so nobody mistakes the
// made-up gear for their own
export function SampleNotice({ onRemove, onImport }: { onRemove: () => void, onImport: () => void }) {
  return (
    <Alert color='blue' variant='light' icon={<IconFlask size={18} />} mb='md'>
      <Group justify='space-between' gap='sm'>
        <Text size='sm'>You're looking at made-up sample data. Import your own to optimize your real gear.</Text>
        <Group gap='xs'>
          <Button size='xs' variant='light' onClick={onImport}>Import your own</Button>
          <Button size='xs' variant='subtle' color='gray' onClick={onRemove}>Remove sample data</Button>
        </Group>
      </Group>
    </Alert>
  )
}
