import {
  GENSHIN_EXTRA_BUFFS,
  withGenshinExtraBuffs,
  withGenshinExtraDebuffs,
} from 'lib/games/genshin/team/extraBuffs'
import {
  addExtraStats,
  extraBuffsSummary,
  setExtraBuff,
} from 'lib/games/shared/extraBuffs'
import {
  withWuwaExtraBuffs,
  wuwaExtraEnemy,
} from 'lib/games/wuwa/team/extraBuffs'
import { NO_DEBUFFS } from 'lib/games/zzz/damage/damage'
import {
  withZzzExtraDebuffs,
  zzzExtraEffects,
} from 'lib/games/zzz/team/extraBuffs'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('extra combat buffs', () => {
  it('keeps only set values and summarises them', () => {
    const buffs = setExtraBuff(setExtraBuff({}, 'atkPct', 20), 'critRate', 10)
    expect(setExtraBuff(buffs, 'critRate', 0)).toEqual({ atkPct: 20 })
    expect(extraBuffsSummary(GENSHIN_EXTRA_BUFFS, buffs)).toBe('+20 ATK %, +10 CRIT Rate %')
    expect(extraBuffsSummary(GENSHIN_EXTRA_BUFFS, {})).toBe('No extra buffs')
    expect(addExtraStats({ atkPct: 5 }, { atkPct: 20, defShred: 30 }, ['atkPct'])).toEqual({ atkPct: 25 })
  })

  it('Genshin: stats join the premod team buffs, shred joins the debuffs', () => {
    const buffs = { atkPct: 20, critDmg: 40, defShred: 30, resShred: 20 }
    expect(withGenshinExtraBuffs({ premod: { atkPct: 20 }, total: { atk: 100 } }, buffs)).toEqual({ premod: { atkPct: 40, critDmg: 40 }, total: { atk: 100 } })
    expect(withGenshinExtraDebuffs({ defShred: 15, resShred: { Pyro: 40 } }, buffs)).toEqual({ defShred: 45, resShred: { Pyro: 40, all: 20 } })
  })

  it('ZZZ: stats become always-on effects, shred and DMG taken join the debuffs', () => {
    const buffs = { 'ATK%': 12, 'CRIT DMG': 30, 'defShred': 25, 'dmgTaken': 10 }
    expect(zzzExtraEffects(buffs).map((e) => [e.stat, e.value])).toEqual([['ATK%', 12], ['CRIT DMG', 30]])
    expect(withZzzExtraDebuffs(NO_DEBUFFS, buffs)).toEqual({ defShred: 25, resShred: 0, dmgTaken: 10, stunBonus: 0 })
  })

  it('WuWa: DMG Bonus goes to the Resonator\'s element, the rest to the setup', () => {
    const buffs = { atkPct: 10, elementDmg: 20, amplify: 15, resShred: 10 }
    expect(withWuwaExtraBuffs({ atkPct: 5 }, buffs, 'spectroDmg')).toEqual({ atkPct: 15, spectroDmg: 20 })
    expect(wuwaExtraEnemy(buffs)).toEqual({ amplify: 15, defIgnore: 0, resShred: 10 })
  })
})
