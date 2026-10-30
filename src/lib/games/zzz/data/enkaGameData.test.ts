import { MIYABI } from 'lib/games/zzz/data/agents'
import {
  agentFromEnka,
  wEngineFromEnka,
} from 'lib/games/zzz/data/enkaGameData'
import { HAILSTORM_SHRINE } from 'lib/games/zzz/data/wEngines'
import { ZzzStats } from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

// Miyabi's and Hailstorm Shrine's entries from Enka's store files (avatars.json, weapons.json), trimmed to what's read
const MIYABI_ENTRY = {
  ProfessionType: 'Anomaly',
  ElementTypes: ['FireFrost', 'Ice'],
  BaseProps: { 11101: 617, 12101: 127, 12201: 86, 13101: 49, 20101: 500, 21101: 5000, 30501: 120, 31201: 148, 31401: 116 },
  GrowthProps: { 11101: 837238, 12101: 76728, 13101: 66203 },
  PromotionProps: [
    { 11101: 0, 12101: 0, 13101: 0 },
    { 11101: 423, 12101: 45, 13101: 33 },
    { 11101: 847, 12101: 90, 13101: 67 },
    { 11101: 1270, 12101: 136, 13101: 100 },
    { 11101: 1694, 12101: 181, 13101: 134 },
    { 11101: 2117, 12101: 226, 13101: 167 },
  ],
  CoreEnhancementProps: [
    { 12101: 0, 31201: 0 },
    { 12101: 0, 31201: 30 },
    { 12101: 25, 31201: 30 },
    { 12101: 25, 31201: 60 },
    { 12101: 50, 31201: 60 },
    { 12101: 50, 31201: 90 },
    { 12101: 75, 31201: 90 },
  ],
}

describe('ZZZ game data from Enka', () => {
  it('gives Miyabi the base stats her stat screen confirmed', () => {
    const miyabi = agentFromEnka('1091', MIYABI_ENTRY, 'Miyabi')
    expect(miyabi.base).toEqual(MIYABI.base)
    expect(miyabi).toMatchObject({ element: 'Ice', specialty: 'Anomaly', level: 60 })
  })

  it('gives Banyue, Manato and Yidhari Sheer Force from HP, other Rupture agents none', () => {
    const rupture = { ...MIYABI_ENTRY, ProfessionType: 'Rupture' }
    expect(agentFromEnka('1471', rupture, 'Banyue').sheerForce).toEqual({ fromAtk: 0.3, fromHp: 0.1 })
    expect(agentFromEnka('9999', rupture, 'Someone').sheerForce).toEqual({ fromAtk: 0.3, fromHp: 0 })
  })

  it('gives Hailstorm Shrine its level 60 base ATK and CRIT Rate', () => {
    const engine = wEngineFromEnka(
      '14109',
      { Rarity: 4, ProfessionType: 'Anomaly', MainStat: { PropertyId: 12101, PropertyValue: 50 }, SecondaryStat: { PropertyId: 20103, PropertyValue: 960 } },
      'Hailstorm Shrine',
    )
    expect(engine).toMatchObject({ rarity: 'S', baseAtk: HAILSTORM_SHRINE.baseAtk, subStat: { stat: ZzzStats.CRIT_RATE, value: 24 } })
    expect(engine?.passive(1)).toEqual([])
  })
})
