import {
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { IconTrendingUp } from '@tabler/icons-react'
import type { FilterCause } from 'lib/games/shared/noResults'
import { PreviewWithAnalysis } from 'lib/games/shared/ui/BuildAnalysis'
import {
  EmptyState,
  Notices,
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import classes from 'lib/games/shared/ui/Optimizer.module.css'
import {
  BuildCompare,
  type PinnedBuild,
} from 'lib/games/shared/ui/optimizer/BuildCompare'
import {
  NoBuildPanel,
  NoResults,
} from 'lib/games/shared/ui/optimizer/NoResults'
import {
  ResultsGrid,
  type ResultsGridProps,
} from 'lib/games/shared/ui/optimizer/ResultsGrid'
import type { ReactNode } from 'react'

// The parts every game's optimizer page has, after HSR's optimizer tab: the page before any gear is imported, the
// layout (form and results on the left, OptimizerSidebar on the right) and the results column. Each game's page fills
// them with its own form rows, grid columns and build preview.

// Before there is any gear to search
export function OptimizerImportFirst({ gearNoun, text, onImport, onSample }: {
  // 'artifacts', 'discs', 'echoes'
  gearNoun: string,
  text: string,
  onImport: () => void,
  onSample: () => void,
}) {
  return (
    <Stack gap='lg'>
      <PageHeader title='Optimizer' />
      <Panel>
        <EmptyState
          icon={<IconTrendingUp size={24} />}
          title={`Import your ${gearNoun} first`}
          action={
            <Group gap='xs'>
              <Button onClick={onImport}>Import data</Button>
              <Button variant='light' onClick={onSample}>Try with sample data</Button>
            </Group>
          }
        >
          {text}
        </EmptyState>
      </Panel>
    </Stack>
  )
}

export function OptimizerPageShell({ description, sidebar, children }: {
  description: string,
  sidebar: ReactNode,
  // The form rows and OptimizerResults
  children: ReactNode,
}) {
  return (
    <Stack gap='lg'>
      <PageHeader title='Optimizer' description={description} />
      <div className={classes.optimizerLayout}>
        <Stack gap='md'>{children}</Stack>
        {sidebar}
      </div>
    </Stack>
  )
}

export function OptimizerResults({ game, gearNoun, intro, emptyPool, failure, results, pins, preview }: {
  game: string,
  gearNoun: string,
  // Before the first search
  intro?: { title: string, text: string },
  // Shown before a search while the filters leave a slot (or WuWa's pool) empty
  emptyPool?: { causes: FilterCause[], empty: 'slot' | 'pool' },
  // The search's own failure message
  failure?: string,
  results?: {
    description: string,
    // Why the list may not be the best there is (a search that stopped at its budget)
    warning?: string,
    // undefined when nothing matched: the reasons are listed instead. gridKey starts the grid afresh when it changes
    grid?: ResultsGridProps & { gridKey: string },
    causes: () => FilterCause[],
  },
  pins: { pinned: PinnedBuild[], unpin: (id: string) => void },
  // The picked build's BuildPreview and BuildAnalysis
  preview: ReactNode,
}) {
  return (
    <>
      {intro && (
        <Panel>
          <EmptyState icon={<IconTrendingUp size={24} />} title={intro.title}>{intro.text}</EmptyState>
        </Panel>
      )}

      {emptyPool && <NoBuildPanel causes={emptyPool.causes} gearNoun={gearNoun} empty={emptyPool.empty} />}

      {failure && <Notices messages={[failure]} />}

      {results && (
        <Panel title='Results' description={results.description}>
          <Stack gap='sm'>
            {results.warning && <Text size='xs' c='yellow'>{results.warning}</Text>}
            {results.grid
              ? <ResultsGrid key={results.grid.gridKey} {...results.grid} />
              : <NoResults heading causes={results.causes()} gearNoun={gearNoun} />}
          </Stack>
        </Panel>
      )}

      <PreviewWithAnalysis game={game}>{preview}</PreviewWithAnalysis>
      <BuildCompare pinned={pins.pinned} onUnpin={pins.unpin} />
    </>
  )
}
