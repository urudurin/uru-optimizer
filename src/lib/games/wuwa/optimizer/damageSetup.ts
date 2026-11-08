import type { ExtraBuffs } from 'lib/games/shared/extraBuffs'
import {
  keepOverridesFor,
  type TeammateOverrides,
} from 'lib/games/shared/teammateOverrides'
import {
  resolveWuwaCombat,
  resolveWuwaSetEffects,
} from 'lib/games/wuwa/damage/combatEffects'
import {
  DEFAULT_ENEMY,
  type EnemySettings,
  mainEchoBonus,
  type Rotation,
} from 'lib/games/wuwa/damage/damage'
import { CHARACTER_INFO } from 'lib/games/wuwa/data/characters'
import { wuwaMetadata } from 'lib/games/wuwa/data/metadata'
import type { WuwaBuffSetting } from 'lib/games/wuwa/team/buffs'
import {
  withWuwaExtraBuffs,
  wuwaExtraEnemy,
} from 'lib/games/wuwa/team/extraBuffs'
import { wuwaTeamBuffsFor } from 'lib/games/wuwa/team/teamBuffs'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'

// The part of a Resonator's optimizer settings that sets up rotation damage: the team, the enemy, the rotation and the
// effect toggles. Shared by the optimizer page and the Resonators page's DPS score.
export type WuwaDamageSettings = {
  // Character ids, and the team buffs' toggles and stack counts (team/teamBuffs.ts)
  teammates: string[],
  // Rank, weapon and 4-piece changes per teammate, for the team buffs only (shared/teammateOverrides.ts)
  teammateOverrides: TeammateOverrides,
  // Buffs typed in by hand, added to every build (shared/extraBuffs.ts)
  extraBuffs: ExtraBuffs,
  teamSettings: Record<string, WuwaBuffSetting>,
  // The rotation damage target (damage/damage.ts): the enemy and the rotation
  enemy: EnemySettings,
  rotation: Rotation,
  // Toggles of the Resonator's own kit effects (damage/combatEffects.ts)
  combatSettings: Record<string, boolean | number>,
}

// A Resonator's damage settings before any are changed: no team, the default enemy and rotation
export function wuwaDamageDefaults(charId: string): WuwaDamageSettings {
  return {
    teammates: [],
    teamSettings: {},
    teammateOverrides: {},
    extraBuffs: {},
    enemy: DEFAULT_ENEMY,
    rotation: wuwaMetadata(charId).rotation,
    combatSettings: {},
  }
}

// The team buffs, kit and main-echo effects, full-set effects and damage setup for a Resonator with these settings.
// shownSets: the full sets whose effects are worked out (setEffects.bonusBySet); mainEchoId: the main echo's id;
// byDamage: the kit, main-echo and set bonuses count (ranking by rotation damage)
export function wuwaDamageSetup(
  character: CharacterState,
  settings: WuwaDamageSettings,
  shownSets: string[],
  mainEchoId: string | undefined,
  byDamage: boolean,
  { characters, echoes }: { characters: CharacterState[], echoes: Echo[] },
) {
  const { teammates, teamSettings, teammateOverrides, extraBuffs, enemy, rotation, combatSettings } = settings
  const teamOverrides = keepOverridesFor(teammateOverrides, teammates)
  const teamResult = wuwaTeamBuffsFor(character, { teammates, settings: teamSettings, overrides: teamOverrides }, { characters, echoes })
  // The Resonator's own kit effects, counted only when ranking by rotation damage
  const kit = resolveWuwaCombat(character.charId, character.sequence, combatSettings)
  // The main echo's main-slot buff counts like the kit's
  const mainEcho = mainEchoBonus(mainEchoId, character.charId)
  // The team's bonus with the extra buffs, for every target; kit and main-echo buffs join it when ranking by damage
  const teamBonus = withWuwaExtraBuffs(teamResult.bonus, extraBuffs, CHARACTER_INFO[character.charId]?.element ?? undefined)
  const extraEnemy = wuwaExtraEnemy(extraBuffs)
  const combatBonus = { ...teamBonus }
  if (byDamage) {
    for (const [stat, value] of [...Object.entries(kit.bonus), ...Object.entries(mainEcho.stats)] as [keyof typeof combatBonus, number][]) {
      combatBonus[stat] = (combatBonus[stat] ?? 0) + value
    }
  }
  const setEffects = resolveWuwaSetEffects(shownSets, character.sequence, combatSettings)
  const fullSetBonus = byDamage ? setEffects.bonusBySet : undefined
  const damageSetup = {
    charId: character.charId,
    characterLevel: character.level,
    rotation,
    enemy: {
      ...enemy,
      defIgnore: enemy.defIgnore + kit.defIgnore + teamResult.defIgnore + extraEnemy.defIgnore,
      resShred: enemy.resShred + kit.resShred + teamResult.resShred + extraEnemy.resShred,
    },
    element: CHARACTER_INFO[character.charId]?.element ?? undefined,
    // The kit's and the team's DMG Amplified add up per kind
    amplify: Object.fromEntries(
      [...new Set([...Object.keys(kit.amplify), ...Object.keys(teamResult.amplify), ...(extraEnemy.amplify ? ['all'] : [])])].map((kind) => [
        kind,
        (kit.amplify[kind as keyof typeof kit.amplify] ?? 0) + (teamResult.amplify[kind as keyof typeof teamResult.amplify] ?? 0)
        + (kind === 'all' ? extraEnemy.amplify : 0),
      ]),
    ),
    typeBonus: { echo: mainEcho.echoDmg },
    coordinatedDmg: mainEcho.coordinatedDmg,
    lineScale: kit.lineScale,
  }
  return { teamResult, kit, mainEcho, teamBonus, combatBonus, setEffects, fullSetBonus, damageSetup }
}
