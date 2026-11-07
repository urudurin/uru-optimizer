// Stat simulation, after HSR's optimizer (lib/tabs/tabOptimizer/optimizerForm/components/StatSimulationDisplay.tsx, its
// substat roll count mode): a build's pieces keep their sets and main stats, and their substats are replaced by a number
// of average rolls of each substat. Like the DPS score (shared/damageScore.ts), the swap is extra stats on top of the
// real build: rolls x one roll, less the substats it has. Saved per character with the optimizer settings.

export type StatSimulation = {
  id: string,
  name: string,
  // The pieces whose sets and main stats it keeps
  pieceIds: string[],
  // Rolls per substat
  rolls: Record<string, number>,
}

// What one game's simulation needs: its substats, and one roll of each (an average roll; ZZZ rolls are exact)
export type SimulationRolls = {
  stats: string[],
  roll: (stat: string) => number,
}

// A build's substats added up
export function substatTotals(substats: { stat: string, value: number }[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const sub of substats) totals[sub.stat] = (totals[sub.stat] ?? 0) + sub.value
  return totals
}

// The extra stats that turn the build's own substat totals into these rolls
export function simulationExtra(model: SimulationRolls, actual: Record<string, number>, rolls: Record<string, number>): Record<string, number> {
  const extra: Record<string, number> = {}
  for (const stat of new Set([...model.stats, ...Object.keys(actual)])) {
    const value = (model.stats.includes(stat) ? (rolls[stat] ?? 0) * model.roll(stat) : 0) - (actual[stat] ?? 0)
    if (value !== 0) extra[stat] = value
  }
  return extra
}

// The build's substats as roll counts (one decimal), to start a simulation from a real build
export function rollsFromTotals(model: SimulationRolls, actual: Record<string, number>): Record<string, number> {
  const rolls: Record<string, number> = {}
  for (const stat of model.stats) {
    const roll = model.roll(stat)
    const count = roll > 0 ? Math.round(((actual[stat] ?? 0) / roll) * 10) / 10 : 0
    if (count > 0) rolls[stat] = count
  }
  return rolls
}

let simulationCounter = 0

export function newSimulation(name: string, pieceIds: string[], rolls: Record<string, number>): StatSimulation {
  simulationCounter++
  return { id: `sim-${Date.now()}-${simulationCounter}`, name, pieceIds, rolls }
}
