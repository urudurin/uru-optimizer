import type { ExtraBuffs } from 'lib/games/shared/extraBuffs'
import {
  keepOverridesFor,
  type TeammateOverrides,
} from 'lib/games/shared/teammateOverrides'
import { resolveZzzCombat } from 'lib/games/zzz/damage/combatEffects'
import {
  addAnomalyBonuses,
  type DamageSetup,
  DEFAULT_ENEMY,
  defaultRotation,
  type EnemySettings,
  type Rotation,
  rotationAnomaly,
  rotationFlatHp,
  rotationSkills,
} from 'lib/games/zzz/damage/damage'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type {
  ActiveConditions,
  AgentData,
} from 'lib/games/zzz/data/dataTypes'
import { zzzMetadata } from 'lib/games/zzz/data/metadata'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import { statScreenConditions } from 'lib/games/zzz/stats/computeStats'
import type { ZzzBuffSetting } from 'lib/games/zzz/team/buffs'
import {
  withZzzExtraDebuffs,
  zzzExtraEffects,
} from 'lib/games/zzz/team/extraBuffs'
import {
  zzzTeamBuffsFor,
  type ZzzTeamResult,
} from 'lib/games/zzz/team/teamBuffs'
import type { Disc } from 'lib/games/zzz/types'

// The part of an agent's optimizer settings that sets up rotation damage: the squad, the enemy, the rotation, the kit
// toggles and the combat conditions. Shared by the optimizer page and the Agents page's DPS score.
export type ZzzDamageSettings = {
  conditions: ActiveConditions,
  // Agent ids, and the team buffs' toggles and stack counts (team/teamBuffs.ts)
  teammates: string[],
  // Rank, weapon and 4-piece changes per teammate, for the team buffs only (shared/teammateOverrides.ts)
  teammateOverrides: TeammateOverrides,
  // Buffs typed in by hand, added to every build (shared/extraBuffs.ts)
  extraBuffs: ExtraBuffs,
  teamSettings: Record<string, ZzzBuffSetting>,
  // The enemy and the rotation, for ranking by damage (damage/damage.ts)
  enemy: EnemySettings,
  rotation: Rotation,
  // Toggles of the agent's own kit effects (damage/combatEffects.ts)
  combatSettings: Record<string, boolean | number>,
}

// An agent's damage settings before any are changed: the stat screen's conditions, no squad, default enemy and rotation
export function zzzDamageDefaults(agentId: string): ZzzDamageSettings {
  return {
    conditions: statScreenConditions(),
    teammates: [],
    teamSettings: {},
    teammateOverrides: {},
    extraBuffs: {},
    enemy: DEFAULT_ENEMY,
    // The agent's metadata rotation once their data is loaded (data/metadata.ts); the same default rotation
    rotation: AGENTS[agentId] ? zzzMetadata(AGENTS[agentId]).rotation : defaultRotation(agentId),
    combatSettings: {},
  }
}

// The gear the setup counts: the W-Engine and the 4-piece / 2-piece sets every build has (the optimizer's loadout and
// set filters, or the worn ones on the Agents page)
export type ZzzSetupGear = { wEngineId: string, refinement: number, fourPieceSet?: string, twoPieceSet?: string }

// The squad buffs, kit effects and damage setup for an agent with these settings. byDamage: the kit's stat effects
// count (ranking by rotation damage)
export function zzzDamageSetup(
  agent: AgentData,
  settings: ZzzDamageSettings,
  gear: ZzzSetupGear,
  byDamage: boolean,
  { builds, discs }: { builds: ImportedBuild[], discs: Disc[] },
) {
  const { teammates, teamSettings, teammateOverrides, extraBuffs, enemy, rotation, combatSettings } = settings
  const loadout = { wEngineId: gear.wEngineId, refinement: String(gear.refinement) }
  const fourPieceSet = gear.fourPieceSet ?? null
  const twoPieceSet = gear.twoPieceSet ?? null
  // What the squad gives this agent, the same for every build
  const team = { teammates, settings: teamSettings, overrides: keepOverridesFor(teammateOverrides, teammates) }
  const teamResult = zzzTeamBuffsFor(agent.id, team, { builds, discs }, fourPieceSet ?? undefined)
  // Gear effects on some hits only: the W-Engine picked for the search and the sets the set filters pick
  const combatGear = {
    wEngineId: loadout.wEngineId,
    refinement: Number(loadout.refinement),
    sets: [
      ...(fourPieceSet ? [{ setId: fourPieceSet, pieces: 4 as const }] : []),
      ...(twoPieceSet && twoPieceSet !== fourPieceSet ? [{ setId: twoPieceSet, pieces: 2 as const }] : []),
    ],
    specialty: agent.specialty,
    element: agent.element,
  }
  const kit = resolveZzzCombat(agent.id, builds.find((b) => b.agentId === agent.id)?.mindscapeLevel ?? 0, combatSettings, combatGear, enemy.stunned)
  // The squad's attributes: Vortex lines, Windswept and Frostbite need a Wind or Ice agent
  const teamElements = [agent.element, ...teammates.map((id) => AGENTS[id]?.element ?? '')]
  // The combat effects and damage setup for a squad's buffs; Teammate set upgrades try them with other teammate sets
  const teamPartsFor = (teamResult: ZzzTeamResult) => {
    // The agent's kit and gear plus what teammates give some hits only (Pulchra's Aftershock DMG)
    // The kit's anomaly bonuses plus the squad's (Remielle's Refringe)
    const anomalyBonus = addAnomalyBonuses(addAnomalyBonuses({}, kit.anomalyBonus), teamResult.anomalyBonus)
    const kindBonus = { ...kit.kindBonus }
    for (const [kind, value] of Object.entries(teamResult.kindBonus) as [keyof typeof kindBonus, number][]) {
      kindBonus[kind] = (kindBonus[kind] ?? 0) + value
    }
    const combatEffects = [...teamResult.effects, ...zzzExtraEffects(extraBuffs), ...(byDamage ? kit.statEffects : [])]
    // The rotation and enemy, for ranking by damage; the team's shred counts here
    const setupFor = (lines: Rotation): DamageSetup => ({
      ...rotationSkills(
        agent.id,
        lines,
        kindBonus,
        kit.skillBonus,
        {
          critDmgFromCritDmg: kit.aftershockCritDmg,
          defIgnore: kit.aftershockDefIgnore,
        },
        { defIgnore: kit.kindDefIgnore, critDmg: kit.kindCritDmg, critRate: kit.kindCritRate, resIgnore: kit.kindResIgnore, scale: kit.hitScale },
      ),
      ...(kit.veilVulnerabilityCap > 0 ? { veilVulnerabilityCap: kit.veilVulnerabilityCap } : {}),
      scaling: agent.specialty === 'Rupture' ? 'sheer' : agent.specialty === 'Armorer' ? 'sharp' : 'atk',
      lacerationDmg: 150 + kit.lacerationBonus + teamResult.lacerationDmg,
      flatHp: rotationFlatHp(agent.id, lines, kit.flatHp),
      critRateFromCritDmg: kit.critRateFromCritDmg,
      sheerDmg: kit.sheerDmg + teamResult.sheerDmg,
      sharpDmg: kit.sharpDmg,
      ...rotationAnomaly(agent.id, agent.element, lines, teamElements, anomalyBonus),
      agentLevel: agent.level,
      enemy: {
        ...enemy,
        windswept: !!enemy.windswept && teamElements.includes('Wind'),
        frostbite: !!enemy.frostbite && teamElements.includes('Ice'),
      },
      // The kit and gear's own RES and DEF ignore add to the team's shred
      debuffs: withZzzExtraDebuffs({
        ...teamResult.debuffs,
        defShred: teamResult.debuffs.defShred + kit.defIgnore,
        resShred: teamResult.debuffs.resShred + kit.resIgnore,
        dmgTaken: teamResult.debuffs.dmgTaken + kit.dmgTaken,
        // Stun multiplier bonuses from different agents add up (Nangong Yu's Misstep, Norma's Tech Divide)
        stunBonus: teamResult.debuffs.stunBonus + kit.stunBonus,
      }, extraBuffs),
    })
    return { combatEffects, setupFor }
  }
  const { combatEffects, setupFor } = teamPartsFor(teamResult)
  const damageSetup = setupFor(rotation)
  return { team, teamResult, kit, teamElements, teamPartsFor, combatEffects, setupFor, damageSetup }
}
