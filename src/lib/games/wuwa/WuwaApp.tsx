import {
  IconCards,
  IconTrendingUp,
  IconUpload,
  IconUser,
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

const PAGES = ['optimizer', 'characters', 'echoes', 'data'] as const
type WuwaPage = (typeof PAGES)[number]

const ICON_SIZE = 18

// Same names and order as HSR's Optimization group: Optimizer, Characters, Relics, Import / Save
const GROUPS: GameNavGroup<WuwaPage>[] = [
  {
    label: 'Optimization',
    items: [
      { key: 'optimizer', label: 'Optimizer', icon: <IconTrendingUp size={ICON_SIZE} />, badge: 'Soon' },
      { key: 'characters', label: 'Resonators', icon: <IconUser size={ICON_SIZE} /> },
      { key: 'echoes', label: 'Echoes', icon: <IconCards size={ICON_SIZE} /> },
      { key: 'data', label: 'Import / Save', icon: <IconUpload size={ICON_SIZE} /> },
    ],
  },
]

export function WuwaApp() {
  const [page, setPage] = useStoredPage<WuwaPage>('wuwa-page', PAGES, 'optimizer')
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
      <PageHeader title='Optimizer' />
      <Panel>
        <EmptyState icon={<IconTrendingUp size={24} />} title='Coming next'>
          The echo optimizer will search your echoes for the best 5-echo loadout under the 12-cost limit, ranked by the stat you pick, with set and main stat
          filters like the ZZZ disc optimizer.
        </EmptyState>
      </Panel>
    </>
  )
}
