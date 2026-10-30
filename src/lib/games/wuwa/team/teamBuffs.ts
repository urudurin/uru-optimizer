import type { HitType } from 'lib/games/wuwa/damage/damage'
import { CHARACTER_INFO } from 'lib/games/wuwa/data/characters'
import { characterName } from 'lib/games/wuwa/data/gameData'
import {
  type Bonus,
  computeWuwaStats,
  toDisplayStats,
} from 'lib/games/wuwa/stats/computeStats'
import {
  OUTRO_BUFFS,
  RESONATOR_BUFFS,
  type WuwaBuffSetting,
  type WuwaTeamBuff,
} from 'lib/games/wuwa/team/buffs'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'

// What two teammates give one Resonator (team/buffs.ts), from each teammate's own overview screen with the echoes they
// wear in the save. The result is a stat bonus for the calculator and the optimizer (computeWuwaStats' extra stats,
// EchoRequest.teamBonus).

export type WuwaTeamSetup = {
  // Character ids, at most two
  teammates: string[],
  settings: Record<string, WuwaBuffSetting>,
}

export type WuwaAppliedBuff = {
  buff: WuwaTeamBuff,
  key: string,
  sourceName: string,
  giver: CharacterState,
  setting: WuwaBuffSetting,
  value: number,
  counted: boolean,
  reason?: string,
}

export type WuwaTeamResult = {
  bonus: Bonus,
  // DMG Amplified (for every hit or one kind), DEF ignore and RES shred, in percent, for rotation damage
  amplify: Partial<Record<HitType | 'all', number>>,
  defIgnore: number,
  resShred: number,
  applied: WuwaAppliedBuff[],
}

export const NO_WUWA_TEAM: WuwaTeamResult = { bonus: {}, amplify: {}, defIgnore: 0, resShred: 0, applied: [] }

export function settingKey(buff: WuwaTeamBuff, giverId: string): string {
  return `${giverId}:${buff.id}`
}

function defaultSetting(buff: WuwaTeamBuff): WuwaBuffSetting {
  if (buff.offByDefault) return buff.toggle?.kind === 'stacks' ? 0 : false
  return buff.toggle?.kind === 'stacks' ? buff.toggle.max : true
}

export function wuwaTeamBuffsFor(
  receiver: CharacterState,
  setup: WuwaTeamSetup,
  data: { characters: CharacterState[], echoes: Echo[] },
): WuwaTeamResult {
  const echoById = new Map(data.echoes.map((e) => [e.id, e]))
  const receiverElement = CHARACTER_INFO[receiver.charId]?.element
  const applied: WuwaAppliedBuff[] = []
  for (const id of setup.teammates.filter((t) => t !== receiver.charId).slice(0, 2)) {
    const giver = data.characters.find((c) => c.charId === id)
    if (!giver) continue
    const worn = giver.echoIds.flatMap((echoId) => (echoId ? echoById.get(echoId) ?? [] : []))
    // As the overview screen shows them (Energy Regen 250 = 250%)
    const giverStats = toDisplayStats(computeWuwaStats(giver, worn).stats)
    for (const buff of [...(RESONATOR_BUFFS[id] ?? []), ...(OUTRO_BUFFS[id] ?? [])]) {
      const key = settingKey(buff, id)
      const setting = setup.settings[key] ?? defaultSetting(buff)
      const base = { buff, key, sourceName: characterName(id), giver, setting }
      if (setting === false) {
        applied.push({ ...base, value: 0, counted: false, reason: 'Turned off' })
        continue
      }
      if (buff.element && buff.element !== receiverElement) {
        applied.push({ ...base, value: 0, counted: false, reason: `Doesn't help a non-${buff.element.replace('Dmg', '')} Resonator` })
        continue
      }
      const value = buff.value({ giver, giverStats, receiver, setting })
      applied.push(value > 0 ? { ...base, value, counted: true } : { ...base, value: 0, counted: false, reason: 'Doesn\'t apply' })
    }
  }
  const result: WuwaTeamResult = { ...NO_WUWA_TEAM, bonus: {}, amplify: {}, applied }
  for (const { buff, value, counted } of applied) {
    if (!counted) continue
    if (buff.stat === 'defIgnore' || buff.stat === 'resShred') result[buff.stat] += value
    else if (buff.stat.startsWith('amplify:')) {
      const kind = buff.stat.slice('amplify:'.length) as HitType | 'all'
      result.amplify[kind] = (result.amplify[kind] ?? 0) + value
    } else {
      const stat = buff.stat as keyof Bonus
      result.bonus[stat] = (result.bonus[stat] ?? 0) + value
    }
  }
  return result
}
