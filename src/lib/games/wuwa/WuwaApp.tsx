import {
  IconCards,
  IconTrendingUp,
  IconUpload,
  IconUsers,
} from '@tabler/icons-react'
import {
  EmptyState,
  GameLayout,
  type GameNavGroup,
  PageHeader,
  Panel,
  useStoredPage,
} from 'lib/games/shared/ui/GameLayout'
import { WuwaCharactersPage } from 'lib/games/wuwa/WuwaCharactersPage'
import { WuwaDataPage } from 'lib/games/wuwa/WuwaDataPage'
import { WuwaEchoesPage } from 'lib/games/wuwa/WuwaEchoesPage'

const PAGES = ['characters', 'optimizer', 'echoes', 'data'] as const
type WuwaPage = (typeof PAGES)[number]

const ICON_SIZE = 18

const GROUPS: GameNavGroup<WuwaPage>[] = [
  {
    label: 'Tools',
    items: [
      { key: 'characters', label: 'Characters', icon: <IconUsers size={ICON_SIZE} /> },
      { key: 'optimizer', label: 'Echo optimizer', icon: <IconTrendingUp size={ICON_SIZE} />, badge: 'Soon' },
    ],
  },
  {
    label: 'Your account',
    items: [
      { key: 'echoes', label: 'Echoes', icon: <IconCards size={ICON_SIZE} /> },
      { key: 'data', label: 'Import & data', icon: <IconUpload size={ICON_SIZE} /> },
    ],
  },
]

export function WuwaApp() {
  const [page, setPage] = useStoredPage<WuwaPage>('wuwa-page', PAGES, 'characters')
  const goToImport = () => setPage('data')

  return (
    <GameLayout gameName='Wuthering Waves' tagline='Echo stats and optimizer' groups={GROUPS} active={page} onNavigate={setPage}>
      {page === 'characters' && <WuwaCharactersPage onImport={goToImport} />}
      {page === 'optimizer' && <OptimizerComingSoon />}
      {page === 'echoes' && <WuwaEchoesPage onImport={goToImport} />}
      {page === 'data' && <WuwaDataPage />}
    </GameLayout>
  )
}

function OptimizerComingSoon() {
  return (
    <>
      <PageHeader title='Echo optimizer' />
      <Panel>
        <EmptyState icon={<IconTrendingUp size={24} />} title='Coming next'>
          The echo optimizer will search your echoes for the best 5-echo loadout under the 12-cost limit, ranked by the stat you pick, with set and main stat
          filters like the ZZZ disc optimizer.
        </EmptyState>
      </Panel>
    </>
  )
}
