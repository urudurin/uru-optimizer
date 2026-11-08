import {
  Accordion,
  Button,
  FileInput,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import type { GameId } from 'lib/games/games'
import { presetImportStore } from 'lib/games/shared/presetImports'
import { confirmAction } from 'lib/games/shared/ui/confirm'
import { Notices } from 'lib/games/shared/ui/GameLayout'
import { Message } from 'lib/interactions/message'

const MAX_IMPORT_WARNINGS = 8

// The user's own presets file (shared/presetImports.ts), under each optimizer's Recommended build card: import, switch
// on or off, remove. Kept in this browser only; nothing is fetched, and the file is never committed
export function ImportedPresetsPanel({ game, count, source, warnings }: {
  game: GameId,
  // Characters the file has presets for, its source and its parse warnings (undefined: nothing imported or switched off)
  count?: number,
  source?: string,
  warnings?: string[],
}) {
  const store = presetImportStore(game)
  const stored = store((s) => s.stored)
  const enabled = store((s) => s.enabled)

  async function handleFile(file: File | null) {
    if (!file) return
    store.getState().importText(await file.text())
  }

  async function remove() {
    if (!await confirmAction('Remove imported presets', 'Remove the imported presets from this browser?', { danger: true, confirmLabel: 'Remove' })) return
    store.getState().clear()
    Message.success('Removed the imported presets')
  }

  return (
    <Accordion variant='contained' radius='sm'>
      <Accordion.Item value='own'>
        <Accordion.Control>
          <Text size='xs'>
            {stored
              ? enabled && count !== undefined ? `Your presets: ${count} from ${source || 'a file'}` : 'Your presets file (switched off)'
              : 'Use your own presets file'}
          </Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap='xs'>
            <FileInput placeholder='Choose a presets file (.json)' accept='application/json,.json' clearable onChange={handleFile} />
            {stored && (
              <Switch
                size='xs'
                checked={enabled}
                onChange={(event) => store.getState().setEnabled(event.currentTarget.checked)}
                label='Use the imported presets (off: built-in only)'
              />
            )}
            {stored && <Button size='xs' variant='subtle' color='red' onClick={remove}>Remove imported presets</Button>}
            <Text size='xs' c='dimmed'>
              Kept in this browser only. A file can give each character substat weights, main stats, sets, the rank, and the DPS score's Default team and
              rotation (format in shared/presetImports.ts). Imported presets are for personal, non-commercial use; follow the terms of wherever they came from.
            </Text>
            {warnings && <Notices messages={warnings} max={MAX_IMPORT_WARNINGS} />}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  )
}
