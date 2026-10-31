import { Select } from '@mantine/core'

// How many builds a search keeps, after HSR's "Find top N results" (optimizer CharacterSelector ResultLimitN). Saved per
// character with the other optimizer settings; the same choices and default in every game
export const RESULT_LIMITS = [10, 25, 50, 100] as const
export const DEFAULT_RESULT_LIMIT = 10

// A saved value that isn't one of the choices (an old save, a hand-edited file) falls back to the default
export function resultLimitOf(value: unknown): number {
  return RESULT_LIMITS.includes(value as (typeof RESULT_LIMITS)[number]) ? value as number : DEFAULT_RESULT_LIMIT
}

export function ResultLimitSelect({ value, onChange }: { value: number, onChange: (limit: number) => void }) {
  return (
    <Select
      label='Results'
      allowDeselect={false}
      value={String(resultLimitOf(value))}
      onChange={(next) => next && onChange(Number(next))}
      data={RESULT_LIMITS.map((limit) => ({ value: String(limit), label: `Find top ${limit} results` }))}
    />
  )
}
