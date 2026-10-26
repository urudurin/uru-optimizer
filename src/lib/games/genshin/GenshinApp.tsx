import {
  IconCards,
  IconTrendingUp,
  IconUpload,
  IconUser,
} from '@tabler/icons-react'
import { GenshinArtifactsPage } from 'lib/games/genshin/GenshinArtifactsPage'
import { GenshinCharactersPage } from 'lib/games/genshin/GenshinCharactersPage'
import { GenshinDataPage } from 'lib/games/genshin/GenshinDataPage'
import { GenshinOptimizerPage } from 'lib/games/genshin/GenshinOptimizerPage'
import {
  GameLayout,
  type GameNavGroup,
  useStoredPage,
} from 'lib/games/shared/ui/GameLayout'

const PAGES = ['optimizer', 'characters', 'artifacts', 'data'] as const
type GenshinPage = (typeof PAGES)[number]

const ICON_SIZE = 18

// Same names and order as HSR's Optimization group: Optimizer, Characters, Relics, Import / Save
const GROUPS: GameNavGroup<GenshinPage>[] = [
  {
    label: 'Optimization',
    items: [
      { key: 'optimizer', label: 'Optimizer', icon: <IconTrendingUp size={ICON_SIZE} /> },
      { key: 'characters', label: 'Characters', icon: <IconUser size={ICON_SIZE} /> },
      { key: 'artifacts', label: 'Artifacts', icon: <IconCards size={ICON_SIZE} /> },
      { key: 'data', label: 'Import / Save', icon: <IconUpload size={ICON_SIZE} /> },
    ],
  },
]

export function GenshinApp() {
  const [page, setPage] = useStoredPage<GenshinPage>('genshin-page', PAGES, 'optimizer')
  const goToImport = () => setPage('data')

  return (
    <GameLayout gameName='Genshin Impact' tagline='Artifact stats and optimizer' groups={GROUPS} active={page} onNavigate={setPage}>
      {page === 'optimizer' && <GenshinOptimizerPage onImport={goToImport} />}
      {page === 'characters' && <GenshinCharactersPage onImport={goToImport} />}
      {page === 'artifacts' && <GenshinArtifactsPage onImport={goToImport} />}
      {page === 'data' && <GenshinDataPage />}
    </GameLayout>
  )
}
