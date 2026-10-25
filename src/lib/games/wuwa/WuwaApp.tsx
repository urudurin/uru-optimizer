import {
  Stack,
  Text,
  Title,
} from '@mantine/core'

// Placeholder until the WuWa echo importer, stat calculator and optimizer are ported
export function WuwaApp() {
  return (
    <Stack p='md' gap='md' style={{ flex: 1, minWidth: 0 }}>
      <Title order={3}>Wuthering Waves</Title>
      <Text size='sm'>Echo import, stats and the echo optimizer are on the way.</Text>
    </Stack>
  )
}
