import {
  Button,
  Stack,
} from '@mantine/core'
import { PageHeader } from 'lib/games/shared/ui/GameLayout'
import { GearInventory } from 'lib/games/shared/ui/gear/GearInventory'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import { wuwaEchoKind } from 'lib/games/wuwa/ui/echoKind'
import { useMemo } from 'react'

// Every echo in the save, in the shared gear inventory (shared/ui/gear): filter, sort, add, edit and delete
export function WuwaEchoesPage({ onImport }: { onImport: () => void }) {
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const saveEcho = useWuwaStore((s) => s.saveEcho)
  const deleteEchoes = useWuwaStore((s) => s.deleteEchoes)

  const kind = useMemo(() => wuwaEchoKind({ characters }), [characters])

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Echoes'
        description={`${echoes.length} echoes. Sort by any substat, filter like the game, and add or fix echoes by hand. Scores are for the Resonator wearing each echo.`}
        actions={echoes.length === 0 ? <Button onClick={onImport}>Import data</Button> : undefined}
      />
      <GearInventory kind={kind} items={echoes} onSave={saveEcho} onDelete={deleteEchoes} />
    </Stack>
  )
}
