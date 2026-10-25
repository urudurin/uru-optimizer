import { AGENTS } from 'lib/games/zzz/data/agents'
import {
  type BuildPreset,
  getPreset,
  needsReview,
  PRESETS,
  REVIEW_INTERVAL_DAYS,
} from 'lib/games/zzz/data/presets'
import { SETS } from 'lib/games/zzz/data/sets'
import { MAIN_STATS_BY_SLOT } from 'lib/games/zzz/discStats'
import type { MainStatSlot } from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('presets', () => {
  it('has a preset for every agent with data', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(Object.keys(AGENTS).sort())
  })

  it('only uses sets that have set data', () => {
    for (const preset of Object.values(PRESETS)) {
      for (const choice of preset.sets) {
        expect(SETS[choice.fourPiece], choice.fourPiece).toBeDefined()
        expect(SETS[choice.twoPiece], choice.twoPiece).toBeDefined()
      }
    }
  })

  it('only uses main stats each slot can roll', () => {
    for (const [agentId, preset] of Object.entries(PRESETS)) {
      for (const slot of [4, 5, 6] as MainStatSlot[]) {
        expect(preset.mainStats[slot].length, `${agentId} slot ${slot}`).toBeGreaterThan(0)
        for (const stat of preset.mainStats[slot]) expect(MAIN_STATS_BY_SLOT[slot], `${agentId} slot ${slot}`).toContain(stat)
      }
    }
  })

  it('has a readable review date on every preset', () => {
    for (const preset of Object.values(PRESETS)) expect(Number.isNaN(Date.parse(preset.reviewed))).toBe(false)
  })

  it('falls back to a generic preset for the specialty', () => {
    const newAgent = { ...AGENTS['1381'], id: '9999', name: 'Someone New', specialty: 'Anomaly' as const }
    const preset = getPreset(newAgent)

    expect(preset.sets).toEqual([])
    expect(preset.rankBy).toBe('anomalyProficiency')
    expect(preset.mainStats[4]).toEqual(['Anomaly Proficiency'])
    expect(preset.notes).toBe('No preset for Someone New yet, this is a generic Anomaly starting point')
  })

  it(`asks for a review after ${REVIEW_INTERVAL_DAYS} days`, () => {
    const preset = { reviewed: '2026-10-25' } as BuildPreset

    expect(needsReview(preset, new Date(2026, 10, 14))).toBe(false)
    expect(needsReview(preset, new Date(2026, 10, 15))).toBe(true)
    expect(needsReview({ reviewed: 'not a date' } as BuildPreset, new Date(2026, 10, 1))).toBe(true)
  })
})
