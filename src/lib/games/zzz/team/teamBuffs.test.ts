import {
  AGENTS,
  MIYABI,
  YIXUAN,
} from 'lib/games/zzz/data/agents'
import {
  HAILSTORM_SHRINE,
  W_ENGINES,
} from 'lib/games/zzz/data/wEngines'
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

  it('leaves out a teammate\'s squad set when the agent wears the same 4-piece', () => {
    const same = zzzTeamBuffsFor(MIYABI.id, { teammates: [ASTRA], settings: {} }, { builds, discs }, 'swing-jazz')
    expect(same.applied.find((a) => a.buff.id === 'swing-jazz')).toMatchObject({ counted: false, reason: 'Doesn\'t stack with the same set on this agent' })
    const other = zzzTeamBuffsFor(MIYABI.id, { teammates: [ASTRA], settings: {} }, { builds, discs }, 'woodpecker-electro')
    expect(other.applied.find((a) => a.buff.id === 'swing-jazz')?.counted).toBe(true)
  })

  it('adds team effects to the stat calculator', () => {
    const input = { agent: MIYABI, wEngine: HAILSTORM_SHRINE, wEngineRefinement: 1, coreSkillLevel: 6, discs: [], conditions: statScreenConditions() }
    const alone = computeStats(input).stats
    const buffed = computeStats({ ...input, teamEffects: [{ stat: ZzzStats.CRIT_DMG, value: 25, source: 'test', confidence: 'sourced' }] }).stats
    expect(buffed.critDmg - alone.critDmg).toBe(25)
  })

  it('Remielle: squad ATK by Anomaly agents in the squad, and Refringe on the receiver\'s anomalies', () => {
    const REMIELLE = '1581'
    AGENTS[REMIELLE] = { ...MIYABI, id: REMIELLE, name: 'Remielle', element: 'Lumiflux', specialty: 'Anomaly' }
    try {
      const withRemielle = [...builds, build(REMIELLE, 'Remielle')]
      const result = zzzTeamBuffsFor(MIYABI.id, { teammates: [REMIELLE], settings: {} }, { builds: withRemielle, discs })
      const giver = computeStats({
        agent: AGENTS[REMIELLE],
        wEngine: HAILSTORM_SHRINE,
        wEngineRefinement: 1,
        coreSkillLevel: 6,
        discs: [],
        conditions: statScreenConditions(),
      }).stats
      // Miyabi and Remielle: 2 Anomaly agents, 12% of her initial ATK
      expect(result.applied.find((a) => a.buff.id === 'remielle-squad-atk')?.value).toBeCloseTo(giver.atk * 0.12, 6)
      // Refringe: 0.02% of her Anomaly Proficiency as a multiplier on attribute anomalies, rotation damage only
      expect(result.anomalyBonus).toEqual({ anomaly: { buff: expect.closeTo(0.02 * giver.anomalyProficiency, 6) } })
      expect(result.effects.map((e) => e.stat)).toEqual([ZzzStats.ATK])
    } finally {
      delete AGENTS[REMIELLE]
    }
  })

  it('adds up stun multiplier bonuses from different teammates (Nangong Yu\'s Misstep, Norma\'s Tech Divide)', () => {
    const NANGONG = '1511'
    const NORMA = '1571'
    AGENTS[NANGONG] = { ...MIYABI, id: NANGONG, name: 'Nangong Yu', element: 'Ether', specialty: 'Stun' }
    AGENTS[NORMA] = { ...MIYABI, id: NORMA, name: 'Norma', element: 'Fire', specialty: 'Stun' }
    try {
      const both = [...builds, build(NANGONG, 'Nangong Yu'), build(NORMA, 'Norma')]
      const result = zzzTeamBuffsFor(MIYABI.id, { teammates: [NANGONG, NORMA], settings: {} }, { builds: both, discs })
      expect(result.debuffs.stunBonus).toBe(60)
      // Squad DMG from both: Nangong Yu +25%, Norma +20%
      expect(result.effects.filter((e) => e.stat === ZzzStats.ELEMENT_DMG).map((e) => e.value).sort()).toEqual([20, 25])
    } finally {
      delete AGENTS[NANGONG]
      delete AGENTS[NORMA]
    }
  })

  it('counts a teammate\'s W-Engine at their refinement and specialty, and Aftershock DMG for rotation damage only', () => {
    // Dreamlit Hearth (Support) and Pulchra stand-ins
    const DREAMLIT = '14145'
    const PULCHRA = '1351'
    W_ENGINES[DREAMLIT] = { ...HAILSTORM_SHRINE, id: DREAMLIT, name: 'Dreamlit Hearth', specialty: 'Support' }
    AGENTS[PULCHRA] = { ...MIYABI, id: PULCHRA, name: 'Pulchra', element: 'Physical', specialty: 'Stun' }
    try {
      const withEngine = [...builds.filter((b) => b.agentId !== ASTRA), { ...build(ASTRA, 'Astra Yao'), wEngineId: DREAMLIT, wEngineRefinement: 5 }]
      const result = zzzTeamBuffsFor(MIYABI.id, { teammates: [ASTRA], settings: {} }, { builds: withEngine, discs })
      expect(result.applied.find((a) => a.buff.id === 'dmg' && a.sourceName === 'Astra Yao\'s W-Engine')).toMatchObject({ value: 40, counted: true })

      // A Stun agent wearing it gives nothing
      AGENTS[ASTRA] = { ...AGENTS[ASTRA], specialty: 'Stun' }
      const stun = zzzTeamBuffsFor(MIYABI.id, { teammates: [ASTRA], settings: {} }, { builds: withEngine, discs })
      expect(stun.applied.find((a) => a.buff.id === 'dmg')?.reason).toBe('Only when a Support agent wears it')
      AGENTS[ASTRA] = { ...AGENTS[ASTRA], specialty: 'Support' }

      const pulchra = zzzTeamBuffsFor(MIYABI.id, { teammates: [PULCHRA], settings: {} }, { builds: [...builds, build(PULCHRA, 'Pulchra')], discs })
      expect(pulchra.kindBonus).toEqual({ aftershock: 30 })
      expect(pulchra.effects).toEqual([])
    } finally {
      delete W_ENGINES[DREAMLIT]
      delete AGENTS[PULCHRA]
    }
  })
  it('genshin-optimizer givers: Ju Fufu\'s Chain Attack and Ultimate DMG, Lighter only for Fire and Ice, Roxy\'s Contamination', () => {
    const JUFUFU = '1391'
    const LIGHTER = '1161'
    const ROXY = '1621'
    AGENTS[JUFUFU] = { ...MIYABI, id: JUFUFU, name: 'Ju Fufu', element: 'Fire', specialty: 'Stun' }
    AGENTS[LIGHTER] = { ...MIYABI, id: LIGHTER, name: 'Lighter', element: 'Fire', specialty: 'Stun' }
    AGENTS[ROXY] = { ...MIYABI, id: ROXY, name: 'Roxy', element: 'Wind', specialty: 'Stun' }
    try {
      const squad = [...builds, build(JUFUFU, 'Ju Fufu'), build(LIGHTER, 'Lighter'), build(ROXY, 'Roxy')]
      const jufufu = zzzTeamBuffsFor(MIYABI.id, { teammates: [JUFUFU], settings: {} }, { builds: squad, discs })
      expect(jufufu.kindBonus).toEqual({ chain: 20, ult: 40 })
      expect(jufufu.debuffs.stunBonus).toBe(0)

      // Miyabi is Ice: Lighter's RES shred counts; an Ether receiver gets nothing
      const lighter = zzzTeamBuffsFor(MIYABI.id, { teammates: [LIGHTER], settings: {} }, { builds: squad, discs })
      expect(lighter.debuffs.resShred).toBe(15)
      const forAstra = zzzTeamBuffsFor(ASTRA, { teammates: [LIGHTER], settings: {} }, { builds: squad, discs })
      expect(forAstra.applied.find((a) => a.buff.id === 'lighter-res')?.reason).toBe('Only for Fire and Ice agents')

      const giver =
        computeStats({ agent: AGENTS[ROXY], wEngine: HAILSTORM_SHRINE, wEngineRefinement: 1, coreSkillLevel: 6, discs: [], conditions: statScreenConditions() })
          .stats
      const roxy = zzzTeamBuffsFor(MIYABI.id, { teammates: [ROXY], settings: {} }, { builds: squad, discs })
      expect(roxy.applied.find((a) => a.buff.id === 'roxy-contamination')?.value).toBeCloseTo(Math.min(40, 0.4 * giver.critRate), 6)
      // Her stun bonus needs an Attack, Rupture or Armorer agent: Miyabi is Anomaly
      expect(roxy.debuffs.stunBonus).toBe(0)
    } finally {
      delete AGENTS[JUFUFU]
      delete AGENTS[LIGHTER]
      delete AGENTS[ROXY]
    }
  })
  it('Pan Yinhu\'s Sheer Force reaches a Rupture agent\'s stat calculator', () => {
    const PAN = '1421'
    AGENTS[PAN] = { ...MIYABI, id: PAN, name: 'Pan Yinhu', element: 'Physical', specialty: 'Defense' }
    try {
      const squad = [...builds, build(PAN, 'Pan Yinhu'), build(YIXUAN.id, 'Yixuan')]
      const giver =
        computeStats({ agent: AGENTS[PAN], wEngine: HAILSTORM_SHRINE, wEngineRefinement: 1, coreSkillLevel: 6, discs: [], conditions: statScreenConditions() })
          .stats
      const result = zzzTeamBuffsFor(YIXUAN.id, { teammates: [PAN], settings: {} }, { builds: squad, discs })
      const given = Math.min(540, giver.atk * 0.18)
      expect(result.effects.find((e) => e.stat === ZzzStats.SHEER_FORCE_FLAT)?.value).toBeCloseTo(given, 6)
      const input = { agent: YIXUAN, wEngine: HAILSTORM_SHRINE, wEngineRefinement: 1, coreSkillLevel: 6, discs: [], conditions: statScreenConditions() }
      expect(computeStats({ ...input, teamEffects: result.effects }).stats.sheerForce - computeStats(input).stats.sheerForce).toBeCloseTo(given, 6)
    } finally {
      delete AGENTS[PAN]
    }
  })
})
