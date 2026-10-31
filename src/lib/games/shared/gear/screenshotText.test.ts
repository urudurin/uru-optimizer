import type { GenshinImages } from 'lib/games/genshin/data/images'
import type { Artifact } from 'lib/games/genshin/types'
import { genshinArtifactKind } from 'lib/games/genshin/ui/artifactKind'
import {
  draftFromScreenshot,
  readNumber,
  readStatLine,
} from 'lib/games/shared/gear/screenshotText'
import { wuwaEchoKind } from 'lib/games/wuwa/ui/echoKind'
import type { ZzzImages } from 'lib/games/zzz/data/images'
import { ZzzStats } from 'lib/games/zzz/types'
import { zzzDiscKind } from 'lib/games/zzz/ui/discKind'
import {
  describe,
  expect,
  it,
} from 'vitest'

// OCR text as Tesseract gives it for the games' gear screens, with its usual slips (bullets read as letters, O for 0)

describe('gear screenshots', () => {
  it('reads numbers and stat lines through common OCR slips', () => {
    expect(readNumber('4,78O')).toBe(4780)
    expect(readNumber('+3.9%')).toBe(3.9)
    const stats = [
      { value: 'atk', names: ['ATK'], percent: false },
      { value: 'atkPct', names: ['ATK'], percent: true },
      { value: 'critRate', names: ['CRIT Rate'], percent: true },
    ]
    expect(readStatLine('« ATK+5.8%', stats)).toEqual({ stat: 'atkPct', value: 5.8 })
    expect(readStatLine('· ATK+19', stats)).toEqual({ stat: 'atk', value: 19 })
    // ZZZ's upgrade count before the value
    expect(readStatLine('CRIT Rate +2 7.2%', stats)).toEqual({ stat: 'critRate', value: 7.2 })
    expect(readStatLine('Attack the target', stats)).toBeUndefined()
  })

  it('fills a Genshin artifact', () => {
    const artifact = { setId: 'GladiatorsFinale', setName: 'Gladiator\'s Finale' } as Artifact
    const kind = genshinArtifactKind({ characters: [], images: { artifacts: {} } as unknown as GenshinImages, artifacts: [artifact] })
    const lines = [
      'Gladiator\'s Nostalgia',
      'Flower of Life',
      'HP',
      '4,780',
      '+20',
      '« CRIT Rate+3.9%',
      '« CRIT DMG+21.8%',
      '« ATK+5.8%',
      '« Elemental Mastery+19',
      'Gladiator\'s Finale:',
      '2-Piece Set: ATK +18%.',
      '4-Piece Set: If the wielder of this artifact uses a Sword, Claymore or Polearm, increases their Normal Attack DMG by 35%.',
    ]
    const { draft, missed } = draftFromScreenshot(lines, kind.screenshot!, { ...kind.newDraft(), slot: 'circlet', level: 0 })
    expect(missed).toEqual([])
    expect(draft).toMatchObject({ slot: 'flower', setId: 'GladiatorsFinale', level: 20, mainStat: 'hp' })
    expect(draft.substats).toEqual([
      { stat: 'critRate', value: 3.9 },
      { stat: 'critDmg', value: 21.8 },
      { stat: 'atkPct', value: 5.8 },
      { stat: 'elementalMastery', value: 19 },
    ])
  })

  it('fills a Genshin artifact from the OCR of a real screenshot\'s panel', () => {
    const artifact = { setId: 'ScarletProof', setName: 'Scarlet Proof' } as Artifact
    const kind = genshinArtifactKind({ characters: [], images: { artifacts: {} } as unknown as GenshinImages, artifacts: [artifact] })
    // Tesseract's text for the user's Honor to Your Devotion screenshot (Oct 31 2026), cropped to the details panel
    const lines = [
      'Honor to Your',
      'Devotion',
      'Flower of Life (a)',
      'HP 4,780',
      'kkk',
      '+20',
      '~Energy Recharge+11.0%',
      '+ CRIT Rate+10.1%',
      '- CRIT DMG+14.8%',
      '+ Elemental Mastery+40',
      'Scarlet Proof:(4)',
      'v 2-Piece Set: ATK +18%.',
      '~ 4-Piece Set: Increases the',
      'equipping character\'s CRIT',
      'Rate by 16%, and their Stellar',
      'A bright red flower ornagent that',
    ]
    const { draft, missed } = draftFromScreenshot(lines, kind.screenshot!, { ...kind.newDraft(), slot: 'goblet', substats: [] })
    expect(missed).toEqual([])
    expect(draft).toMatchObject({ slot: 'flower', setId: 'ScarletProof', level: 20, mainStat: 'hp' })
    expect(draft.substats).toEqual([
      { stat: 'energyRecharge', value: 11 },
      { stat: 'critRate', value: 10.1 },
      { stat: 'critDmg', value: 14.8 },
      { stat: 'elementalMastery', value: 40 },
    ])
  })

  it('fills a ZZZ disc, substats as roll counts', () => {
    const kind = zzzDiscKind({ builds: [], images: { sets: {}, setNames: {} } as unknown as ZzzImages, discs: [] })
    const woodpecker = kind.sets().find((o) => o.label.startsWith('Woodpecker'))!
    const lines = [
      `${woodpecker.label} [4]`,
      'Lv. 15/15',
      'Main Stat',
      'CRIT Rate 24%',
      'Sub-Stats',
      'ATK% +1 6%',
      'CRIT DMG +2 14.4%',
      'PEN 9',
      'HP 112',
    ]
    const { draft } = draftFromScreenshot(lines, kind.screenshot!, kind.newDraft())
    expect(draft).toMatchObject({ slot: '4', setId: woodpecker.value, level: 15, mainStat: ZzzStats.CRIT_RATE })
    expect(draft.substats).toEqual([
      { stat: ZzzStats.ATK_P, value: 2 },
      { stat: ZzzStats.CRIT_DMG, value: 3 },
      { stat: ZzzStats.PEN, value: 1 },
      { stat: ZzzStats.HP, value: 1 },
    ])
  })

  it('fills a ZZZ disc from the OCR of a real screenshot\'s panel, ignoring stats named in the set bonus', () => {
    const kind = zzzDiscKind({ builds: [], images: { sets: {}, setNames: {} } as unknown as ZzzImages, discs: [] })
    // Tesseract's text for the user's Thorned Rose [1] screenshot (Oct 31 2026), cropped to the details panel
    const lines = [
      'Thorned Rose [1]',
      '© Lv.15/15 @®',
      'Main Stat',
      'HP 2,200',
      'Sub-Stats',
      'DEF 15',
      'CRIT Rate +2 7.2%',
      'DEF 4.8%',
      'CRIT DMG +2 14.4%',
      'Set Effect',
      'Thorned Rose',
      '2-Piece Set: DEF +16%',
      '4-Piece Set: The equipper\'s',
      'DMG increases by 15%.',
      'When the equipper\'s initial',
      'DEF is at least 1,000/1,800,',
      'CRIT Rate increases by',
      '8/16%.',
    ]
    const { draft, missed } = draftFromScreenshot(lines, kind.screenshot!, { ...kind.newDraft(), substats: [] })
    expect(missed).toEqual([])
    expect(draft).toMatchObject({ slot: '1', setId: 'thorned-rose', level: 15, mainStat: ZzzStats.HP })
    expect(draft.substats).toEqual([
      { stat: ZzzStats.DEF, value: 1 },
      { stat: ZzzStats.CRIT_RATE, value: 3 },
      { stat: ZzzStats.DEF_P, value: 1 },
      { stat: ZzzStats.CRIT_DMG, value: 3 },
    ])
    expect(kind.fromDraft(draft).errors).toEqual([])
  })

  it('fills a WuWa echo from the OCR of a real screenshot\'s panel, with a stat icon read as letters', () => {
    const kind = wuwaEchoKind({ characters: [] })
    // Tesseract's text for the user's Jade Nether Serpent screenshot (Oct 31 2026), cropped to the details panel
    const lines = [
      'Jade Nether Serpent +25 ®',
      'COST 1 % 8',
      'XK ATK 18.0%',
      '@ HP 2280',
      '+ Energy Regen 11.6%',
      '+ Crit. DMG 16.2%',
      '+ Resonance Skill DMG Bonus 7.1%',
      '+ ATK 8.6%',
      '+ Crit. Rate 6.3%',
      'Echo Skill',
      'Summon a Jade Nether',
      'Serpent to deal Fusion DMG to',
      'the target.',
      'Sonata Effect 8',
      'v\' Heart of Sworn Vigil & (2/2)',
      'Electro DMG+',
      '~ // Heart of Sworn Vigil & (5/5)',
      'Inflicting Electro Flare on the',
      'increases the Resonator\'s Crit.',
      'Rate and grants them Electro',
      'Remove',
    ]
    const { draft, missed } = draftFromScreenshot(lines, kind.screenshot!, { ...kind.newDraft(), substats: [] })
    expect(missed).toEqual([])
    expect(draft).toMatchObject({ slot: '1', setId: 'heart-of-sworn-vigil', level: 25, mainStat: 'atkPct', extra: { defId: 'jade-nether-serpent' } })
    expect(draft.substats).toEqual([
      { stat: 'energyRegen', value: 11.6 },
      { stat: 'critDmg', value: 16.2 },
      { stat: 'skillDmg', value: 7.1 },
      { stat: 'atkPct', value: 8.6 },
      { stat: 'critRate', value: 6.3 },
    ])
    expect(kind.fromDraft(draft).errors).toEqual([])
  })

  it('fills a WuWa echo, skipping its fixed flat stat and picking the echo by name', () => {
    const kind = wuwaEchoKind({ characters: [] })
    const set = kind.sets()[0]
    const base = kind.newDraft()
    const echo = kind.screenshot!.extra!.options({ ...base, slot: '4', setId: set.value })[0]
    const lines = [
      echo.label,
      'COST 4',
      '+25',
      'Crit. Rate 22.0%',
      'ATK 150',
      'Crit. DMG 13.8%',
      'ATK 8.5%',
      'Energy Regen 9.2%',
      'HP 470',
      'Basic Attack DMG Bonus 8.6%',
      set.label,
    ]
    const { draft, missed } = draftFromScreenshot(lines, kind.screenshot!, { ...base, slot: '1' })
    expect(missed).toEqual([])
    expect(draft).toMatchObject({ slot: '4', setId: set.value, level: 25, mainStat: 'critRate', extra: { defId: echo.value } })
    expect(draft.substats.map((s) => s.stat)).toEqual(['critDmg', 'atkPct', 'energyRegen', 'hpFlat', 'basicDmg'])
    expect(draft.substats[0].value).toBe(13.8)
  })
})
