import {
  assignGenshinArtifact,
  deleteGenshinArtifacts,
  saveGenshinArtifact,
} from 'lib/games/genshin/state/genshinState'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import {
  assignWuwaEcho,
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
  assignZzzDisc,
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

  it('Equipped by puts a disc on an agent with a build (swapping like Equip) or takes it off', () => {
    const other = { ...build, id: 'b2', agentId: '1191', name: 'Ellen', discIds: { 1: 'd2' } }
    const data = { discs: [disc('d1', 1, '1091'), disc('d2', 1, '1191')], builds: [build, other] }
    const moved = assignZzzDisc(data, 'd2', '1091')
    expect(moved.builds.map((b) => b.discIds[1])).toEqual(['d2', 'd1'])
    const off = assignZzzDisc(data, 'd1', null)
    expect(off.builds[0].discIds[1]).toBeUndefined()
    expect(off.discs[0].equippedBy).toBeUndefined()
    // Replace (HSR's default): Ellen's slot empties and Miyabi's old disc comes off
    const replaced = assignZzzDisc(data, 'd2', '1091', false)
    expect(replaced.builds.map((b) => b.discIds[1])).toEqual(['d2', undefined])
    // An agent without a build can't wear it; the same owner changes nothing
    expect(assignZzzDisc(data, 'd1', '9999')).toBe(data)
    expect(assignZzzDisc(data, 'd1', '1091')).toBe(data)
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

  it('Equipped by puts an artifact on a character or takes it off, clearing their Enka stats', () => {
    const data = { artifacts: [artifact('a1', 'flower', 'c'), artifact('a2', 'flower')], characters: [character] }
    const swapped = assignGenshinArtifact(data, 'a2', 'c')
    expect(swapped.characters[0]).toMatchObject({ artifactIds: { flower: 'a2' }, stats: {} })
    expect(swapped.artifacts.find((a) => a.id === 'a2')?.equippedBy).toBe('c')
    expect(swapped.artifacts.find((a) => a.id === 'a1')?.equippedBy).toBeUndefined()
    const off = assignGenshinArtifact(data, 'a1', null)
    expect(off.characters[0].artifactIds).toEqual({})
    expect(off.artifacts[0].equippedBy).toBeUndefined()
  })

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

  it('Equipped by adds an echo within 5 echoes and 12 cost, making room with the same cost first', () => {
    const echoes = [echo('e1', 4), echo('e2', 4), echo('e3', 1), echo('e4', 1), echo('e5', 1), echo('n4', 4), echo('n3', 3)]
    const full = { ...hsin, echoIds: ['e1', 'e2', 'e3', 'e4', 'e5'] }
    const data = { echoes, characters: [full], teams: [], priority: [] }
    // 4+4+1+1+1: a new 4-cost replaces a 4-cost
    expect(assignWuwaEcho(data, 'n4', 'hsin').characters[0].echoIds).toEqual(['e2', 'n4', 'e3', 'e4', 'e5'])
    // A 3-cost: no 3-cost to replace, so the costliest go until it fits
    const withThree = assignWuwaEcho(data, 'n3', 'hsin').characters[0].echoIds
    expect(withThree).toContain('n3')
    expect(withThree.filter(Boolean).length).toBeLessThanOrEqual(5)
    expect(assignWuwaEcho(data, 'e3', null).characters[0].echoIds).toEqual(['e1', 'e2', null, 'e4', 'e5'])
  })

  it('replace leaves the previous owner without the echo; swap gives them the dropped echo of the same cost', () => {
    const echoes = [echo('e1', 4), echo('e2', 4), echo('e3', 1), echo('e4', 1), echo('e5', 1), echo('x4', 4)]
    const other: CharacterState = { ...hsin, charId: 'suoming', echoIds: ['x4', null, null, null, null] }
    const data = { echoes, characters: [{ ...hsin, echoIds: ['e1', 'e2', 'e3', 'e4', 'e5'] }, other], teams: [], priority: [] }
    expect(assignWuwaEcho(data, 'x4', 'hsin').characters[1].echoIds[0]).toBeNull()
    const swapped = assignWuwaEcho(data, 'x4', 'hsin', true)
    expect(swapped.characters[0].echoIds).toContain('x4')
    expect(swapped.characters[1].echoIds[0]).toBe('e1')
  })

  it('needs an echo that drops at that cost in that set, and real roll tiers', () => {
    const kind = wuwaEchoKind({ characters: [] })
    const base = { ...kind.newDraft(), slot: '3', setId: 'midnight-veil', mainStat: 'atkPct', extra: { defId: 'abyssal-gladius' } }
    expect(kind.fromDraft({ ...base, substats: [{ stat: 'critRate', value: 10.5 }] }).errors).toEqual([])
    expect(kind.fromDraft({ ...base, extra: {} }).errors).toEqual(['Pick which echo it is'])
    expect(kind.fromDraft({ ...base, substats: [{ stat: 'critRate', value: 10 }] }).item).toBeUndefined()
  })
})
