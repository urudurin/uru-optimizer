import {
  IconCards,
  IconChartBar,
  IconTrendingUp,
  IconUpload,
} from '@tabler/icons-react'
import {
  GameLayout,
  type GameNavGroup,
  useStoredPage,
} from 'lib/games/shared/ui/GameLayout'
import { ZzzDataPage } from 'lib/games/zzz/ZzzDataPage'
import { ZzzDiscsPage } from 'lib/games/zzz/ZzzDiscsPage'
import { ZzzOptimizerPanel } from 'lib/games/zzz/ZzzOptimizerPanel'
import { ZzzStatsPanel } from 'lib/games/zzz/ZzzStatsPanel'

const PAGES = ['agents', 'optimizer', 'discs', 'data'] as const
type ZzzPage = (typeof PAGES)[number]

const ICON_SIZE = 18

const GROUPS: GameNavGroup<ZzzPage>[] = [
  {
    label: 'Tools',
    items: [
      { key: 'agents', label: 'Agent stats', icon: <IconChartBar size={ICON_SIZE} /> },
      { key: 'optimizer', label: 'Disc optimizer', icon: <IconTrendingUp size={ICON_SIZE} /> },
    ],
  },
  {
    label: 'Your account',
    items: [
      { key: 'discs', label: 'Discs', icon: <IconCards size={ICON_SIZE} /> },
      { key: 'data', label: 'Import & data', icon: <IconUpload size={ICON_SIZE} /> },
    ],
  },
]

export function ZzzApp() {
  const [page, setPage] = useStoredPage<ZzzPage>('zzz-page', PAGES, 'agents')
  const goToImport = () => setPage('data')

  return (
    <GameLayout gameName='Zenless Zone Zero' tagline='Disc stats and optimizer' groups={GROUPS} active={page} onNavigate={setPage}>
      {page === 'agents' && <ZzzStatsPanel onImport={goToImport} />}
      {page === 'optimizer' && <ZzzOptimizerPanel onImport={goToImport} />}
      {page === 'discs' && <ZzzDiscsPage onImport={goToImport} />}
      {page === 'data' && <ZzzDataPage />}
    </GameLayout>
  )
}
