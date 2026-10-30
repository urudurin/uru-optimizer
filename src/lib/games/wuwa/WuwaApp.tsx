import {
  IconCards,
  IconTrendingUp,
  IconUpload,
  IconUser,
} from '@tabler/icons-react'
import { isSampleId } from 'lib/games/shared/sampleData'
import { BackupReminder } from 'lib/games/shared/ui/BackupReminder'
import {
  GameLayout,
  type GameNavGroup,
  useStoredPage,
} from 'lib/games/shared/ui/GameLayout'
import { SampleNotice } from 'lib/games/shared/ui/SampleNotice'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import { WuwaCharactersPage } from 'lib/games/wuwa/WuwaCharactersPage'
import { WuwaDataPage } from 'lib/games/wuwa/WuwaDataPage'
import { WuwaEchoesPage } from 'lib/games/wuwa/WuwaEchoesPage'
import { WuwaOptimizerPage } from 'lib/games/wuwa/WuwaOptimizerPage'
import { useShallow } from 'zustand/react/shallow'

const PAGES = ['optimizer', 'characters', 'echoes', 'data'] as const
type WuwaPage = (typeof PAGES)[number]

const ICON_SIZE = 18

// Same names and order as HSR's Optimization group: Optimizer, Characters, Relics, Import / Save
const GROUPS: GameNavGroup<WuwaPage>[] = [
  {
    label: 'Optimization',
    items: [
      { key: 'optimizer', label: 'Optimizer', icon: <IconTrendingUp size={ICON_SIZE} /> },
      { key: 'characters', label: 'Resonators', icon: <IconUser size={ICON_SIZE} /> },
      { key: 'echoes', label: 'Echoes', icon: <IconCards size={ICON_SIZE} /> },
      { key: 'data', label: 'Import / Save', icon: <IconUpload size={ICON_SIZE} /> },
    ],
  },
]

export function WuwaApp() {
  const [page, setPage] = useStoredPage<WuwaPage>('wuwa-page', PAGES, 'optimizer')
  // Gear ids in the save; the sample roster's start with sample- (shared/sampleData.ts)
  const gearIds = useWuwaStore(useShallow((s) => s.echoes.map((x) => x.id)))
  const sampleOnly = gearIds.length > 0 && gearIds.every(isSampleId)
  const hasData = useWuwaStore((s) => s.characters.length > 0) || (gearIds.length > 0 && !sampleOnly)
  const goToImport = () => setPage('data')

  return (
    <GameLayout
      gameName='Wuthering Waves'
      tagline='Echo stats and optimizer'
      groups={GROUPS}
      active={page}
      onNavigate={setPage}
      notice={sampleOnly
        ? <SampleNotice onRemove={() => useWuwaStore.getState().clear()} onImport={() => setPage('data')} />
        : page !== 'data' && <BackupReminder game='wuwa' hasData={hasData} onSave={() => setPage('data')} />}
    >
      {page === 'characters' && <WuwaCharactersPage onImport={goToImport} />}
      {page === 'optimizer' && <WuwaOptimizerPage onImport={goToImport} />}
      {page === 'echoes' && <WuwaEchoesPage onImport={goToImport} />}
      {page === 'data' && <WuwaDataPage />}
    </GameLayout>
  )
}
