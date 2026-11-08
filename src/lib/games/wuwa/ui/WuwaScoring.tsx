import { keepOverridesFor } from 'lib/games/shared/teammateOverrides'
import {
  CharacterScoringPanel,
  useScoringSetup,
} from 'lib/games/shared/ui/CharacterScoring'
import { TeamCards } from 'lib/games/shared/ui/optimizer/TeamCards'
import { TeammateOverrideCard } from 'lib/games/shared/ui/optimizer/TeammateOverrideCard'
import { hasSkillData } from 'lib/games/wuwa/damage/damage'
import {
  EnemyCard,
  KitEffectsCard,
  RotationCard,
} from 'lib/games/wuwa/damage/DamageCards'
import {
  characterName,
  SONATA_SETS,
} from 'lib/games/wuwa/data/gameData'
import { wuwaMetadata } from 'lib/games/wuwa/data/metadata'
import type { ResonatorArt } from 'lib/games/wuwa/data/userArt'
import { wuwaDamageScore } from 'lib/games/wuwa/optimizer/analysis'
import {
  wuwaDamageDefaults,
  wuwaDamageSetup,
  wuwaScoringDefaults,
} from 'lib/games/wuwa/optimizer/damageSetup'
import { withFullSets } from 'lib/games/wuwa/optimizer/echoOptimizer'
import { setPieceCounts } from 'lib/games/wuwa/stats/computeStats'
import { wuwaTeamEntries } from 'lib/games/wuwa/team/teamEntries'
import type {
  CharacterState,
  Echo,
} from 'lib/games/wuwa/types'
import { wuwaOverrideMembers } from 'lib/games/wuwa/ui/teammateOverrideMembers'
import type { ReactNode } from 'react'

// The WuWa Resonators page's DPS score (shared/ui/CharacterScoring.tsx): Default is the Resonator's metadata
// simulation or the kit alone, Custom their own scoring setup (wuwa-scoring-overrides); the worn main echo and complete
// Sonata sets count.
export function WuwaScoring({ character, worn, roster, echoes, art, fallback }: {
  character: CharacterState,
  // The worn echoes; none shows the fallback
  worn: Echo[],
  // Every Resonator (state/roster.ts), for teammates
  roster: CharacterState[],
  echoes: Echo[],
  // Resonator art by id (data/userArt.ts), for the teammate portraits
  art: Record<string, ResonatorArt>,
  // Shown when there's no DPS score: the gear score
  fallback: ReactNode,
}) {
  const scoring = useScoringSetup('wuwa', character.charId, wuwaScoringDefaults(character.charId), wuwaDamageDefaults(character.charId))
  if (!hasSkillData(character.charId) || worn.length === 0) return <>{fallback}</>

  const { settings, custom, edit } = scoring
  // The Sonata sets the worn echoes complete
  const completeSets = [...setPieceCounts(worn)].filter(([id, count]) => count >= (SONATA_SETS[id]?.fullPieces ?? 5)).map(([id]) => id)
  const setup = wuwaDamageSetup(character, settings, completeSets, settings.rotation.echo?.id ?? worn[0]?.defId, true, { characters: roster, echoes })
  const score = wuwaDamageScore(
    character,
    worn,
    { kind: 'damage', setup: setup.damageSetup },
    withFullSets(setup.combatBonus, worn, setup.fullSetBonus),
  )
  if (!score) return <>{fallback}</>

  const name = characterName(character.charId)
  const teammateOptions = roster.filter((c) => c.charId !== character.charId).map((c) => ({ value: c.charId, label: characterName(c.charId) }))

  return (
    <CharacterScoringPanel
      name={name}
      score={score}
      scoring={scoring}
      slots={2}
      teammates={settings.teammates.map((id) => ({ id, name: characterName(id), icon: art[id]?.icon ?? art[id]?.portrait }))}
      defaultText={wuwaMetadata(character.charId).simulation ? 'Default: our team and rotation for this Resonator.' : 'Default: the kit alone, no team.'}
      setup={
        <>
          <TeamCards
            name={name}
            options={teammateOptions}
            teammates={custom.teammates}
            maxTeammates={2}
            entries={wuwaTeamEntries(setup.teamResult.applied)}
            description='Their skills buff this Resonator. Teammates use the echoes they wear in the save.'
            emptyText='Pick teammates to see what they give.'
            footnote='Teammates count at their saved Sequence and weapon unless changed below.'
            onTeammates={(ids) => edit({ teammates: ids })}
            onSetting={(key, value) => edit({ teamSettings: { ...custom.teamSettings, [key]: value } })}
          />
          <TeammateOverrideCard
            rankPrefix='S'
            weaponLabel='weapon'
            refinementPrefix='R'
            overrides={keepOverridesFor(custom.teammateOverrides, custom.teammates)}
            onChange={(teammateOverrides) => edit({ teammateOverrides })}
            members={wuwaOverrideMembers(character.charId, custom.teammates, roster)}
          />
          <EnemyCard enemy={custom.enemy} onChange={(enemy) => edit({ enemy })} />
          <RotationCard
            charId={character.charId}
            rotation={custom.rotation}
            mainEcho={worn[0]?.defId}
            damage={score.damage}
            onChange={(rotation) => edit({ rotation })}
          />
          <KitEffectsCard
            name={name}
            applied={setup.kit.applied}
            onSetting={(id, value) => edit({ combatSettings: { ...custom.combatSettings, [id]: value } })}
          />
          <KitEffectsCard
            name={name}
            title='Set effects'
            description='Full-set Sonata effects of the complete sets in the worn loadout.'
            emptyText='The worn loadout completes no set.'
            applied={setup.setEffects.applied}
            onSetting={(id, value) => edit({ combatSettings: { ...custom.combatSettings, [id]: value } })}
          />
        </>
      }
    />
  )
}
