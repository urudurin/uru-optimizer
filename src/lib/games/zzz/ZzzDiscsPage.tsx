import {
  Button,
  Stack,
} from '@mantine/core'
import { PageHeader } from 'lib/games/shared/ui/GameLayout'
import { GearCleanup } from 'lib/games/shared/ui/gear/GearCleanup'
import { GearInventory } from 'lib/games/shared/ui/gear/GearInventory'
import { AGENTS } from 'lib/games/zzz/data/agents'
import { useZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import { useZzzImages } from 'lib/games/zzz/data/images'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import {
  scoreDisc,
  zzzDiscWeights,
} from 'lib/games/zzz/stats/discScore'
import {
  type Disc,
  MAX_DISC_LEVEL,
} from 'lib/games/zzz/types'
import { zzzDiscKind } from 'lib/games/zzz/ui/discKind'
import { useMemo } from 'react'

// S-rank discs reach +15; lower ranks score nothing, so their level doesn't matter here
const maxDiscLevel = () => MAX_DISC_LEVEL

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

  // Clean-up: every saved agent with data, each disc scored with that agent's substat weights
  const candidates = useMemo(
    () => [...new Map(builds.filter((b) => AGENTS[b.agentId]).map((b) => [b.agentId, { id: b.agentId, name: AGENTS[b.agentId].name }])).values()],
    [builds, gameData],
  )
  const scoreAs = useMemo(() => {
    const weights = new Map(candidates.map((c) => [c.id, zzzDiscWeights(AGENTS[c.id])]))
    return (disc: Disc, agentId: string) => {
      const w = weights.get(agentId)
      return w ? scoreDisc(disc, w) : undefined
    }
  }, [candidates])

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Discs'
        description={`${discs.length} discs. Sort by any substat, filter like the game, and add or fix discs by hand. Scores are for the agent wearing each disc.`}
        actions={discs.length === 0 ? <Button onClick={onImport}>Import discs</Button> : undefined}
      />
      <GearInventory kind={kind} items={discs} onSave={saveDisc} onDelete={deleteDiscs} />
      <GearCleanup kind={kind} items={discs} candidates={candidates} scoreAs={scoreAs} maxLevel={maxDiscLevel} />
    </Stack>
  )
}
