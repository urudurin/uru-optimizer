import {
  NumberInput,
  Text,
} from '@mantine/core'
import classes from 'lib/games/shared/ui/optimizer/StatFilters.module.css'

// Minimum and maximum for each stat, after HSR's optimizer stat filters (lib/tabs/tabOptimizer/optimizerForm/layout/
// FilterRow.tsx): one row per stat, min on the left and max on the right, blank for no limit

export type StatLimits = Partial<Record<string, number>>

export function StatFilters({ rows, min, max, onMin, onMax }: {
  rows: { key: string, label: string }[],
  min: StatLimits,
  max: StatLimits,
  onMin: (next: StatLimits) => void,
  onMax: (next: StatLimits) => void,
}) {
  const set = (limits: StatLimits, key: string, value: string | number) => ({ ...limits, [key]: typeof value === 'number' ? value : undefined })
  return (
    <div className={classes.filters}>
      <Text size='xs' c='dimmed'>Stat</Text>
      <Text size='xs' c='dimmed' ta='center'>Min</Text>
      <Text size='xs' c='dimmed' ta='center'>Max</Text>
      {rows.map((row) => {
        const wrong = min[row.key] !== undefined && max[row.key] !== undefined && max[row.key]! < min[row.key]!
        return (
          <div key={row.key} className={classes.row}>
            <Text size='xs' className={classes.label}>{row.label}</Text>
            <NumberInput
              size='xs'
              placeholder='0'
              min={0}
              hideControls
              aria-label={`${row.label} minimum`}
              value={min[row.key] ?? ''}
              onChange={(value) => onMin(set(min, row.key, value))}
            />
            <NumberInput
              size='xs'
              placeholder='∞'
              min={0}
              hideControls
              aria-label={`${row.label} maximum`}
              error={wrong ? ' ' : undefined}
              value={max[row.key] ?? ''}
              onChange={(value) => onMax(set(max, row.key, value))}
            />
          </div>
        )
      })}
    </div>
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
