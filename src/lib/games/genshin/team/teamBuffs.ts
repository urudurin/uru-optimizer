import {
  BENEDICTIONS,
  benedictionValue,
  type EnemyDebuffs,
  type HitFlat,
  moonsignLevel,
  type SpecialKind,
} from 'lib/games/genshin/damage/damage'
import {
  computeGenshinStats,
  prepareCharacter,
  type TeamBuffTotals,
} from 'lib/games/genshin/stats/computeStats'
import {
  ANY_MEMBER_BUFFS,
  type BuffContext,
  type BuffSetting,
  type BuffStat,
  CHARACTER_BUFFS,
  isDebuff,
  isSpecialStat,
  RESONANCE_BUFFS,
  SET_4PC_BUFFS,
  type TeamBuff,
  WEAPON_BUFFS,
} from 'lib/games/genshin/team/buffs'
import {
  type Artifact,
  ARTIFACT_SLOTS,
  type Element,
  type GenshinCharacter,
  type GenshinStatKey,
} from 'lib/games/genshin/types'

// What a character's teammates give them, after Genshin Optimizer's team model: each teammate's buffs (kit, weapon,
// 4-piece set) are worked out from that teammate's own stats and the receiver, buffs that don't stack count once, and
// a team of 4 adds its elemental resonance. Stat-screen numbers plus these are what the optimizer ranks.
// Phase 1 limits, shown on the page: buffs a character gives themselves aren't counted (they'd depend on the build
// being searched), and a giver's buffs use their own stats without what other teammates give them.

export type TeamSetup = {
  // Up to 3 teammate ids
  teammates: string[],
  // Whether the receiver is the character on the field (for buffs that only reach the active character)
  onField: boolean,
  // Toggle values by setting key (see settingKey), missing means the toggle's default
  settings: Record<string, BuffSetting>,
}

export type AppliedBuff = {
  buff: TeamBuff,
  // The settings key for this buff's toggle
  key: string,
  sourceName: string,
  giver?: GenshinCharacter,
  setting: BuffSetting,
  stat?: BuffStat,
  value: number,
  // Counted in the totals
  counted: boolean,
  // Why not, when it isn't
  reason?: string,
}

export type TeamBuffResult = TeamBuffTotals & {
  // DEF and RES shred on the enemy, for the rotation damage
  debuffs: EnemyDebuffs,
  // Lunar Reaction DMG Bonus from Moonsign: Ascendant Gleam, in percent
  lunarBonus: number,
  // Bloom DMG Bonus from teammates (Nilou), in percent
  bloomBonus: number,
  // Flat DMG per hit of some elements, for a number of hits (Shenhe's Icy Quill, Vodyanitsa's Lead Vocal)
  hitFlats: HitFlat[],
  // The party's Moonsign level, and the Lunar and Stellar Base DMG increase teammates' passives give, by kind
  moonsign: number,
  baseBonus: Partial<Record<SpecialKind, number>>,
  // Per Lunar or Stellar kind: DMG Bonus, flat DMG added to each hit, and CRIT Rate / CRIT DMG for it, in percent (flat in
  // damage)
  specialBonus: Partial<Record<SpecialKind, number>>,
  specialFlat: Partial<Record<SpecialKind, number>>,
  // How many hits of a kind get the flat DMG (a stacks toggle on it, Lauma's Pale Hymn)
  specialFlatHits: Partial<Record<SpecialKind, number>>,
  specialCrit: Partial<Record<SpecialKind, { rate: number, dmg: number }>>,
  // Each teammate's level, element and own stats (for Stellar Swirl contribution ranking)
  members: { id: string, level: number, element?: Element, stats: Partial<Record<GenshinStatKey, number>> }[],
  applied: AppliedBuff[],
  resonance: Element[],
}

export const NO_TEAM_BUFFS: TeamBuffTotals = { premod: {}, total: {} }

// Toggles are per giver, so two Bennetts (or a resonance and a set) never share one
export function settingKey(buff: TeamBuff, giverId?: string): string {
  return giverId ? `${giverId}:${buff.id}` : buff.id
}

export function defaultSetting(buff: TeamBuff, giver: GenshinCharacter | undefined, receiver: GenshinCharacter): BuffSetting {
  const toggle = buff.toggle
  if (!toggle || toggle.kind === 'switch') return !toggle?.offByDefault
  if (toggle.kind === 'stacks') return giver ? toggle.max(giver) : 0
  return receiver.element && toggle.options.includes(receiver.element) ? receiver.element : toggle.options[0]
}

function wornArtifacts(character: GenshinCharacter, artifacts: Map<string, Artifact>): Artifact[] {
  return ARTIFACT_SLOTS.flatMap((slot) => {
    const artifact = artifacts.get(character.artifactIds[slot] ?? '')
    return artifact ? [artifact] : []
  })
}

function fourPieceSets(worn: Artifact[]): string[] {
  const counts = new Map<string, number>()
  for (const artifact of worn) counts.set(artifact.setId, (counts.get(artifact.setId) ?? 0) + 1)
  return [...counts].filter(([, count]) => count >= 4).map(([setId]) => setId)
}

export function resonanceElements(members: GenshinCharacter[]): Element[] {
  if (members.length < 4) return []
  const counts = new Map<Element, number>()
  for (const member of members) if (member.element) counts.set(member.element, (counts.get(member.element) ?? 0) + 1)
  return [...counts].filter(([, count]) => count >= 2).map(([element]) => element)
}

export function teamBuffsFor(
  receiver: GenshinCharacter,
  setup: TeamSetup,
  data: { characters: GenshinCharacter[], artifacts: Artifact[] },
): TeamBuffResult {
  const byId = new Map(data.characters.map((c) => [c.id, c]))
  const artifactsById = new Map(data.artifacts.map((a) => [a.id, a]))
  const teammates = setup.teammates.filter((id) => id !== receiver.id).slice(0, 3).flatMap((id) => byId.get(id) ?? [])

  // Each teammate's own stats, from their worn artifacts
  const givers = teammates.map((character) => {
    const worn = wornArtifacts(character, artifactsById)
    return {
      character,
      worn,
      stats: computeGenshinStats(character, worn).stats,
      baseAtk: prepareCharacter(character)?.baseAtk ?? 0,
    }
  })
  const teamMaxElementalMastery = Math.max(0, ...givers.map((g) => g.stats.elementalMastery ?? 0))

  // Moonsign: one level per Lunar character in the party; Ascendant Gleam (2+) lets non-Moonsign teammates buff Lunar DMG
  const moonsign = moonsignLevel([receiver.id, ...teammates.map((c) => c.id)])
  const isMoonsign = (id: string) => BENEDICTIONS[id]?.kinds.some((kind) => kind.startsWith('lunar')) ?? false
  const candidates: { buff: TeamBuff, sourceName: string, giver?: (typeof givers)[number] }[] = []
  for (const giver of givers) {
    const { character } = giver
    for (const buff of CHARACTER_BUFFS[character.id] ?? []) candidates.push({ buff, sourceName: character.name, giver })
    if (moonsign >= 2 && !isMoonsign(character.id)) { for (const buff of ANY_MEMBER_BUFFS) candidates.push({ buff, sourceName: character.name, giver }) }
    for (const buff of WEAPON_BUFFS[character.weapon?.id ?? ''] ?? []) {
      candidates.push({ buff, sourceName: `${character.name}'s ${character.weapon?.name}`, giver })
    }
    for (const setId of fourPieceSets(giver.worn)) {
      for (const buff of SET_4PC_BUFFS[setId] ?? []) candidates.push({ buff, sourceName: `${character.name}'s 4-piece set`, giver })
    }
  }
  const resonance = resonanceElements([receiver, ...teammates])
  for (const element of resonance) {
    for (const buff of RESONANCE_BUFFS[element] ?? []) candidates.push({ buff, sourceName: `${element} resonance` })
  }

  const applied: AppliedBuff[] = candidates.map(({ buff, sourceName, giver }) => {
    const key = settingKey(buff, giver?.character.id)
    const setting = setup.settings[key] ?? defaultSetting(buff, giver?.character, receiver)
    const base = { buff, key, sourceName, giver: giver?.character, setting }

    // Who it reaches: the receiver is never the giver here, so 'team' and 'others' both include them
    if ((buff.target === 'active' || buff.target === 'next') && !setup.onField) {
      return { ...base, value: 0, counted: false, reason: `Only for the character on the field` }
    }
    if (setting === false) return { ...base, value: 0, counted: false, reason: 'Turned off' }

    const context: BuffContext = {
      giver: giver?.character ?? receiver,
      giverStats: giver?.stats ?? {},
      giverBaseAtk: giver?.baseAtk ?? 0,
      receiver,
      setting,
      teamMaxElementalMastery,
    }
    const stat = typeof buff.stat === 'function' ? buff.stat(context) : buff.stat
    const value = stat ? buff.value(context) : 0
    if (!stat || value <= 0) return { ...base, stat, value: 0, counted: false, reason: buff.blockedBy?.(context) ?? 'Doesn\'t apply' }
    return { ...base, stat, value, counted: true }
  })

  // Buffs that don't stack: only the biggest of each group counts
  const best = new Map<string, AppliedBuff>()
  for (const entry of applied) {
    const group = entry.buff.nonStacking
    if (!group || !entry.counted) continue
    const current = best.get(group)
    if (!current || entry.value > current.value) best.set(group, entry)
  }
  for (const entry of applied) {
    const group = entry.buff.nonStacking
    if (group && entry.counted && best.get(group) !== entry) {
      entry.counted = false
      entry.reason = `Doesn't stack with ${best.get(group)!.sourceName}`
    }
  }

  const totals: TeamBuffTotals = { premod: {}, total: {} }
  const debuffs: EnemyDebuffs = { defShred: 0, resShred: {} }
  let lunarBonus = 0
  let bloomBonus = 0
  const hitFlats: HitFlat[] = []
  const specialBonus: Partial<Record<SpecialKind, number>> = {}
  const specialFlat: Partial<Record<SpecialKind, number>> = {}
  const specialFlatHits: Partial<Record<SpecialKind, number>> = {}
  const specialCrit: Partial<Record<SpecialKind, { rate: number, dmg: number }>> = {}
  for (const entry of applied) {
    if (!entry.counted || !entry.stat) continue
    if (entry.stat === 'lunarBonus') {
      lunarBonus += entry.value
      continue
    }
    if (entry.stat === 'bloomBonus') {
      bloomBonus += entry.value
      continue
    }
    if (entry.stat === 'hitFlat') {
      const triggers = typeof entry.setting === 'number' ? entry.setting : Infinity
      if (entry.value > 0 && triggers > 0) hitFlats.push({ flat: entry.value, triggers, elements: entry.buff.flatElements ?? [] })
      continue
    }
    if (isSpecialStat(entry.stat)) {
      const [field, kind] = entry.stat.split(':') as [string, SpecialKind]
      if (field === 'special') specialBonus[kind] = (specialBonus[kind] ?? 0) + entry.value
      else if (field === 'specialFlat') {
        specialFlat[kind] = (specialFlat[kind] ?? 0) + entry.value
        if (typeof entry.setting === 'number') specialFlatHits[kind] = Math.max(specialFlatHits[kind] ?? 0, entry.setting)
      } else {
        const crit = specialCrit[kind] ??= { rate: 0, dmg: 0 }
        if (field === 'specialCritRate') crit.rate += entry.value
        else crit.dmg += entry.value
      }
      continue
    }
    if (isDebuff(entry.stat)) {
      if (entry.stat === 'defShred') debuffs.defShred += entry.value
      else {
        const element = entry.stat.slice('resShred:'.length) as keyof EnemyDebuffs['resShred']
        debuffs.resShred[element] = (debuffs.resShred[element] ?? 0) + entry.value
      }
      continue
    }
    const bucket = totals[entry.buff.stage]
    bucket[entry.stat] = (bucket[entry.stat] ?? 0) + entry.value
  }
  // Teammates' Moonsign Benediction and Stellar Jubilee passives, from their own stats. Different characters' passives add up (same-bucket buffs from different sources do)
  const baseBonus: Partial<Record<SpecialKind, number>> = {}
  for (const giver of givers) {
    const benediction = BENEDICTIONS[giver.character.id]
    if (!benediction) continue
    const value = benedictionValue(benediction, giver.stats)
    for (const kind of benediction.kinds) baseBonus[kind] = (baseBonus[kind] ?? 0) + value
  }
  const members = givers.map((g) => ({ id: g.character.id, level: g.character.level, element: g.character.element, stats: g.stats }))
  return {
    ...totals,
    debuffs,
    lunarBonus,
    bloomBonus,
    hitFlats,
    moonsign,
    baseBonus,
    specialBonus,
    specialFlat,
    specialFlatHits,
    specialCrit,
    members,
    applied,
    resonance,
  }
}
