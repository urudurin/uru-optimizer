import {
  IconCards,
  IconChartBar,
  IconId,
  IconTrendingUp,
  IconUpload,
  IconUser,
  IconUsersGroup,
} from '@tabler/icons-react'
import { GenshinArtifactsPage } from 'lib/games/genshin/GenshinArtifactsPage'
import { GenshinBenchmarksPage } from 'lib/games/genshin/GenshinBenchmarksPage'
import { GenshinCharactersPage } from 'lib/games/genshin/GenshinCharactersPage'
import { GenshinDataPage } from 'lib/games/genshin/GenshinDataPage'
import { GenshinOptimizerPage } from 'lib/games/genshin/GenshinOptimizerPage'
import { GenshinShowcasePage } from 'lib/games/genshin/GenshinShowcasePage'
import { GenshinTeamsPage } from 'lib/games/genshin/GenshinTeamsPage'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import { isSampleId } from 'lib/games/shared/sampleData'
import { BackupReminder } from 'lib/games/shared/ui/BackupReminder'
import {
  GameLayout,
  type GameNavGroup,
  useGamePage,
} from 'lib/games/shared/ui/GameLayout'
import { SampleNotice } from 'lib/games/shared/ui/SampleNotice'
import { useShallow } from 'zustand/react/shallow'

const PAGES = ['optimizer', 'characters', 'artifacts', 'data', 'benchmarks', 'teams', 'showcase'] as const
type GenshinPage = (typeof PAGES)[number]

const ICON_SIZE = 18

// Same names and order as HSR's Optimization group: Optimizer, Characters, Relics, Import / Save
const GROUPS: GameNavGroup<GenshinPage>[] = [
  {
    label: 'Optimization',
    items: [
      { key: 'optimizer', label: 'Optimizer', icon: <IconTrendingUp size={ICON_SIZE} /> },
      { key: 'artifacts', label: 'Artifacts', icon: <IconCards size={ICON_SIZE} /> },
      { key: 'characters', label: 'Characters', icon: <IconUser size={ICON_SIZE} /> },
      { key: 'data', label: 'ImportSave', icon: <IconUpload size={ICON_SIZE} /> },
    ],
  },
  {
    label: 'Tools',
    items: [
      { key: 'benchmarks', label: 'Benchmarks', icon: <IconChartBar size={ICON_SIZE} /> },
      { key: 'teams', label: 'Teams', icon: <IconUsersGroup size={ICON_SIZE} /> },
      { key: 'showcase', label: 'Showcase', icon: <IconId size={ICON_SIZE} /> },
    ],
  },
]

export function GenshinApp() {
  const [page, setPage] = useGamePage<GenshinPage>('genshin', PAGES, 'optimizer')
  // Gear ids in the save; the sample roster's start with sample- (shared/sampleData.ts)
  const gearIds = useGenshinStore(useShallow((s) => s.artifacts.map((x) => x.id)))
  const sampleOnly = gearIds.length > 0 && gearIds.every(isSampleId)
  const hasData = useGenshinStore((s) => s.characters.length > 0) || (gearIds.length > 0 && !sampleOnly)
  const goToImport = () => setPage('data')

  return (
    <GameLayout
      gameName='Genshin Impact'
      tagline='Artifact stats and optimizer'
      groups={GROUPS}
      active={page}
      onNavigate={setPage}
      settings={{ game: 'genshin', gearNoun: 'artifacts' }}
      notice={sampleOnly
        ? <SampleNotice onRemove={() => useGenshinStore.getState().clear()} onImport={() => setPage('data')} />
        : page !== 'data' && <BackupReminder game='genshin' hasData={hasData} onSave={() => setPage('data')} />}
    >
      {page === 'optimizer' && <GenshinOptimizerPage onImport={goToImport} />}
      {page === 'characters' && <GenshinCharactersPage />}
      {page === 'artifacts' && <GenshinArtifactsPage onImport={goToImport} />}
      {page === 'data' && <GenshinDataPage />}
      {page === 'showcase' && <GenshinShowcasePage />}
      {page === 'teams' && <GenshinTeamsPage />}
      {page === 'benchmarks' && <GenshinBenchmarksPage />}
    </GameLayout>
  )
}
