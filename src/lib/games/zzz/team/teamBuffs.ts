import {
  type AnomalyBonuses,
  type EnemyDebuffs,
  type KindBonus,
  NO_DEBUFFS,
} from 'lib/games/zzz/damage/damage'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type { StatEffect } from 'lib/games/zzz/data/dataTypes'
import { FACTIONS } from 'lib/games/zzz/data/factions'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  computeStats,
  type FinalStats,
  statScreenConditions,
} from 'lib/games/zzz/stats/computeStats'
import { resolveBuild } from 'lib/games/zzz/stats/resolveBuild'
import {
  AGENT_BUFFS,
  type EnemyDebuffKey,
  type HitBonusKey,
  SET_4PC_BUFFS,
  type SquadMember,
  W_ENGINE_TEAM_BUFFS,
  type ZzzBuffContext,
  type ZzzBuffSetting,
  type ZzzTeamBuff,
} from 'lib/games/zzz/team/buffs'
import type { Disc } from 'lib/games/zzz/types'

// What two teammates give one agent, like genshin/team/teamBuffs.ts: each teammate's kit (team/buffs.ts AGENT_BUFFS)
// and the 4-piece set of the discs in their saved build, worked out from their own stat screen. The result is a list of
// stat effects for the stat calculator and the optimizer (ComputeInput.teamEffects / OptimizerRequest.teamEffects).

export type ZzzTeamSetup = {
  // Agent ids, at most two
  teammates: string[],
  // Toggles and stack counts by settingKey
  settings: Record<string, ZzzBuffSetting>,
}

export type ZzzAppliedBuff = {
  buff: ZzzTeamBuff,
  key: string,
  sourceName: string,
  giver: SquadMember,
  setting: ZzzBuffSetting,
  value: number,
  counted: boolean,
  reason?: string,
}

export type ZzzTeamResult = {
  effects: StatEffect[],
  // DEF shred, RES shred and DMG taken on the enemy, for rotation damage
  debuffs: EnemyDebuffs,
  // DMG Bonus for some hits only (Pulchra's Aftershock DMG), for rotation damage
  kindBonus: KindBonus,
  // Sheer DMG Bonus from the squad (Yunkui Tales), in percent
  sheerDmg: number,
  // Laceration DMG for Armorer agents (Roxy), in percent
  lacerationDmg: number,
  // Bonuses to the receiver's anomalies (Remielle's Refringe)
  anomalyBonus: AnomalyBonuses,
  applied: ZzzAppliedBuff[],
  // Teammates whose stat screen couldn't be worked out (no saved build, or no data for them)
  missing: string[],
}

export const NO_TEAM: ZzzTeamResult = {
  effects: [],
  debuffs: NO_DEBUFFS,
  kindBonus: {},
  sheerDmg: 0,
  lacerationDmg: 0,
  anomalyBonus: {},
  applied: [],
  missing: [],
}

export function settingKey(buff: ZzzTeamBuff, giverId: string): string {
  return `${giverId}:${buff.id}`
}

export function defaultSetting(buff: ZzzTeamBuff, giver: SquadMember): ZzzBuffSetting {
  const toggle = buff.toggle
  if (toggle?.kind === 'stacks') return toggle.max(giver)
  return true
}

export function squadMember(agentId: string, mindscape: number): SquadMember | undefined {
  const agent = AGENTS[agentId]
  if (!agent) return undefined
  return { agentId, name: agent.name, element: agent.element, specialty: agent.specialty, faction: FACTIONS[agentId], mindscape }
}

export function isDebuff(stat: string): stat is EnemyDebuffKey {
  return stat === 'defShred' || stat === 'resShred' || stat === 'dmgTaken' || stat === 'stunBonus'
}

function isHitBonus(stat: string): stat is HitBonusKey {
  return stat === 'aftershockDmg' || stat === 'sheerDmg' || stat === 'anomalyBuff' || stat === 'chainDmg' || stat === 'ultDmg' || stat === 'lacerationDmg'
}

function fourPieceSets(discs: Disc[]): string[] {
  const counts = new Map<string, number>()
  for (const disc of discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
  return [...counts].filter(([, count]) => count >= 4).map(([setId]) => setId)
}

export function zzzTeamBuffsFor(
  receiverId: string,
  setup: ZzzTeamSetup,
  data: { builds: ImportedBuild[], discs: Disc[] },
  // The receiver's own 4-piece (the set filter's): a teammate's copy of the same squad set doesn't stack with it
  ownFourPiece?: string,
): ZzzTeamResult {
  const receiverBuild = data.builds.find((b) => b.agentId === receiverId)
  const receiver = squadMember(receiverId, receiverBuild?.mindscapeLevel ?? 0)
  if (!receiver) return NO_TEAM

  const missing: string[] = []
  const givers: { member: SquadMember, stats: FinalStats, discs: Disc[], wEngineId?: string, refinement: number }[] = []
  for (const id of setup.teammates.filter((t) => t !== receiverId).slice(0, 2)) {
    const build = data.builds.find((b) => b.agentId === id)
    const member = squadMember(id, build?.mindscapeLevel ?? 0)
    const resolved = build ? resolveBuild(build, data.discs) : undefined
    if (!member || !resolved?.ok) {
      missing.push(member?.name ?? AGENTS[id]?.name ?? id)
      continue
    }
    const stats = computeStats({ ...resolved.build, coreSkillLevel: 6, conditions: statScreenConditions() }).stats
    givers.push({ member, stats, discs: resolved.build.discs, wEngineId: build?.wEngineId, refinement: build?.wEngineRefinement ?? 1 })
  }
  const squad = [receiver, ...givers.map((g) => g.member)]

  const applied: ZzzAppliedBuff[] = []
  for (const giver of givers) {
    const sources: { buff: ZzzTeamBuff, sourceName: string, setId?: string }[] = [
      ...(AGENT_BUFFS[giver.member.agentId] ?? []).map((buff) => ({ buff, sourceName: giver.member.name })),
      ...fourPieceSets(giver.discs).flatMap((setId) =>
        (SET_4PC_BUFFS[setId] ?? []).map((buff) => ({ buff, sourceName: `${giver.member.name}'s 4-piece set`, setId }))
      ),
      ...(giver.wEngineId ? W_ENGINE_TEAM_BUFFS[giver.wEngineId] ?? [] : []).map((buff) => ({ buff, sourceName: `${giver.member.name}'s W-Engine` })),
    ]
    for (const { buff, sourceName, setId } of sources) {
      const key = settingKey(buff, giver.member.agentId)
      const setting = setup.settings[key] ?? defaultSetting(buff, giver.member)
      const base = { buff, key, sourceName, giver: giver.member, setting }
      if (setId && setId === ownFourPiece) {
        applied.push({ ...base, value: 0, counted: false, reason: 'Doesn\'t stack with the same set on this agent' })
        continue
      }
      if (setting === false) {
        applied.push({ ...base, value: 0, counted: false, reason: 'Turned off' })
        continue
      }
      const context: ZzzBuffContext = { giver: giver.member, giverStats: giver.stats, receiver, squad, setting, refinement: giver.refinement }
      const value = buff.value(context)
      if (buff.element && buff.element !== receiver.element) {
        applied.push({ ...base, value: 0, counted: false, reason: `Only for ${buff.element} agents` })
      } else if (!(value > 0)) {
        applied.push({ ...base, value: 0, counted: false, reason: buff.blockedBy?.(context) ?? 'Doesn\'t apply' })
      } else {
        applied.push({ ...base, value, counted: true })
      }
    }
  }

  // Non-stacking buffs: only the biggest of each group counts
  const best = new Map<string, ZzzAppliedBuff>()
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
      entry.reason = `Doesn't stack with ${best.get(group)?.sourceName}`
    }
  }

  const debuffs: EnemyDebuffs = { ...NO_DEBUFFS }
  for (const a of applied) if (a.counted && isDebuff(a.buff.stat)) debuffs[a.buff.stat] += a.value
  const kindBonus: KindBonus = {}
  for (const a of applied) if (a.counted && a.buff.stat === 'aftershockDmg') kindBonus.aftershock = (kindBonus.aftershock ?? 0) + a.value
  for (const a of applied) if (a.counted && a.buff.stat === 'chainDmg') kindBonus.chain = (kindBonus.chain ?? 0) + a.value
  for (const a of applied) if (a.counted && a.buff.stat === 'ultDmg') kindBonus.ult = (kindBonus.ult ?? 0) + a.value
  const sheerDmg = applied.filter((a) => a.counted && a.buff.stat === 'sheerDmg').reduce((sum, a) => sum + a.value, 0)
  const lacerationDmg = applied.filter((a) => a.counted && a.buff.stat === 'lacerationDmg').reduce((sum, a) => sum + a.value, 0)
  const effects: StatEffect[] = applied.filter((a) => a.counted).flatMap((a) => (isDebuff(a.buff.stat) || isHitBonus(a.buff.stat) ? [] : [{
    stat: a.buff.stat,
    value: a.value,
    source: `${a.sourceName}: ${a.buff.label}`,
    confidence: a.buff.confidence,
  }]))
  const anomalyBuff = applied.filter((a) => a.counted && a.buff.stat === 'anomalyBuff').reduce((sum, a) => sum + a.value, 0)
  const anomalyBonus: AnomalyBonuses = anomalyBuff > 0 ? { anomaly: { buff: anomalyBuff } } : {}
  return { effects, debuffs, kindBonus, sheerDmg, lacerationDmg, anomalyBonus, applied, missing }
}
