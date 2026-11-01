import {
  NumberInput,
  type NumberInputProps,
} from '@mantine/core'
import { useBlurCommittedNumberInput } from 'lib/hooks/useBlurCommittedNumberInput'

// Mantine's NumberInput that only saves when you leave it (or press Enter), after HSR's optimizer filters
// (lib/tabs/tabOptimizer/optimizerForm/layout/FilterRow.tsx, lib/hooks/useBlurCommittedNumberInput.ts). The optimizer
// pages recompute damage, scores and pools on every change, so saving per keystroke made typing lag; it also avoids
// Mantine's stale-value bug the hook describes. Same props as NumberInput; onChange gets the number, or '' when cleared.
export function CommittedNumberInput({ value, onChange, onFocus, onBlur, onKeyDown, ...props }: NumberInputProps) {
  const external = typeof value === 'number' ? value : value === '' || value === undefined ? undefined : Number(value)
  const input = useBlurCommittedNumberInput(Number.isFinite(external) ? external : undefined, (next) => onChange?.(next ?? ''))
  return (
    <NumberInput
      {...props}
      value={input.value}
      onChange={input.onChange}
      onFocus={(event) => {
        input.onFocus()
        onFocus?.(event)
      }}
      onBlur={(event) => {
        input.onBlur()
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        onKeyDown?.(event)
      }}
    />
  )
}
