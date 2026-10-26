import {
  Button,
  Group,
  Progress,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconCheck,
  IconPlayerStop,
  IconSearch,
} from '@tabler/icons-react'
import { formatNumber } from 'lib/games/shared/format'
import type { SearchProgress } from 'lib/games/shared/progress'
import classes from 'lib/games/shared/ui/Optimizer.module.css'
import {
  type ReactNode,
  useEffect,
  useState,
} from 'react'

// The optimizer controls that stay in view while the settings and results scroll, after HSR's optimizer sidebar:
// how big the search is, Start / Cancel with progress, what the last search found, and Equip for the picked build.
// Shared by the ZZZ, Genshin and WuWa optimizer pages; Optimizer.module.css places it.

export type OptimizerSidebarProps = {
  // Pieces left per slot (or cost) after the filters
  pools: { label: string, value: number }[],
  // Every combination of those pieces, before any pruning
  combinations: number,
  combinationsLabel?: string,
  // Why the search can't start, or anything else worth saying under the button
  hint?: { text: string, warn?: boolean },
  canStart: boolean,
  running: boolean,
  progress?: SearchProgress,
  onStart: () => void,
  onCancel: () => void,
  // The last search
  results?: { count: number, seconds: number, note?: string },
  // The build picked in the results
  equip?: { label: string, onEquip: () => void, equipped: boolean },
}

function SidebarSection({ title, children }: { title: string, children: ReactNode }) {
  return (
    <div className={classes.sidebarSection}>
      <Text size='xs' fw={600} c='dimmed' tt='uppercase' mb={6}>{title}</Text>
      {children}
    </div>
  )
}

function useElapsedSeconds(running: boolean): number {
  const [startedAt, setStartedAt] = useState<number | undefined>()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!running) {
      setStartedAt(undefined)
      return
    }
    setStartedAt(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])
  return startedAt ? Math.max(0, (now - startedAt) / 1000) : 0
}

export function OptimizerSidebar(props: OptimizerSidebarProps) {
  const { pools, combinations, running, progress, results, equip } = props
  const elapsed = useElapsedSeconds(running)

  return (
    <aside className={classes.sidebar}>
      <SidebarSection title='Search'>
        <div className={classes.sidebarPools}>
          {pools.map((pool) => (
            <Group key={pool.label} justify='space-between' gap={4} wrap='nowrap'>
              <Text size='xs' c='dimmed'>{pool.label}</Text>
              <Text size='xs'>{formatNumber(pool.value)}</Text>
            </Group>
          ))}
        </div>
        <Group justify='space-between' gap={4} mt={6} wrap='nowrap'>
          <Text size='xs' fw={600}>{props.combinationsLabel ?? 'Combinations'}</Text>
          <Text size='xs' fw={600}>{formatNumber(combinations)}</Text>
        </Group>
      </SidebarSection>

      <SidebarSection title='Controls'>
        <Stack gap={6}>
          {running
            ? (
              <Button size='sm' variant='default' leftSection={<IconPlayerStop size={16} />} onClick={props.onCancel}>
                Cancel
              </Button>
            )
            : (
              <Button size='sm' leftSection={<IconSearch size={16} />} onClick={props.onStart} disabled={!props.canStart}>
                Start optimizer
              </Button>
            )}
          {running && (
            <>
              <Progress value={(progress?.fraction ?? 0) * 100} size='sm' animated striped />
              <Text size='xs' c='dimmed'>
                {`${elapsed.toFixed(1)}s${progress ? ` · ${formatNumber(progress.visited)} checked` : ''}`}
              </Text>
            </>
          )}
          {!running && props.hint && <Text size='xs' c={props.hint.warn ? 'yellow' : 'dimmed'}>{props.hint.text}</Text>}
        </Stack>
      </SidebarSection>

      {results && (
        <SidebarSection title='Results'>
          <Text size='xs'>{`${results.count} found in ${results.seconds.toFixed(1)}s`}</Text>
          {results.note && <Text size='xs' c='yellow' mt={4}>{results.note}</Text>}
        </SidebarSection>
      )}

      {equip && (
        <SidebarSection title='Build'>
          <Stack gap={6}>
            <Button
              size='sm'
              variant={equip.equipped ? 'light' : 'filled'}
              color={equip.equipped ? 'teal' : undefined}
              leftSection={<IconCheck size={16} />}
              onClick={equip.onEquip}
              disabled={equip.equipped}
            >
              {equip.equipped ? 'Equipped' : `Equip ${equip.label}`}
            </Button>
            <Text size='xs' c='dimmed'>Saves it as the current build in this browser. Your game doesn't change.</Text>
          </Stack>
        </SidebarSection>
      )}
    </aside>
  )
}
