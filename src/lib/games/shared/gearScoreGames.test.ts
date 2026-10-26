import {
  genshinArtifactWeights,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import {
  scoreEcho,
  wuwaEchoWeights,
} from 'lib/games/wuwa/stats/echoScore'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'
import { MIYABI } from 'lib/games/zzz/data/agents'
import {
  scoreDisc,
  zzzDiscWeights,
} from 'lib/games/zzz/stats/discScore'
import type { Disc } from 'lib/games/zzz/types'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('gear scores per game', () => {
  it('ZZZ: discs follow the agent\'s preset substat priority, S-rank only', () => {
    const weights = zzzDiscWeights(MIYABI)
    const disc = (substats: Disc['substats'], rarity: Disc['rarity'] = 'S'): Disc => ({
      id: 'd',
      slot: 1,
      setId: 'x',
      setName: 'X',
      rarity,
      level: 15,
      main: { stat: 'HP', value: 2200 },
      substats,
      locked: false,
    })
    const crit = scoreDisc(
      disc([{ stat: 'CRIT Rate', rolls: 4 }, { stat: 'CRIT DMG', rolls: 3 }, { stat: 'ATK%', rolls: 1 }, { stat: 'DEF', rolls: 1 }]),
      weights,
    )
    const junk = scoreDisc(disc([{ stat: 'DEF', rolls: 4 }, { stat: 'HP%', rolls: 3 }, { stat: 'DEF%', rolls: 1 }, { stat: 'HP', rolls: 1 }]), weights)

    expect(crit!.percent).toBeGreaterThan(60)
    expect(junk?.percent ?? 0).toBeLessThan(crit!.percent)
    expect(scoreDisc(disc([{ stat: 'CRIT Rate', rolls: 6 }], 'A'), weights)).toBeUndefined()
  })

  it('Genshin: weights follow the target, so crit beats DEF for Crit Value', () => {
    const venti: GenshinCharacter = { id: 'Venti', name: 'Venti', level: 90, ascension: 6, constellation: 0, artifactIds: {}, stats: {}, statsDate: '' }
    const weights = genshinArtifactWeights(venti, [], { kind: 'critValue' })
    const artifact = (substats: Artifact['substats']): Artifact => ({
      id: 'a',
      slot: 'flower',
      setId: 'x',
      setName: 'X',
      rarity: 5,
      level: 20,
      main: { stat: 'hp', value: 4780 },
      substats,
    })
    const crit = scoreArtifact(artifact([{ stat: 'critRate', value: 3.89 * 4, rolls: 4 }, { stat: 'critDmg', value: 7.77 * 3, rolls: 3 }]), weights)
    const def = scoreArtifact(artifact([{ stat: 'def', value: 23.15 * 4, rolls: 4 }, { stat: 'defPct', value: 7.29 * 3, rolls: 3 }]), weights)

    expect(weights).toMatchObject({ critRate: 1, critDmg: 1, def: 0 })
    // Only the 2 crit stats count for Crit Value, so the best artifact has them plus 5 upgrades: 7 top rolls, all here
    expect(crit?.percent).toBe(100)
    expect(crit?.rating).toBe('WTF+')
    expect(def?.rating ?? '?').toBe('?')
  })

  it('WuWa: an echo with the wanted stats at top rolls scores 100', () => {
    const hsin: CharacterState = {
      charId: 'hsin',
      level: 90,
      sequence: 0,
      weaponId: 'blooming-jadehaven',
      weaponLevel: 90,
      refinement: 1,
      minorFortes: true,
      echoIds: [],
    }
    const weights = wuwaEchoWeights(hsin, [], { kind: 'critValue' })
    const echo: Echo = {
      id: 'e',
      defId: 'd',
      cost: 4,
      setId: 's',
      mainStat: 'critRate',
      level: 25,
      substats: [
        { stat: 'critRate', value: 10.5 },
        { stat: 'critDmg', value: 21 },
      ],
    }
    // Only two stats matter for Crit Value, so the best echo is those two at top rolls
    expect(scoreEcho(echo, weights)).toEqual({ percent: 100, rating: 'WTF+' })
  })
})
