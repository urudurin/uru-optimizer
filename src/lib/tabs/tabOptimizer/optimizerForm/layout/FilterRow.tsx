import {
  Flex,
  type NumberInputProps,
} from '@mantine/core'
import { useBlurCommittedNumberInput } from 'lib/hooks/useBlurCommittedNumberInput'
import type {
  RatingFilterState,
  StatFilterState,
} from 'lib/stores/optimizerForm/optimizerFormTypes'
import { useOptimizerRequestStore } from 'lib/stores/optimizerForm/useOptimizerRequestStore'
import { FormStatTextStyled } from 'lib/tabs/tabOptimizer/optimizerForm/components/FormStatTextStyled'
import { InputNumberStyled } from 'lib/tabs/tabOptimizer/optimizerForm/components/InputNumberStyled'
import type { CSSProperties } from 'react'

const highlightedInputStyles: NumberInputProps['styles'] = {
  input: { borderColor: 'color-mix(in srgb, var(--mantine-color-primary-3) 75%, transparent)' },
}

const highlightedTextStyle: CSSProperties = {
  color: 'var(--mantine-color-primary-2)',
}

export function FilterRow({ name, label, type, highlighted }: { name: string, label: string, type?: 'stat' | 'rating', highlighted?: boolean }) {
  const minKey = `min${name}` as keyof StatFilterState & keyof RatingFilterState
  const maxKey = `max${name}` as keyof StatFilterState & keyof RatingFilterState

  const isRating = type === 'rating'

  const minValue = useOptimizerRequestStore((s) =>
    isRating ? s.ratingFilters[minKey as keyof RatingFilterState] : s.statFilters[minKey as keyof StatFilterState]
  )
  const maxValue = useOptimizerRequestStore((s) =>
    isRating ? s.ratingFilters[maxKey as keyof RatingFilterState] : s.statFilters[maxKey as keyof StatFilterState]
  )

  const setFilter = (key: string, val: number | undefined) => {
    if (isRating) {
      useOptimizerRequestStore.getState().setRatingFilter(key as keyof RatingFilterState, val)
    } else {
      useOptimizerRequestStore.getState().setStatFilter(key as keyof StatFilterState, val)
    }
  }

  return (
    <FilterRowInputs
      label={label}
      highlighted={highlighted}
      min={minValue}
      max={maxValue}
      onMin={(v) => setFilter(minKey, v)}
      onMax={(v) => setFilter(maxKey, v)}
    />
  )
}

// The row without the optimizer request store, for other callers (the ZZZ / Genshin / WuWa stat filters)
export function FilterRowInputs({ label, highlighted, min: minValue, max: maxValue, onMin, onMax }: {
  label: string,
  highlighted?: boolean,
  min: number | undefined,
  max: number | undefined,
  onMin: (value: number | undefined) => void,
  onMax: (value: number | undefined) => void,
}) {
  const min = useBlurCommittedNumberInput(minValue, onMin)
  const max = useBlurCommittedNumberInput(maxValue, onMax)

  return (
    <Flex justify='space-between' style={{ margin: 0 }}>
      <InputNumberStyled
        hideControls
        style={{ margin: 0, width: 63 }}
        styles={highlighted ? highlightedInputStyles : undefined}
        aria-label={`${label} min`}
        value={min.value}
        onChange={min.onChange}
        onFocus={min.onFocus}
        onBlur={min.onBlur}
      />
      <FormStatTextStyled style={highlighted ? highlightedTextStyle : undefined}>{label}</FormStatTextStyled>
      <InputNumberStyled
        hideControls
        style={{ margin: 0, width: 63 }}
        styles={highlighted ? highlightedInputStyles : undefined}
        aria-label={`${label} max`}
        value={max.value}
        onChange={max.onChange}
        onFocus={max.onFocus}
        onBlur={max.onBlur}
      />
    </Flex>
  )
}
