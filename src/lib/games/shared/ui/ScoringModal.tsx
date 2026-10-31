import {
  Button,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import type { GearOption } from 'lib/games/shared/gear/gearKind'
import { saveWeightOverrides } from 'lib/games/shared/scoreWeights'
import { Message } from 'lib/interactions/message'
import { useState } from 'react'

// Scoring weights for one character, after HSR's Scoring algorithm modal (lib/overlays/modals/ScoringModal.tsx): one
// weight per substat from 0 (useless) to 1 (best), used for every gear score of that character. Reset goes back to the
// game's own table.
export function openScoringModal({ game, characterId, name, stats, current, defaults }: {
  game: string,
  characterId: string,
  name: string,
  // The substats, in the game's order
  stats: GearOption[],
  current: Record<string, number>,
  defaults: Record<string, number>,
}) {
  const id = modals.open({
    title: `Scoring weights · ${name}`,
    centered: true,
    size: 'lg',
    children: (
      <ScoringForm
        stats={stats}
        current={current}
        defaults={defaults}
        onSave={(weights) => {
          saveWeightOverrides(game, characterId, weights)
          modals.close(id)
          Message.success(weights ? `Saved ${name}'s scoring weights` : `${name} is back on the default weights`)
        }}
        onCancel={() => modals.close(id)}
      />
    ),
  })
}

function ScoringForm({ stats, current, defaults, onSave, onCancel }: {
  stats: GearOption[],
  current: Record<string, number>,
  defaults: Record<string, number>,
  onSave: (weights: Record<string, number> | undefined) => void,
  onCancel: () => void,
}) {
  const [weights, setWeights] = useState(() => Object.fromEntries(stats.map((s) => [s.value, current[s.value] ?? 0])))
  const changed = stats.filter((s) => (weights[s.value] ?? 0) !== (defaults[s.value] ?? 0))
  return (
    <Stack gap='sm'>
      <Text size='xs' c='dimmed'>
        How much each substat is worth to this character, from 0 (useless) to 1 (best). Gear scores, build ratings and clean-up suggestions use these.
      </Text>
      <SimpleGrid cols={2} spacing='sm'>
        {stats.map((stat) => (
          <NumberInput
            key={stat.value}
            label={stat.label}
            description={`Default ${defaults[stat.value] ?? 0}`}
            min={0}
            max={1}
            step={0.1}
            decimalScale={2}
            value={weights[stat.value]}
            onChange={(value) => setWeights((prev) => ({ ...prev, [stat.value]: Math.max(0, Math.min(1, Number(value) || 0)) }))}
          />
        ))}
      </SimpleGrid>
      <Group justify='space-between' gap='xs'>
        <Button variant='subtle' color='gray' onClick={() => onSave(undefined)}>Reset to defaults</Button>
        <Group gap='xs'>
          <Button variant='default' onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave(changed.length > 0 ? weights : undefined)}>Save</Button>
        </Group>
      </Group>
    </Stack>
  )
}
