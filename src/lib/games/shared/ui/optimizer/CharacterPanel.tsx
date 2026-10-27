import {
  Button,
  Group,
  Text,
} from '@mantine/core'
import classes from 'lib/games/shared/ui/optimizer/CharacterPanel.module.css'
import { initials } from 'lib/games/shared/ui/Showcase'
import type { CSSProperties } from 'react'

// The character's art at the start of the optimizer form, after HSR's OptimizerTabCharacterPanel, and the button rows
// HSR uses for Eidolons and Superimposition (here Mindscape / Constellation / Sequence, refinement, Core Skill)

export function CharacterPortrait({ name, portrait, accent, weapon }: {
  name: string,
  portrait?: string,
  accent?: string,
  weapon?: { image?: string, name: string },
}) {
  return (
    <section className={classes.portraitCard} style={{ '--accent': accent } as CSSProperties}>
      <div className={classes.portrait}>
        {portrait ? <img src={portrait} alt={name} /> : <div className={classes.fallback}>{initials(name)}</div>}
      </div>
      {weapon && (
        <div className={classes.weapon}>
          {weapon.image && <img src={weapon.image} alt='' />}
          <Text size='xs' fw={600} lineClamp={2}>{weapon.name}</Text>
        </div>
      )}
    </section>
  )
}

// A row of buttons for a small number like a refinement: 'R' + 1..5
export function RankButtons({ label, prefix, from, to, value, onChange, names }: {
  label: string,
  prefix: string,
  from: number,
  to: number,
  value: number,
  onChange: (value: number) => void,
  // Names instead of numbers, e.g. Core Skill A-F
  names?: string[],
}) {
  const data = Array.from({ length: to - from + 1 }, (_, i) => ({ value: String(from + i), label: names?.[i] ?? `${prefix}${from + i}` }))
  return (
    <div>
      <Text size='xs' c='dimmed' mb={4}>{label}</Text>
      {/* Buttons that wrap, unlike a segmented control, so a narrow card never overflows */}
      <Group gap={4}>
        {data.map((option) => (
          <Button
            key={option.value}
            size='compact-xs'
            miw={32}
            variant={option.value === String(value) ? 'filled' : 'default'}
            onClick={() => onChange(Number(option.value))}
          >
            {option.label}
          </Button>
        ))}
      </Group>
    </div>
  )
}
