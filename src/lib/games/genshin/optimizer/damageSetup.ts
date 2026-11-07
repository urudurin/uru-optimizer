import {
  type CombatSetup,
  resolveCombat,
  setCountsOf,
} from 'lib/games/genshin/damage/combatEffects'
import {
  DEFAULT_ENEMY,
  defaultRotation,
  type EnemySettings,
  hexereiCount,
  type Rotation,
  rotationTalents,
  stellarContribution,
  teamReactions,
} from 'lib/games/genshin/damage/damage'
import type { BuffSetting } from 'lib/games/genshin/team/buffs'
import {
  withGenshinExtraBuffs,
  withGenshinExtraDebuffs,
} from 'lib/games/genshin/team/extraBuffs'
import {
  type TeamBuffResult,
  teamBuffsFor,
} from 'lib/games/genshin/team/teamBuffs'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import type { ExtraBuffs } from 'lib/games/shared/extraBuffs'
import {
  keepOverridesFor,
  type TeammateOverrides,
} from 'lib/games/shared/teammateOverrides'

// The part of a character's optimizer settings that sets up rotation damage: the team, the enemy, the rotation and the
// effect toggles. Shared by the optimizer page and the Characters page's DPS score, so both score the same way.
export type GenshinDamageSettings = {
  // The team (team/teamBuffs.ts): teammate ids, whether this character is on the field, buff toggles
  teammates: string[],
  onField: boolean,
  // Rank, weapon and 4-piece changes per teammate, for the team buffs only (shared/teammateOverrides.ts)
  teammateOverrides: TeammateOverrides,
  // Buffs typed in by hand, added to every build (shared/extraBuffs.ts)
  extraBuffs: ExtraBuffs,
  teamSettings: Record<string, BuffSetting>,
  // The rotation damage target (damage/damage.ts): the enemy and the rotation
  enemy: EnemySettings,
  rotation: Rotation,
  // Toggles of the character's own combat effects (damage/combatEffects.ts)
  combatSettings: Record<string, BuffSetting>,
}

// A character's damage settings before any are changed: no team, the default enemy and rotation
export function genshinDamageDefaults(characterId: string, constellation = 0): GenshinDamageSettings {
  return {
    teammates: [],
    onField: true,
    teamSettings: {},
    teammateOverrides: {},
    extraBuffs: {},
    enemy: DEFAULT_ENEMY,
    rotation: defaultRotation(characterId, [], [], constellation),
    combatSettings: {},
  }
}

// The team buffs, combat effects and damage setup for a character with these settings. fourPieceSet: the 4-piece set
// every build has (the optimizer's filter, or the worn set on the Characters page), whose effects count in combat.
export function genshinDamageSetup(
  character: GenshinCharacter,
  settings: GenshinDamageSettings,
  fourPieceSet: string | undefined,
  { characters, artifacts }: { characters: GenshinCharacter[], artifacts: Artifact[] },
) {
  const { teammates, onField, teamSettings, teammateOverrides, extraBuffs, enemy, rotation, combatSettings } = settings
  // What the team gives this character, the same for every build
  const team = { teammates, onField, settings: teamSettings, overrides: keepOverridesFor(teammateOverrides, teammates) }
  const teamResult = teamBuffsFor(character, team, { characters, artifacts })
  const teamBuffs = withGenshinExtraBuffs({ premod: teamResult.premod, total: teamResult.total }, extraBuffs)
  const talents = rotationTalents(character, rotation)
  // The Lunar and Stellar kinds this team can trigger; the page only offers those
  const reactionsInTeam = teamReactions([character.id, ...teammates])
  // The character's own combat effects: their kit, and the 4-piece filter's set (every build has it)
  const combat: CombatSetup = {
    sets: fourPieceSet ? [fourPieceSet] : [],
    settings: combatSettings,
    hexerei: hexereiCount([character.id, ...teammates]),
  }
  const resolvedCombat = resolveCombat(character, combat, setCountsOf(fourPieceSet ? Array(4).fill(fourPieceSet) : []))
  // The damage setup for a team's buffs; Teammate set upgrades try it with other teammate sets
  const damageSetupFor = (teamResult: TeamBuffResult) => {
    const kitDebuffs = {
      defShred: teamResult.debuffs.defShred + resolvedCombat.debuffs.defShred,
      resShred: { ...teamResult.debuffs.resShred },
    }
    for (const [element, value] of Object.entries(resolvedCombat.debuffs.resShred) as [keyof typeof kitDebuffs.resShred, number][]) {
      kitDebuffs.resShred[element] = (kitDebuffs.resShred[element] ?? 0) + value
    }
    const debuffs = withGenshinExtraDebuffs(kitDebuffs, extraBuffs)
    return {
      characterId: character.id,
      characterLevel: character.level,
      element: character.element,
      rotation,
      talents,
      enemy,
      debuffs,
      // Lunar Reaction DMG from the team (Moonsign: Ascendant Gleam) adds to every Lunar kind
      reactionBonus: {
        ...resolvedCombat.reactions,
        // Bloom DMG from teammates (Nilou's Bountiful Cores)
        ...(teamResult.bloomBonus ? { bloom: (resolvedCombat.reactions.bloom ?? 0) + teamResult.bloomBonus } : {}),
        ...(teamResult.vaporizeBonus ? { vaporize: (resolvedCombat.reactions.vaporize ?? 0) + teamResult.vaporizeBonus } : {}),
        ...Object.fromEntries((['lunarcharged', 'lunarbloom', 'lunarcrystallize'] as const).map((kind) => [
          kind,
          (resolvedCombat.reactions[kind] ?? 0) + teamResult.lunarBonus,
        ])),
        // One kind's DMG Bonus from teammates (Baizhu, Mona, Ifa...)
        ...Object.fromEntries(
          Object.entries(teamResult.specialBonus).map(([kind, value]) => [
            kind,
            (resolvedCombat.reactions[kind as keyof typeof resolvedCombat.reactions] ?? 0)
            + (kind.startsWith('lunar') ? teamResult.lunarBonus : 0) + value,
          ]),
        ),
      },
      hitBuffs: resolvedCombat.hitBuffs,
      teamReactions: reactionsInTeam,
      baseBonus: teamResult.baseBonus,
      elevation: resolvedCombat.elevation,
      hitFlats: teamResult.hitFlats,
      reactionBonusPerEm: resolvedCombat.reactionsPerEm,
      reactionFlatPerEm: resolvedCombat.reactionFlats,
      specialFlat: teamResult.specialFlat,
      specialFlatHits: teamResult.specialFlatHits,
      specialCrit: teamResult.specialCrit,
      // Teammates who can trigger Stellar Swirl, ranked against for its contribution
      stellarContributors: teamResult.members
        .filter((member) => member.element === 'Anemo' || member.element === 'Cryo')
        .map((member) => stellarContribution(member.level, member.stats)),
    }
  }
  const damageSetup = damageSetupFor(teamResult)
  return { team, teamResult, teamBuffs, talents, reactionsInTeam, combat, resolvedCombat, damageSetupFor, damageSetup }
}
