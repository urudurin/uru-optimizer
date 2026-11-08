import {
  Radio,
  Stack,
} from '@mantine/core'
import {
  type ImportChoice,
  readImportChoice,
  writeImportChoice,
} from 'lib/games/shared/importChoice'
import {
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import { useState } from 'react'

// The Import page's "what to import" step, after HSR's import step 2 (shared/importChoice.ts). Applies to every import
// on the page (files and Enka); backups always restore everything
export function ImportChoiceControl({ game, gearNoun, characterNoun }: { game: string, gearNoun: string, characterNoun: string }) {
  const [choice, setChoice] = useState<ImportChoice>(() => readImportChoice(game))
  const pick = (value: string) => {
    writeImportChoice(game, value as ImportChoice)
    setChoice(value as ImportChoice)
  }
  return (
    <Panel title='What to import' description='Applies to every import on this page. Backups always restore everything.'>
      <Radio.Group value={choice} onChange={pick}>
        <Stack gap={6}>
          <Radio size='xs' value='all' label={`${gearNoun} and ${characterNoun}`} />
          <Radio size='xs' value='gear' label={`${gearNoun} only (your ${characterNoun} stay as they are)`} />
          <Radio size='xs' value='existing' label={`${gearNoun}, and only the ${characterNoun} you already have`} />
        </Stack>
      </Radio.Group>
    </Panel>
  )
}
