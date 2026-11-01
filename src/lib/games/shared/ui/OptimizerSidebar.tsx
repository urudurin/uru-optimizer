import {
  Button,
  Group,
  Progress,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconCheck,
  IconDeviceFloppy,
  IconFolderOpen,
  IconPin,
  IconPinnedOff,
  IconPlayerStop,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { formatNumber } from 'lib/games/shared/format'
import type { SearchProgress } from 'lib/games/shared/progress'
import { confirmAction } from 'lib/games/shared/ui/confirm'
import classes from 'lib/games/shared/ui/Optimizer.module.css'
import {
  type ReactNode,
  useEffect,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

// The optimizer controls that stay in view while the settings and results scroll, after HSR's optimizer sidebar:
// how big the search is, Start / Cancel with progress, what the last search found, and Equip for the picked build.
// Shared by the ZZZ, Genshin and WuWa optimizer pages; Optimizer.module.css places it.

// Results columns as combat stats (with team, kit and set buffs) or the stat screen, after HSR's stat and filter view
export type StatView = 'combat' | 'basic'

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
  statView?: { value: StatView, onChange: (view: StatView) => void },
  // Puts the character's filters back to their defaults (after a confirmation, like HSR's Reset)
  onReset?: () => void,
  // Pin the picked build to compare (shared/ui/optimizer/BuildCompare.tsx), and clear this character's pins
  pins?: { onPin?: () => void, count: number, onClear: () => void },
  // Save the picked build by name, or load one of the character's saved builds (shared/savedBuilds.ts)
  builds?: { onSave?: () => void, onLoad: () => void, count: number },
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
  const { t } = useTranslation('games', { keyPrefix: 'Sidebar' })

  return (
    <aside className={classes.sidebar}>
      <SidebarSection title={t('Search')}>
        <div className={classes.sidebarPools}>
          {pools.map((pool) => (
            <Group key={pool.label} justify='space-between' gap={4} wrap='nowrap'>
              <Text size='xs' c='dimmed'>{pool.label}</Text>
              <Text size='xs'>{formatNumber(pool.value)}</Text>
            </Group>
          ))}
        </div>
        <Group justify='space-between' gap={4} mt={6} wrap='nowrap'>
          <Text size='xs' fw={600}>{props.combinationsLabel ?? t('Combinations')}</Text>
          <Text size='xs' fw={600}>{formatNumber(combinations)}</Text>
        </Group>
      </SidebarSection>

      <SidebarSection title={t('Controls')}>
        <Stack gap={6}>
          {running
            ? (
              <Button size='sm' variant='default' leftSection={<IconPlayerStop size={16} />} onClick={props.onCancel}>
                {t('Cancel')}
              </Button>
            )
            : (
              <Button size='sm' leftSection={<IconSearch size={16} />} onClick={props.onStart} disabled={!props.canStart}>
                {t('Start')}
              </Button>
            )}
          {running && (
            <>
              <Progress value={(progress?.fraction ?? 0) * 100} size='sm' animated striped />
              <Text size='xs' c='dimmed'>
                {progress
                  ? t('Checked', { seconds: elapsed.toFixed(1), count: formatNumber(progress.visited) as never })
                  : t('Elapsed', { seconds: elapsed.toFixed(1) })}
              </Text>
            </>
          )}
          {!running && props.hint && <Text size='xs' c={props.hint.warn ? 'yellow' : 'dimmed'}>{props.hint.text}</Text>}
          {props.statView && (
            <SegmentedControl
              size='xs'
              fullWidth
              value={props.statView.value}
              onChange={(value) => props.statView?.onChange(value as StatView)}
              data={[{ value: 'combat', label: t('CombatStats') }, { value: 'basic', label: t('BasicStats') }]}
            />
          )}
          {props.onReset && (
            <Button
              size='xs'
              variant='subtle'
              color='gray'
              leftSection={<IconRefresh size={14} />}
              disabled={running}
              onClick={async () => {
                if (await confirmAction(t('ResetTitle'), t('ResetBody'), { confirmLabel: t('Reset') })) {
                  props.onReset?.()
                }
              }}
            >
              {t('Reset')}
            </Button>
          )}
        </Stack>
      </SidebarSection>

      {results && (
        <SidebarSection title={t('Results')}>
          <Text size='xs'>{t('Found', { count: results.count, seconds: results.seconds.toFixed(1) })}</Text>
          {results.note && <Text size='xs' c='yellow' mt={4}>{results.note}</Text>}
          {props.pins && (
            <Group gap={6} mt={6} grow>
              <Button size='xs' variant='light' leftSection={<IconPin size={14} />} disabled={!props.pins.onPin} onClick={props.pins.onPin}>
                {t('PinBuild')}
              </Button>
              <Button size='xs' variant='default' leftSection={<IconPinnedOff size={14} />} disabled={props.pins.count === 0} onClick={props.pins.onClear}>
                {t('ClearPins')}
              </Button>
            </Group>
          )}
        </SidebarSection>
      )}

      {equip && (
        <SidebarSection title={t('Build')}>
          <Stack gap={6}>
            <Button
              size='sm'
              variant={equip.equipped ? 'light' : 'filled'}
              color={equip.equipped ? 'teal' : undefined}
              leftSection={<IconCheck size={16} />}
              onClick={equip.onEquip}
              disabled={equip.equipped}
            >
              {equip.equipped ? t('Equipped') : t('Equip', { label: equip.label })}
            </Button>
            <Text size='xs' c='dimmed'>{t('EquipNote')}</Text>
          </Stack>
        </SidebarSection>
      )}

      {props.builds && (
        <SidebarSection title={t('Builds')}>
          <Group gap={6} grow>
            <Button size='xs' variant='light' leftSection={<IconDeviceFloppy size={14} />} disabled={!props.builds.onSave} onClick={props.builds.onSave}>
              {t('Save')}
            </Button>
            <Button size='xs' variant='default' leftSection={<IconFolderOpen size={14} />} onClick={props.builds.onLoad}>
              {props.builds.count ? t('LoadCount', { count: props.builds.count }) : t('Load')}
            </Button>
          </Group>
        </SidebarSection>
      )}
    </aside>
  )
}
