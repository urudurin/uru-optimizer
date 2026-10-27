import { AGENTS } from 'lib/games/zzz/data/agents'
import { parseImportedZzzPresets } from 'lib/games/zzz/data/importedPresets'
import {
  describe,
  expect,
  it,
} from 'vitest'

// Made-up test files, not copied from any guide
const agents = Object.values(AGENTS)

function importText(file: unknown, importedAt = '2026-10-25') {
  return parseImportedZzzPresets({ text: JSON.stringify(file), importedAt }, agents)
}

function file(presets: unknown[], extra: Record<string, unknown> = {}) {
  return { version: 1, game: 'zzz', source: 'My notes', updated: '2026-10-20', presets, ...extra }
}

describe('parseImportedZzzPresets', () => {
  it('reads a full entry, matching agents by name and sets by in-game name', () => {
    const result = importText(file([{
      character: 'miyabi',
      sets: [{ fourPiece: 'Branch & Blade Song', twoPiece: 'Woodpecker Electro' }, { fourPiece: 'woodpecker-electro' }],
      mainStats: { 4: ['CRIT Rate', 'CRIT_DMG'], 5: ['Element DMG%'], 6: ['ATK%'] },
      substatPriority: ['CRIT Rate', 'CRIT_DMG', 'ATK%'],
      rankBy: 'critRate',
      thenBy: ['critDmg'],
      notes: 'Test note',
    }]))

    expect(result.warnings).toEqual([])
    expect(result.source).toBe('My notes')
    expect(result.presets['1091']).toEqual({
      sets: [{ fourPiece: 'branch-blade-song', twoPiece: 'woodpecker-electro' }, { fourPiece: 'woodpecker-electro' }],
      mainStats: { 4: ['CRIT Rate', 'CRIT DMG'], 5: ['Element DMG%'], 6: ['ATK%'] },
      substatPriority: ['CRIT Rate', 'CRIT DMG', 'ATK%'],
      rankBy: 'critRate',
      thenBy: ['critDmg'],
      notes: 'Test note',
      source: 'My notes',
      confidence: 'sourced',
      reviewed: '2026-10-20',
    })
  })

  it('matches agents by id and falls back to the built-in ranking and the import date', () => {
    const result = importText(file([{ character: '1381' }], { updated: undefined }), '2026-10-24')
    const anby = result.presets['1381']

    expect(anby.rankBy).toBe('critDmg')
    expect(anby.thenBy).toEqual(['critRate', 'atk'])
    expect(anby.mainStats).toEqual({ 4: [], 5: [], 6: [] })
    expect(anby.reviewed).toBe('2026-10-24')
  })

  it('skips what it cannot use and says why', () => {
    const result = importText(file([
      { character: 'Someone Unknown' },
      'not an object',
      {
        character: 'Yixuan',
        sets: [{ twoPiece: 'Yunkui Tales' }, { fourPiece: 'Phaethons Melody' }],
        mainStats: { 4: ['Impact'], 6: ['HP%'] },
        substatPriority: ['Luck'],
        rankBy: 'damage',
        thenBy: ['critDmg', 'vibes'],
      },
    ]))

    expect(result.warnings).toEqual([
      'Preset 1: no agent data for "Someone Unknown" yet, skipped',
      'Preset 2: not an object, skipped',
      'Yixuan: a set choice has no "fourPiece", skipped',
      'Yixuan: "Impact" can\'t be a slot 4 main stat, skipped',
      'Yixuan: unknown substat "Luck", skipped',
      'Yixuan: can\'t rank by "damage", using sheerForce',
      'Yixuan: some "thenBy" stats aren\'t known and were skipped',
    ])
    expect(result.presets['1371'].sets).toEqual([{ fourPiece: 'phaethons-melody' }])
    expect(result.presets['1371'].mainStats[6]).toEqual(['HP%'])
    expect(result.presets['1371'].thenBy).toEqual(['critDmg'])
  })

  it('rejects files that are not ZZZ preset files', () => {
    expect(parseImportedZzzPresets({ text: 'nope', importedAt: '2026-10-25' }, agents).warnings).toEqual(['The file isn\'t valid JSON'])
    expect(importText({ ...file([]), game: 'wuwa' }).warnings).toEqual(['This file is for "wuwa", not "zzz"'])
    expect(importText({ ...file([]), version: 2 }).warnings).toEqual(['Expected "version": 1'])
    expect(importText({ version: 1, game: 'zzz' }).warnings).toEqual(['Expected a "presets" list'])
  })

  it('warns about a bad updated date and uses the import date', () => {
    const result = importText(file([{ character: 'Miyabi' }], { updated: 'last week' }))

    expect(result.warnings).toEqual(['"updated" should be a date like 2026-10-25, the import date is used instead'])
    expect(result.presets['1091'].reviewed).toBe('2026-10-25')
  })
})
