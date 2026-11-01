import {
  Select,
  Switch,
} from '@mantine/core'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'

// The Optimizer options card of all three optimizers, after HSR's (lib/tabs/tabOptimizer/optimizerForm): leave out worn
// gear, the character priority filter (off while worn gear is left out), keep current gear, minimum level and rarity,
// and boost main stats. Games without slots or gear rarity (WuWa) leave keep and rarity out.

export type OptimizerOptionsCardProps = {
  // 'artifacts', 'discs', 'echoes'
  gearNoun: string,
  // Who wears gear, as the page names them: 'characters', 'agents', 'Resonators'
  ownerNoun: string,
  // The roster page the priority order comes from: 'Characters', 'Agents', 'Resonators'
  rosterPage: string,
  excludeWorn: boolean,
  onExcludeWorn: (value: boolean) => void,
  priority: boolean,
  onPriority: (value: boolean) => void,
  keep?: { checked: boolean, description: string, onChange: (value: boolean) => void },
  // The levels the Minimum level select offers, 0 first
  levels: number[],
  minLevel: number,
  onMinLevel: (value: number) => void,
  rarity?: { label: string, value: string, options: { value: string, label: string }[], onChange: (value: string) => void },
  boost: boolean,
  boostDescription: string,
  onBoost: (value: boolean) => void,
}

export function OptimizerOptionsCard(props: OptimizerOptionsCardProps) {
  const { gearNoun, ownerNoun, excludeWorn, keep, rarity } = props
  return (
    <FormCard title='Optimizer options' size='narrow'>
      <Switch
        label={`Leave out ${gearNoun} other ${ownerNoun} are wearing`}
        checked={excludeWorn}
        onChange={(event) => props.onExcludeWorn(event.currentTarget.checked)}
      />
      <Switch
        label='Character priority filter'
        description={`Leave out ${gearNoun} worn by ${ownerNoun} ranked above this one on the ${props.rosterPage} page`}
        disabled={excludeWorn}
        checked={props.priority && !excludeWorn}
        onChange={(event) => props.onPriority(event.currentTarget.checked)}
      />
      {keep && (
        <Switch
          label={`Keep current ${gearNoun}`}
          description={keep.description}
          checked={keep.checked}
          onChange={(event) => keep.onChange(event.currentTarget.checked)}
        />
      )}
      <Select
        label='Minimum level'
        size='xs'
        allowDeselect={false}
        value={String(props.minLevel)}
        onChange={(value) => value !== null && props.onMinLevel(Number(value))}
        data={props.levels.map((level) => ({ value: String(level), label: `+${level}` }))}
      />
      {rarity && (
        <Select
          label={rarity.label}
          size='xs'
          allowDeselect={false}
          value={rarity.value}
          onChange={(value) => value !== null && rarity.onChange(value)}
          data={rarity.options}
        />
      )}
      <Switch
        label='Boost main stats to max level'
        description={props.boostDescription}
        checked={props.boost}
        onChange={(event) => props.onBoost(event.currentTarget.checked)}
      />
    </FormCard>
  )
}
