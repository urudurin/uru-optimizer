// Build analysis shared by the optimizers, after HSR's substat upgrades panel: what one more average roll of each
// substat would add to the score the build is ranked by. Each game works out the scores, this ranks them.

export type SubstatUpgrade = {
  stat: string,
  label: string,
  // What the roll adds to the stat
  roll: number,
  // What it adds to the score, and as a percent of the build's score
  gain: number,
  percent: number,
}

export function rankUpgrades(baseScore: number, options: { stat: string, label: string, roll: number, score: number }[]): SubstatUpgrade[] {
  return options
    .map(({ stat, label, roll, score }) => {
      const gain = score - baseScore
      return { stat, label, roll, gain, percent: baseScore > 0 ? (gain / baseScore) * 100 : 0 }
    })
    .sort((a, b) => b.gain - a.gain)
}
