import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import type { FilterCause } from 'lib/games/shared/noResults'
import { Message } from 'lib/interactions/message'

// The suggestions when a search can't find a build, after HSR's OptimizerSuggestionsModal: each filter that's set with
// a fix, blocking ones first (shared/noResults.ts)

export function NoResults({ title, causes, gearNoun }: {
  // Left out inside a panel that has its own title
  title?: string,
  causes: FilterCause[],
  // 'artifacts', 'discs', 'echoes'
  gearNoun: string,
}) {
  const blocking = causes.some((cause) => cause.blocking)
  return (
    <Stack gap='xs'>
      {title && <Text size='sm' fw={600}>{title}</Text>}
      {causes.length === 0
        ? (
          <Text size='xs' c='dimmed'>
            {`No filters are set, so there may not be enough ${gearNoun} for a full build yet. Import more, or add them by hand.`}
          </Text>
        )
        : (
          <>
            <Text size='xs' c='dimmed'>
              {blocking
                ? 'A filter marked "Blocking" is enough on its own: turning it off fills every slot again.'
                : 'These filters are set; loosening one may let builds through.'}
            </Text>
            {causes.map((cause) => (
              <Group key={cause.key} justify='space-between' wrap='nowrap' gap='sm'>
                <Group gap={6} wrap='nowrap' style={{ minWidth: 0 }}>
                  <Text size='xs' truncate>{cause.label}</Text>
                  {cause.blocking && <Badge size='xs' color='red' variant='light'>Blocking</Badge>}
                </Group>
                <Button
                  size='compact-xs'
                  variant='default'
                  onClick={() => {
                    cause.apply()
                    Message.success(`${cause.label}: ${cause.fixLabel.toLowerCase()}`)
                  }}
                >
                  {cause.fixLabel}
                </Button>
              </Group>
            ))}
          </>
        )}
    </Stack>
  )
}
