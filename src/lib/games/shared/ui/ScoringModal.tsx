import {
  Button,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import type { GearOption } from 'lib/games/shared/gear/gearKind'
import { saveWeightOverrides } from 'lib/games/shared/scoreWeights'
import {
  type ScoringModalConfig,
  useScoringModalStore,
} from 'lib/games/shared/ui/gameModalStores'
import { Message } from 'lib/interactions/message'
import { useState } from 'react'

// Scoring weights for one character, after HSR's Scoring algorithm modal (lib/overlays/modals/ScoringModal.tsx): one
// weight per substat from 0 (useless) to 1 (best), used for every gear score of that character. Reset goes back to the
// game's own table.
export function openScoringModal(config: ScoringModalConfig) {
  useScoringModalStore.getState().openOverlay(config)
}

// Mounted once by GameModals
export function ScoringModal() {
  const open = useScoringModalStore((s) => s.open)
  const config = useScoringModalStore((s) => s.config)
  const close = useScoringModalStore((s) => s.closeOverlay)
  return (
    <Modal opened={open} onClose={close} title={config ? `Scoring weights · ${config.name}` : ''} centered size='lg'>
      {open && config && (
        <ScoringForm
          stats={config.stats}
          current={config.current}
          defaults={config.defaults}
          onSave={(weights) => {
            saveWeightOverrides(config.game, config.characterId, weights)
            close()
            Message.success(weights ? `Saved ${config.name}'s scoring weights` : `${config.name} is back on the default weights`)
          }}
          onCancel={close}
        />
      )}
    </Modal>
  )
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
