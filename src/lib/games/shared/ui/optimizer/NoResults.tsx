import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import type { FilterCause } from 'lib/games/shared/noResults'
import { Panel } from 'lib/games/shared/ui/GameLayout'
import { Message } from 'lib/interactions/message'
import { useTranslation } from 'react-i18next'

// The suggestions when a search can't find a build, after HSR's OptimizerSuggestionsModal: each filter that's set with
// a fix, blocking ones first (shared/noResults.ts)

export function NoResults({ heading, causes, gearNoun }: {
  // "Nothing matched" above the list; left out inside a panel that has its own title
  heading?: boolean,
  causes: FilterCause[],
  // 'artifacts', 'discs', 'echoes'
  gearNoun: string,
}) {
  const { t } = useTranslation('games', { keyPrefix: 'NoResults' })
  const { t: tGear } = useTranslation('games', { keyPrefix: 'Gear' })
  const blocking = causes.some((cause) => cause.blocking)
  return (
    <Stack gap='xs'>
      {heading && <Text size='sm' fw={600}>{t('NothingMatched')}</Text>}
      {causes.length === 0
        ? <Text size='xs' c='dimmed'>{t('NoFilters', { gear: tGear(gearNoun as never) })}</Text>
        : (
          <>
            <Text size='xs' c='dimmed'>{blocking ? t('BlockingHelp') : t('Help')}</Text>
            {causes.map((cause) => (
              <Group key={cause.key} justify='space-between' wrap='nowrap' gap='sm'>
                <Group gap={6} wrap='nowrap' style={{ minWidth: 0 }}>
                  <Text size='xs' truncate>{cause.label}</Text>
                  {cause.blocking && <Badge size='xs' color='red' variant='light'>{t('Blocking')}</Badge>}
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

// Before a search: the panel shown while a slot (or the WuWa pool) has nothing left, so Start is off
export function NoBuildPanel({ causes, gearNoun, empty }: {
  causes: FilterCause[],
  gearNoun: string,
  // 'slot': a slot is empty (Genshin, ZZZ); 'pool': no pieces at all (WuWa)
  empty: 'slot' | 'pool',
}) {
  const { t } = useTranslation('games', { keyPrefix: 'NoResults' })
  const { t: tGear } = useTranslation('games', { keyPrefix: 'Gear' })
  const gear = tGear(gearNoun as never)
  return (
    <Panel title={empty === 'slot' ? t('NoFullBuild') : t('NoLoadout')} description={empty === 'slot' ? t('SlotEmpty', { gear }) : t('PoolEmpty', { gear })}>
      <NoResults causes={causes} gearNoun={gearNoun} />
    </Panel>
  )
}
