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
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import { ZzzAgentsPage } from 'lib/games/zzz/ZzzAgentsPage'
import { ZzzDataPage } from 'lib/games/zzz/ZzzDataPage'
import { ZzzDiscsPage } from 'lib/games/zzz/ZzzDiscsPage'
import { ZzzOptimizerPanel } from 'lib/games/zzz/ZzzOptimizerPanel'
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
      { key: 'agents', label: 'Agents', icon: <IconUser size={ICON_SIZE} /> },
      { key: 'discs', label: 'Discs', icon: <IconCards size={ICON_SIZE} /> },
      { key: 'data', label: 'Import / Save', icon: <IconUpload size={ICON_SIZE} /> },
    ],
  },
]

export function ZzzApp() {
  const [page, setPage] = useStoredPage<ZzzPage>('zzz-page', PAGES, 'optimizer')
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
      notice={sampleOnly
        ? <SampleNotice onRemove={() => useZzzStore.getState().clear()} onImport={() => setPage('data')} />
        : page !== 'data' && <BackupReminder game='zzz' hasData={hasData} onSave={() => setPage('data')} />}
    >
      {page === 'agents' && <ZzzAgentsPage onImport={goToImport} />}
      {page === 'optimizer' && <ZzzOptimizerPanel onImport={goToImport} />}
      {page === 'discs' && <ZzzDiscsPage onImport={goToImport} />}
      {page === 'data' && <ZzzDataPage />}
    </GameLayout>
  )
}
