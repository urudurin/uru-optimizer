import {
  Button,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import type { GameId } from 'lib/games/games'
import type { CharacterMetadata } from 'lib/games/shared/characterMetadata'
import type { ParsedImports } from 'lib/games/shared/presetImports'
import { ImportedPresetsPanel } from 'lib/games/shared/ui/optimizer/ImportedPresetsPanel'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'

// The optimizer's Recommended build card, after HSR's Recommended presets (optimization/defaultForm.ts reads the same
// metadata): what the character's metadata recommends (main stats, set options, substat order, rank, the DPS score's
// Default team) and a button that puts it into the filters. The metadata is ours, or the user's imported presets file
// laid over it (shared/presetImports.ts). ZZZ keeps its own card for its build presets and shares the import panel.

export function RecommendedCard({ game, metadata, choice, onChoice, onApply, slots, statLabel, setLabel, sortLabel, characterName, imports }: {
  game: GameId,
  metadata: CharacterMetadata<unknown>,
  // The picked set option (index into simulation.sets)
  choice: number,
  onChoice: (choice: number) => void,
  onApply: () => void,
  // Main stat slots in order, with labels
  slots: { key: string, label: string }[],
  statLabel: (stat: string) => string,
  // A set option's label, e.g. "4pc Viridescent Venerer"
  setLabel: (ids: string[]) => string,
  sortLabel: (sortOption: string) => string,
  characterName: (id: string) => string,
  imports: ParsedImports | undefined,
}) {
  const sets = metadata.simulation?.sets ?? []
  const substats = Object.entries(metadata.stats).filter(([, weight]) => weight > 0).sort((a, b) => b[1] - a[1])
  const team = metadata.simulation?.teammates ?? []
  const hasMains = slots.some((slot) => (metadata.parts[slot.key]?.length ?? 0) > 0)
  return (
    <FormCard title='Recommended build' size='wide' description={`${metadata.source} · ${metadata.confidence}`}>
      <Button size='xs' variant='light' onClick={onApply}>Apply to the filters</Button>
      {sets.length > 1 && (
        <Select
          aria-label='Set option'
          allowDeselect={false}
          value={String(Math.min(choice, sets.length - 1))}
          onChange={(value) => onChoice(Number(value ?? 0))}
          data={sets.map((option, i) => ({ value: String(i), label: setLabel(option) }))}
        />
      )}
      <Stack gap={2}>
        {sets.map((option, i) => (
          <Text key={i} size='xs'>
            <Text span size='xs' c='dimmed'>{i === 0 ? 'Sets ' : 'Or '}</Text>
            {setLabel(option)}
          </Text>
        ))}
        {hasMains
          ? slots.map((slot) => (
            <Text key={slot.key} size='xs'>
              <Text span size='xs' c='dimmed'>{`${slot.label} `}</Text>
              {(metadata.parts[slot.key] ?? []).map(statLabel).join(' / ') || 'any'}
            </Text>
          ))
          : <Text size='xs' c='dimmed'>No main stat recommendation yet: any main stat.</Text>}
        {substats.length > 0 && (
          <Text size='xs'>
            <Text span size='xs' c='dimmed'>{'Substats '}</Text>
            {substats.map(([stat]) => statLabel(stat)).join(' > ')}
          </Text>
        )}
        <Text size='xs'>
          <Text span size='xs' c='dimmed'>{'Rank by '}</Text>
          {sortLabel(metadata.sortOption)}
        </Text>
        {team.length > 0 && (
          <Text size='xs'>
            <Text span size='xs' c='dimmed'>{'DPS score team '}</Text>
            {team.map((mate) => characterName(mate.id)).join(', ')}
          </Text>
        )}
      </Stack>
      <Text size='xs' c='dimmed'>{`Last reviewed ${metadata.reviewed}`}</Text>
      <ImportedPresetsPanel
        game={game}
        count={imports ? Object.keys(imports.byCharacter).length : undefined}
        source={imports?.source}
        warnings={imports?.warnings}
      />
    </FormCard>
  )
}
