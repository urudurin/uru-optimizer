import {
  Button,
  Stack,
} from '@mantine/core'
import { PageHeader } from 'lib/games/shared/ui/GameLayout'
import { GearCleanup } from 'lib/games/shared/ui/gear/GearCleanup'
import { GearInventory } from 'lib/games/shared/ui/gear/GearInventory'
import { characterName } from 'lib/games/wuwa/data/gameData'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import {
  scoreEcho,
  wuwaEchoWeights,
} from 'lib/games/wuwa/stats/echoScore'
import {
  type Echo,
  MAX_ECHO_LEVEL,
} from 'lib/games/wuwa/types'
import { wuwaEchoKind } from 'lib/games/wuwa/ui/echoKind'
import { useMemo } from 'react'

// Every echo in the save, in the shared gear inventory (shared/ui/gear): filter, sort, add, edit and delete
const maxEchoLevel = () => MAX_ECHO_LEVEL

export function WuwaEchoesPage({ onImport }: { onImport: () => void }) {
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const saveEcho = useWuwaStore((s) => s.saveEcho)
  const deleteEchoes = useWuwaStore((s) => s.deleteEchoes)

  const kind = useMemo(() => wuwaEchoKind({ characters }), [characters])
  // Clean-up: every saved Resonator, each echo scored with that Resonator's substat weights
  const candidates = useMemo(() => characters.map((c) => ({ id: c.charId, name: characterName(c.charId) })), [characters])
  const scoreAs = useMemo(() => {
    const weights = new Map(characters.map((c) => [c.charId, wuwaEchoWeights(c)]))
    return (echo: Echo, charId: string) => {
      const w = weights.get(charId)
      return w ? scoreEcho(echo, w) : undefined
    }
  }, [characters])

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Echoes'
        description={`${echoes.length} echoes. Sort by any substat, filter like the game, and add or fix echoes by hand. Scores are for the Resonator wearing each echo.`}
        actions={echoes.length === 0 ? <Button onClick={onImport}>Import data</Button> : undefined}
      />
      <GearInventory kind={kind} items={echoes} onSave={saveEcho} onDelete={deleteEchoes} />
      <GearCleanup kind={kind} items={echoes} candidates={candidates} scoreAs={scoreAs} maxLevel={maxEchoLevel} />
    </Stack>
  )
}
