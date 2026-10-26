import {
  idealUnits,
  ratingFor,
  scoreBuild,
  scoreGear,
  weightsFromPriority,
  weightsFromUpgrades,
} from 'lib/games/shared/gearScore'
import {
  describe,
  expect,
  it,
} from 'vitest'

const rules = { substats: 4, upgrades: 5, substatCanMatchMain: false }
const crit = { critRate: 1, critDmg: 1, atkPct: 0.5, atk: 0.2 }

describe('gear score', () => {
  it('grades like HSR, 5% a grade', () => {
    expect([0, 4.9, 5, 44.9, 45, 79.9, 80, 85, 99].map(ratingFor)).toEqual(['?', 'F', 'F+', 'A', 'A+', 'SSS+', 'WTF', 'WTF+', 'WTF+'])
  })

  it('compares the substats with the best piece for the character', () => {
    // Best: the 4 wanted substats once each, then 5 upgrades on a crit stat
    expect(idealUnits(crit, 'hp', rules)).toBeCloseTo(1 + 1 + 0.5 + 0.2 + 5)
    // Without the main stat as a substat
    expect(idealUnits(crit, 'critRate', rules)).toBeCloseTo(1 + 0.5 + 0.2 + 5)

    const perfect = scoreGear(
      [{ stat: 'critRate', units: 6 }, { stat: 'critDmg', units: 1 }, { stat: 'atkPct', units: 1 }, { stat: 'atk', units: 1 }],
      'hp',
      crit,
      rules,
    )
    expect(perfect).toEqual({ percent: 100, rating: 'WTF+' })
    const half = scoreGear([{ stat: 'critRate', units: 3 }, { stat: 'critDmg', units: 0.85 }, { stat: 'def', units: 4 }], 'hp', crit, rules)
    expect(half?.percent).toBe(50)
    expect(half?.rating).toBe('S')
    expect(scoreGear([], 'hp', {}, rules)).toBeUndefined()
  })

  it('scores a whole build as the average of its pieces, empty slots counting as 0', () => {
    const piece = (percent: number) => ({ percent, rating: ratingFor(percent) })
    expect(scoreBuild([piece(80), piece(60), piece(70), piece(50), piece(40)], 5)).toEqual({ percent: 60, rating: 'SS' })
    expect(scoreBuild([piece(80), undefined, piece(70)], 6)).toEqual({ percent: 25, rating: 'C+' })
    expect(scoreBuild([undefined], 5)).toBeUndefined()
  })

  it('makes weights from build-analysis gains or a priority list', () => {
    const upgrades = [
      { stat: 'critRate', label: '', roll: 1, gain: 50, percent: 0 },
      { stat: 'atkPct', label: '', roll: 1, gain: 25, percent: 0 },
      { stat: 'def', label: '', roll: 1, gain: 1, percent: 0 },
    ]
    expect(weightsFromUpgrades(upgrades)).toEqual({ critRate: 1, atkPct: 0.5, def: 0 })
    expect(weightsFromPriority(['CRIT Rate', 'CRIT DMG', 'ATK%'])).toEqual({ 'CRIT Rate': 1, 'CRIT DMG': 0.8, 'ATK%': 0.6 })
  })
})
