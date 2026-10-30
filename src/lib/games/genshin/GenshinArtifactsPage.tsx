import {
  Button,
  Stack,
} from '@mantine/core'
import { useGenshinImages } from 'lib/games/genshin/data/images'
import { loadEnkaGenshinStore } from 'lib/games/genshin/importer/enkaClient'
import type { EnkaGenshinStore } from 'lib/games/genshin/importer/enkaParser'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import {
  genshinArtifactWeights,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import type { Artifact } from 'lib/games/genshin/types'
import { genshinArtifactKind } from 'lib/games/genshin/ui/artifactKind'
import { PageHeader } from 'lib/games/shared/ui/GameLayout'
import { GearCleanup } from 'lib/games/shared/ui/gear/GearCleanup'
import { GearInventory } from 'lib/games/shared/ui/gear/GearInventory'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'

// Every artifact in the save, in the shared gear inventory (shared/ui/gear): filter, sort, add, edit and delete.
// Enka's store files give the editor every set's name and the main stat values
// Top level by rarity: 5-star +20, 4-star +16, 3-star +12
const maxArtifactLevel = (artifact: Artifact) => (artifact.rarity >= 3 ? artifact.rarity * 4 : 4)

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
  // Clean-up: every saved character, each artifact scored with that character's substat weights
  const candidates = useMemo(() => characters.map((c) => ({ id: c.id, name: c.name })), [characters])
  const scoreAs = useMemo(() => {
    const weights = new Map(characters.map((c) => [c.id, genshinArtifactWeights(c)]))
    return (artifact: Artifact, characterId: string) => {
      const w = weights.get(characterId)
      return w ? scoreArtifact(artifact, w) : undefined
    }
  }, [characters])

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Artifacts'
        description={`${artifacts.length} artifacts. Sort by any substat, filter like the game, and add or fix artifacts by hand. Scores are for the character wearing each artifact.`}
        actions={artifacts.length === 0 ? <Button onClick={onImport}>Import</Button> : undefined}
      />
      <GearInventory kind={kind} items={artifacts} onSave={saveArtifact} onDelete={deleteArtifacts} />
      <GearCleanup kind={kind} items={artifacts} candidates={candidates} scoreAs={scoreAs} maxLevel={maxArtifactLevel} />
    </Stack>
  )
}
