import {
  Button,
  Stack,
} from '@mantine/core'
import { PageHeader } from 'lib/games/shared/ui/GameLayout'
import { GearInventory } from 'lib/games/shared/ui/gear/GearInventory'
import { useZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import { useZzzImages } from 'lib/games/zzz/data/images'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import { zzzDiscKind } from 'lib/games/zzz/ui/discKind'
import { useMemo } from 'react'

// Every disc in the save, in the shared gear inventory (shared/ui/gear): filter, sort, add, edit and delete
export function ZzzDiscsPage({ onImport }: { onImport: () => void }) {
  const discs = useZzzStore((s) => s.discs)
  const builds = useZzzStore((s) => s.builds)
  const saveDisc = useZzzStore((s) => s.saveDisc)
  const deleteDiscs = useZzzStore((s) => s.deleteDiscs)
  const images = useZzzImages()
  const gameData = useZzzGameData()

  // gameData: scores need every agent's data, which arrives from Enka after the first render
  const kind = useMemo(() => zzzDiscKind({ builds, images, discs }), [builds, images, discs, gameData])

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Discs'
        description={`${discs.length} discs. Sort by any substat, filter like the game, and add or fix discs by hand. Scores are for the agent wearing each disc.`}
        actions={discs.length === 0 ? <Button onClick={onImport}>Import discs</Button> : undefined}
      />
      <GearInventory kind={kind} items={discs} onSave={saveDisc} onDelete={deleteDiscs} />
    </Stack>
  )
}
