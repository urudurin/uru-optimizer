import {
  deleteGenshinArtifacts,
  saveGenshinArtifact,
} from 'lib/games/genshin/state/genshinState'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import {
  deleteWuwaEchoes,
  saveWuwaEcho,
} from 'lib/games/wuwa/state/wuwaState'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'
import { wuwaEchoKind } from 'lib/games/wuwa/ui/echoKind'
import type { ZzzImages } from 'lib/games/zzz/data/images'
import {
  deleteZzzDiscs,
  saveZzzDisc,
} from 'lib/games/zzz/state/zzzState'
import type { Disc } from 'lib/games/zzz/types'
import {
  sMainValue,
  zzzDiscKind,
} from 'lib/games/zzz/ui/discKind'
import {
  describe,
  expect,
  it,
} from 'vitest'

// Adding, editing and deleting gear by hand (shared/ui/gear), for each game's save and editor rules

const disc = (id: string, slot: Disc['slot'], equippedBy?: string): Disc => ({
  id,
  slot,
  setId: 'woodpecker-electro',
  setName: 'Woodpecker Electro',
  rarity: 'S',
  level: 15,
  main: { stat: 'HP', value: 2200 },
  substats: [],
  locked: false,
  ...(equippedBy ? { equippedBy } : {}),
})

describe('ZZZ discs', () => {
  const build = {
    id: 'b',
    agentId: '1091',
    name: 'Miyabi',
    element: 'Ice',
    specialty: 'Anomaly',
    level: 60,
    mindscapeLevel: 0,
    wEngineRefinement: 1,
    discIds: { 1: 'd1' },
  }

  it('adds, moves (unequipping) and deletes discs', () => {
    const data = { discs: [disc('d1', 1, '1091')], builds: [build] }
    expect(saveZzzDisc(data, disc('d2', 2)).discs).toHaveLength(2)

    const moved = saveZzzDisc(data, disc('d1', 4, '1091'))
    expect(moved.discs[0].equippedBy).toBeUndefined()
    expect(moved.builds[0].discIds[1]).toBeUndefined()

    const deleted = deleteZzzDiscs(data, ['d1'])
    expect(deleted.discs).toEqual([])
    expect(deleted.builds[0].discIds).toEqual({})
  })

  it('works out S-rank main stats like the game', () => {
    expect(sMainValue('HP', 15)).toBe(2200)
    expect(sMainValue('ATK%', 15)).toBe(30)
    expect(sMainValue('CRIT Rate', 0)).toBe(6)
  })

  it('turns a valid draft into a disc and rejects impossible ones', () => {
    const images = { agents: {}, wEngines: {}, sets: {}, agentInfo: {}, setNames: {} } satisfies ZzzImages
    const kind = zzzDiscKind({ builds: [], images, discs: [disc('d1', 1)] })
    const draft = {
      ...kind.newDraft(),
      setId: 'woodpecker-electro',
      substats: [{ stat: 'CRIT Rate', value: 3 }, { stat: 'CRIT DMG', value: 2 }, { stat: 'ATK%', value: 3 }, { stat: 'PEN', value: 1 }],
    }
    const result = kind.fromDraft(draft)
    expect(result.errors).toEqual([])
    expect(result.item).toMatchObject({
      slot: 1,
      main: { stat: 'HP', value: 2200 },
      substats: [{ stat: 'CRIT Rate', rolls: 3 }, { stat: 'CRIT DMG', rolls: 2 }, { stat: 'ATK%', rolls: 3 }, { stat: 'PEN', rolls: 1 }],
    })

    // 10 rolls on a +15 disc: one too many
    expect(kind.fromDraft({ ...draft, substats: [...draft.substats.slice(0, 3), { stat: 'PEN', value: 2 }] }).item).toBeUndefined()
    // HP can't be a substat of an HP main stat disc
    expect(kind.fromDraft({ ...draft, substats: [{ stat: 'HP', value: 1 }, ...draft.substats.slice(1)] }).errors).toContain(
      'A substat can\'t be the same as the main stat',
    )
  })
})

describe('Genshin artifacts', () => {
  const artifact = (id: string, slot: Artifact['slot'], equippedBy?: string): Artifact => ({
    id,
    slot,
    setId: 'GladiatorsFinale',
    setName: 'Gladiator\'s Finale',
    rarity: 5,
    level: 20,
    main: { stat: 'hp', value: 4780 },
    substats: [],
    ...(equippedBy ? { equippedBy } : {}),
  })
  const character: GenshinCharacter = { id: 'c', name: 'C', level: 90, constellation: 0, artifactIds: { flower: 'a1' }, stats: { hp: 20000 }, statsDate: '' }

  it('editing a worn artifact clears its owner\'s Enka stats; deleting takes it off them', () => {
    const data = { artifacts: [artifact('a1', 'flower', 'c')], characters: [character] }
    const edited = saveGenshinArtifact(data, { ...artifact('a1', 'flower', 'c'), level: 16 })
    expect(edited.characters[0]).toMatchObject({ artifactIds: { flower: 'a1' }, stats: {} })

    const deleted = deleteGenshinArtifacts(data, ['a1'])
    expect(deleted.artifacts).toEqual([])
    expect(deleted.characters[0].artifactIds).toEqual({})
  })
})

describe('WuWa echoes', () => {
  const echo = (id: string, cost: Echo['cost']): Echo => ({ id, defId: 'd', cost, setId: 's', mainStat: 'atkPct', level: 25, substats: [] })
  const hsin: CharacterState = {
    charId: 'hsin',
    level: 90,
    sequence: 0,
    weaponLevel: 90,
    refinement: 1,
    minorFortes: true,
    echoIds: ['e1', null, null, null, null],
  }

  it('a cost change unequips the echo; deleting empties its slot', () => {
    const data = { echoes: [echo('e1', 4)], characters: [hsin], teams: [], priority: [] }
    expect(saveWuwaEcho(data, { ...echo('e1', 4), level: 20 }).characters[0].echoIds[0]).toBe('e1')
    expect(saveWuwaEcho(data, echo('e1', 3)).characters[0].echoIds[0]).toBeNull()
    expect(deleteWuwaEchoes(data, ['e1'])).toMatchObject({ echoes: [], characters: [{ echoIds: [null, null, null, null, null] }] })
  })

  it('needs an echo that drops at that cost in that set, and real roll tiers', () => {
    const kind = wuwaEchoKind({ characters: [] })
    const base = { ...kind.newDraft(), slot: '3', setId: 'midnight-veil', mainStat: 'atkPct', extra: { defId: 'abyssal-gladius' } }
    expect(kind.fromDraft({ ...base, substats: [{ stat: 'critRate', value: 10.5 }] }).errors).toEqual([])
    expect(kind.fromDraft({ ...base, extra: {} }).errors).toEqual(['Pick which echo it is'])
    expect(kind.fromDraft({ ...base, substats: [{ stat: 'critRate', value: 10 }] }).item).toBeUndefined()
  })
})
