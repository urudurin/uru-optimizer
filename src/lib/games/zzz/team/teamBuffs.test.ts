import {
  AGENTS,
  MIYABI,
} from 'lib/games/zzz/data/agents'
import { HAILSTORM_SHRINE } from 'lib/games/zzz/data/wEngines'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  computeStats,
  statScreenConditions,
} from 'lib/games/zzz/stats/computeStats'
import { zzzTeamBuffsFor } from 'lib/games/zzz/team/teamBuffs'
import {
  type Disc,
  ZzzStats,
} from 'lib/games/zzz/types'
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest'

// Astra Yao and Soukaku stand-ins: Miyabi's numbers under their ids, enough to have a stat screen
const ASTRA = '1311'
const SOUKAKU = '1131'

const build = (agentId: string, name: string, mindscapeLevel = 0, discIds: ImportedBuild['discIds'] = {}): ImportedBuild => ({
  id: `b-${agentId}`,
  agentId,
  name,
  element: 'Ice',
  specialty: 'Support',
  level: 60,
  mindscapeLevel,
  wEngineId: HAILSTORM_SHRINE.id,
  wEngineRefinement: 1,
  discIds,
})

const swingJazz = (id: string, slot: Disc['slot']): Disc => ({
  id,
  slot,
  setId: 'swing-jazz',
  setName: 'Swing Jazz',
  rarity: 'S',
  level: 15,
  main: { stat: slot === 1 ? ZzzStats.HP : slot === 2 ? ZzzStats.ATK : ZzzStats.DEF, value: 0 },
  substats: [],
  locked: false,
})

describe('zzzTeamBuffsFor', () => {
  beforeAll(() => {
    AGENTS[ASTRA] = { ...MIYABI, id: ASTRA, name: 'Astra Yao', element: 'Ether', specialty: 'Support' }
    AGENTS[SOUKAKU] = { ...MIYABI, id: SOUKAKU, name: 'Soukaku', element: 'Ice', specialty: 'Support' }
  })
  afterAll(() => {
    delete AGENTS[ASTRA]
    delete AGENTS[SOUKAKU]
  })

  const discs = [swingJazz('s1', 1), swingJazz('s2', 2), swingJazz('s3', 3), { ...swingJazz('s4', 4), main: { stat: ZzzStats.ATK_P, value: 30 } }]
  const builds = [build(MIYABI.id, 'Miyabi'), build(ASTRA, 'Astra Yao', 0, { 1: 's1', 2: 's2', 3: 's3', 4: 's4' }), build(SOUKAKU, 'Soukaku')]

  it('gives Astra Yao\'s Idyllic Cadenza from her own ATK, capped at 1200, and her 4-piece', () => {
    const result = zzzTeamBuffsFor(MIYABI.id, { teammates: [ASTRA], settings: {} }, { builds, discs })
    const astraAtk = computeStats({
      agent: AGENTS[ASTRA],
      wEngine: HAILSTORM_SHRINE,
      wEngineRefinement: 1,
      coreSkillLevel: 6,
      discs,
      conditions: statScreenConditions(),
    }).stats.atk
    const byId = Object.fromEntries(result.applied.map((a) => [a.buff.id, a]))

    expect(byId['idyllic-atk'].value).toBeCloseTo(Math.min(1200, astraAtk * 0.35), 6)
    expect(byId['idyllic-crit-dmg'].value).toBe(25)
    expect(byId['idyllic-dmg'].value).toBe(20)
    expect(byId['swing-jazz'].counted).toBe(true)
    expect(result.effects.map((e) => e.stat)).toEqual([ZzzStats.ATK, ZzzStats.CRIT_DMG, ZzzStats.ELEMENT_DMG, ZzzStats.ELEMENT_DMG])
  })

  it('needs a third Ice or Section 6 member for Soukaku\'s Ice DMG, and respects toggles', () => {
    // Miyabi (Ice, Section 6) + Soukaku (Ice, Section 6): 4 counts, enough
    const withMiyabi = zzzTeamBuffsFor(MIYABI.id, { teammates: [SOUKAKU], settings: {} }, { builds, discs })
    expect(withMiyabi.applied.find((a) => a.buff.id === 'ability-ice-dmg')?.counted).toBe(true)

    // An Ether receiver doesn't get Ice DMG at all
    const forAstra = zzzTeamBuffsFor(ASTRA, { teammates: [SOUKAKU], settings: {} }, { builds, discs })
    expect(forAstra.applied.find((a) => a.buff.id === 'ability-ice-dmg')?.reason).toBe('Only for Ice agents')

    const off = zzzTeamBuffsFor(MIYABI.id, { teammates: [ASTRA], settings: { [`${ASTRA}:idyllic-crit-dmg`]: false } }, { builds, discs })
    expect(off.applied.find((a) => a.buff.id === 'idyllic-crit-dmg')).toMatchObject({ counted: false, reason: 'Turned off' })
  })

  it('adds team effects to the stat calculator', () => {
    const input = { agent: MIYABI, wEngine: HAILSTORM_SHRINE, wEngineRefinement: 1, coreSkillLevel: 6, discs: [], conditions: statScreenConditions() }
    const alone = computeStats(input).stats
    const buffed = computeStats({ ...input, teamEffects: [{ stat: ZzzStats.CRIT_DMG, value: 25, source: 'test', confidence: 'sourced' }] }).stats
    expect(buffed.critDmg - alone.critDmg).toBe(25)
  })
})
