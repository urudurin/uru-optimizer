import {
  isValidMainStat,
  SUBSTAT_TIERS,
  tierOf,
} from 'lib/games/wuwa/echoStats'
import {
  type Cost,
  type Echo,
  MAX_ECHO_LEVEL,
  MAX_LOADOUT_COST,
  MAX_LOADOUT_ECHOES,
  statLabel,
} from 'lib/games/wuwa/types'

// The in-game rules for a single echo and for the five a character wears. Both return plain-language problems
// instead of throwing, an empty list means legal.

// The echo's own definition: its cost and the sonata sets it can drop in
export type EchoDefinition = {
  cost: Cost,
  setIds: string[],
}

export function validateEcho(echo: Echo, definition: EchoDefinition): string[] {
  const errors: string[] = []
  if (echo.cost !== definition.cost) errors.push(`This echo is ${definition.cost}-cost, not ${echo.cost}-cost`)
  if (!definition.setIds.includes(echo.setId)) errors.push('This echo can\'t drop in that sonata set')
  if (!isValidMainStat(echo.cost, echo.mainStat)) {
    errors.push(`${statLabel(echo.mainStat)} can't be the main stat of a ${echo.cost}-cost echo`)
  }
  if (!Number.isInteger(echo.level) || echo.level < 0 || echo.level > MAX_ECHO_LEVEL) {
    errors.push(`Level must be a whole number from 0 to ${MAX_ECHO_LEVEL}`)
  }

  // A substat unlocks every 5 levels
  const unlocked = Math.floor(echo.level / 5)
  if (echo.substats.length > unlocked) errors.push(`A +${echo.level} echo has at most ${unlocked} substats`)

  const seen = new Set<string>()
  for (const substat of echo.substats) {
    if (!(substat.stat in SUBSTAT_TIERS)) errors.push(`${statLabel(substat.stat)} isn't a substat`)
    else if (tierOf(substat.stat, substat.value) === undefined) errors.push(`${substat.value} isn't a possible ${statLabel(substat.stat)} roll`)
    if (seen.has(substat.stat)) errors.push(`${statLabel(substat.stat)} appears more than once`)
    seen.add(substat.stat)
  }
  return errors
}

export function validateLoadout(echoes: Echo[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const echo of echoes) {
    if (ids.has(echo.id)) errors.push('The same echo is equipped more than once')
    ids.add(echo.id)
  }
  if (echoes.length > MAX_LOADOUT_ECHOES) errors.push(`A character can wear at most ${MAX_LOADOUT_ECHOES} echoes`)
  const total = echoes.reduce((sum, echo) => sum + echo.cost, 0)
  if (total > MAX_LOADOUT_COST) errors.push(`Total echo cost is ${total}, the limit is ${MAX_LOADOUT_COST}`)
  return errors
}
