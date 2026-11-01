import { Flex } from '@mantine/core'
import { FilterRowInputs } from 'lib/tabs/tabOptimizer/optimizerForm/layout/FilterRow'

// Minimum and maximum for each stat, with HSR's optimizer stat filter rows (lib/tabs/tabOptimizer/optimizerForm/layout/
// FilterRow.tsx): one row per stat, min on the left and max on the right, blank for no limit

export type StatLimits = Partial<Record<string, number>>

export function StatFilters({ rows, min, max, onMin, onMax }: {
  rows: { key: string, label: string }[],
  min: StatLimits,
  max: StatLimits,
  onMin: (next: StatLimits) => void,
  onMax: (next: StatLimits) => void,
}) {
  return (
    <Flex direction='column' gap={5}>
      {rows.map((row) => (
        <FilterRowInputs
          key={row.key}
          label={row.label}
          min={min[row.key]}
          max={max[row.key]}
          onMin={(value) => onMin({ ...min, [row.key]: value })}
          onMax={(value) => onMax({ ...max, [row.key]: value })}
        />
      ))}
    </Flex>
  )
}

// '2 minimums, 1 maximum' for a form row's summary
export function limitsSummary(min: StatLimits, max: StatLimits): string {
  const count = (limits: StatLimits) => Object.values(limits).filter((v) => v !== undefined).length
  const mins = count(min)
  const maxes = count(max)
  if (!mins && !maxes) return 'no stat limits'
  return [mins ? `${mins} minimum${mins === 1 ? '' : 's'}` : '', maxes ? `${maxes} maximum${maxes === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ')
}
