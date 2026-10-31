import { Alert } from '@mantine/core'

// Warns under the optimizer form when rotation damage leaves part of the character out, after HSR's
// UnreleasedCharacterDisclaimer ("Calculations for X are not complete yet"): no kit effects modelled at all, or some
// marked unverified (the confidence tags in each game's damage/combatEffects.ts)
export function KitDisclaimer({ name, effects, byDamage }: {
  name: string,
  effects: { label: string, confidence: 'confirmed' | 'sourced' | 'unverified' }[] | undefined,
  byDamage: boolean,
}) {
  if (!byDamage) return null
  if (!effects || effects.length === 0) {
    return (
      <Alert color='yellow'>
        {`${name}'s own kit effects (passives and buffs) aren't modelled yet, so rotation damage only counts skill multipliers, gear, weapon and teammates. Results won't be fully accurate.`}
      </Alert>
    )
  }
  const unverified = effects.filter((effect) => effect.confidence === 'unverified')
  if (unverified.length === 0) return null
  return (
    <Alert color='yellow'>
      {`Some of ${name}'s kit effects aren't verified yet, so rotation damage may be off: ${
        unverified.map((effect) => effect.label.split(':')[0]).join(', ')
      }.`}
    </Alert>
  )
}
