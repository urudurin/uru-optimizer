import {
  Button,
  Stack,
} from '@mantine/core'
import { useGenshinImages } from 'lib/games/genshin/data/images'
import { loadEnkaGenshinStore } from 'lib/games/genshin/importer/enkaClient'
import type { EnkaGenshinStore } from 'lib/games/genshin/importer/enkaParser'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import { genshinArtifactKind } from 'lib/games/genshin/ui/artifactKind'
import { PageHeader } from 'lib/games/shared/ui/GameLayout'
import { GearInventory } from 'lib/games/shared/ui/gear/GearInventory'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'

// Every artifact in the save, in the shared gear inventory (shared/ui/gear): filter, sort, add, edit and delete.
// Enka's store files give the editor every set's name and the main stat values
export function GenshinArtifactsPage({ onImport }: { onImport: () => void }) {
  const artifacts = useGenshinStore((s) => s.artifacts)
  const characters = useGenshinStore((s) => s.characters)
  const saveArtifact = useGenshinStore((s) => s.saveArtifact)
  const deleteArtifacts = useGenshinStore((s) => s.deleteArtifacts)
  const images = useGenshinImages()
  const [store, setStore] = useState<EnkaGenshinStore | undefined>()

  useEffect(() => {
    let live = true
    void loadEnkaGenshinStore().then((result) => {
      if (live && result.ok) setStore(result.data)
    })
    return () => {
      live = false
    }
  }, [])

  const kind = useMemo(() => genshinArtifactKind({ characters, images, store, artifacts }), [characters, images, store, artifacts])

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Artifacts'
        description={`${artifacts.length} artifacts. Sort by any substat, filter like the game, and add or fix artifacts by hand. Scores are for the character wearing each artifact.`}
        actions={artifacts.length === 0 ? <Button onClick={onImport}>Import</Button> : undefined}
      />
      <GearInventory kind={kind} items={artifacts} onSave={saveArtifact} onDelete={deleteArtifacts} />
    </Stack>
  )
}
