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
  useGamePage,
} from 'lib/games/shared/ui/GameLayout'
import { SampleNotice } from 'lib/games/shared/ui/SampleNotice'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import { ZzzCharactersPage } from 'lib/games/zzz/ZzzCharactersPage'
import { ZzzDataPage } from 'lib/games/zzz/ZzzDataPage'
import { ZzzDiscsPage } from 'lib/games/zzz/ZzzDiscsPage'
import { ZzzOptimizerPage } from 'lib/games/zzz/ZzzOptimizerPage'
import { useShallow } from 'zustand/react/shallow'

const PAGES = ['optimizer', 'agents', 'discs', 'data'] as const
type ZzzPage = (typeof PAGES)[number]

const ICON_SIZE = 18

// Same names and order as HSR's Optimization group: Optimizer, Characters, Relics, Import / Save
const GROUPS: GameNavGroup<ZzzPage>[] = [
  {
    label: 'Optimization',
    items: [
      { key: 'optimizer', label: 'Optimizer', icon: <IconTrendingUp size={ICON_SIZE} /> },
      { key: 'discs', label: 'Discs', icon: <IconCards size={ICON_SIZE} /> },
      { key: 'agents', label: 'Agents', icon: <IconUser size={ICON_SIZE} /> },
      { key: 'data', label: 'Import / Save', icon: <IconUpload size={ICON_SIZE} /> },
    ],
  },
]

export function ZzzApp() {
  const [page, setPage] = useGamePage<ZzzPage>('zzz', PAGES, 'optimizer')
  // Gear ids in the save; the sample roster's start with sample- (shared/sampleData.ts)
  const gearIds = useZzzStore(useShallow((s) => s.discs.map((x) => x.id)))
  const sampleOnly = gearIds.length > 0 && gearIds.every(isSampleId)
  const hasData = useZzzStore((s) => s.builds.length > 0) || (gearIds.length > 0 && !sampleOnly)
  const goToImport = () => setPage('data')

  return (
    <GameLayout
      gameName='Zenless Zone Zero'
      tagline='Disc stats and optimizer'
      groups={GROUPS}
      active={page}
      onNavigate={setPage}
      settings={{ game: 'zzz', gearNoun: 'discs' }}
      notice={sampleOnly
        ? <SampleNotice onRemove={() => useZzzStore.getState().clear()} onImport={() => setPage('data')} />
        : page !== 'data' && <BackupReminder game='zzz' hasData={hasData} onSave={() => setPage('data')} />}
    >
      {page === 'agents' && <ZzzCharactersPage onImport={goToImport} />}
      {page === 'optimizer' && <ZzzOptimizerPage onImport={goToImport} />}
      {page === 'discs' && <ZzzDiscsPage onImport={goToImport} />}
      {page === 'data' && <ZzzDataPage />}
    </GameLayout>
  )
}
