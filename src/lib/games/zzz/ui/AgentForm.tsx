import {
  Button,
  Group,
  Select,
  Stack,
} from '@mantine/core'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import { useState } from 'react'

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i))

// W-Engines with stat data, the agent's specialty first (any agent can equip any W-Engine, but its passive only works
// for its own specialty)
function wEngineOptions(specialty: string) {
  const all = Object.values(W_ENGINES)
  const option = (engine: (typeof all)[number]) => ({ value: engine.id, label: `${engine.name} (${engine.rarity})` })
  return [
    { group: specialty, items: all.filter((e) => e.specialty === specialty).map(option) },
    { group: 'Other', items: all.filter((e) => e.specialty !== specialty).map(option) },
  ].filter((group) => group.items.length > 0)
}

export function defaultWEngine(specialty: string): string | undefined {
  const all = Object.values(W_ENGINES)
  return (all.find((e) => e.specialty === specialty) ?? all[0])?.id
}

// Mindscape and W-Engine for an agent added by hand (or a saved build, to change them). Agents are always level 60:
// that's what the agent data is for
export function AgentForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: ImportedBuild,
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
        <Select
          size='xs'
          label='W-Engine'
          allowDeselect={false}
          value={build.wEngineId ?? null}
          onChange={(value) => update({ wEngineId: value ?? undefined })}
          data={wEngineOptions(build.specialty)}
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
        <Button size='xs' disabled={!build.wEngineId} onClick={() => onSubmit(build)}>{submitLabel}</Button>
        {onCancel && <Button size='xs' variant='subtle' onClick={onCancel}>Cancel</Button>}
      </Group>
    </Stack>
  )
}
