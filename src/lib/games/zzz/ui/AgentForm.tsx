import {
  Button,
  Group,
  Select,
  Stack,
} from '@mantine/core'
import type { ZzzImages } from 'lib/games/zzz/data/images'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import { ZzzWEngineSelect } from 'lib/games/zzz/ui/pickers'
import { useState } from 'react'

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i))

// Mindscape and W-Engine for an agent added by hand (or a saved build, to change them). Agents are always level 60:
// that's what the agent data is for
export function AgentForm({ initial, images, submitLabel, onSubmit, onCancel }: {
  initial: ImportedBuild,
  images: ZzzImages,
  submitLabel: string,
  onSubmit: (build: ImportedBuild) => void,
  onCancel?: () => void,
}) {
  const [build, setBuild] = useState(initial)
  const update = (changes: Partial<ImportedBuild>) => setBuild((prev) => ({ ...prev, ...changes }))

  return (
    <Stack gap={8}>
      <Select
        size='xs'
        label='Mindscape'
        allowDeselect={false}
        value={String(build.mindscapeLevel)}
        onChange={(value) => update({ mindscapeLevel: Number(value ?? 0) })}
        data={range(0, 6).map((value) => ({ value, label: `M${value}` }))}
      />
      <Group grow gap={8}>
        <ZzzWEngineSelect
          size='xs'
          images={images}
          value={build.wEngineId ?? null}
          onChange={(value) => update({ wEngineId: value ?? undefined })}
        />
        <Select
          size='xs'
          label='Refinement'
          allowDeselect={false}
          value={String(build.wEngineRefinement)}
          onChange={(value) => update({ wEngineRefinement: Number(value ?? 1) })}
          data={range(1, 5).map((value) => ({ value, label: `R${value}` }))}
        />
      </Group>
      <Group gap={8}>
        <Button size='xs' onClick={() => onSubmit(build)}>{submitLabel}</Button>
        {onCancel && <Button size='xs' variant='subtle' onClick={onCancel}>Cancel</Button>}
      </Group>
    </Stack>
  )
}
