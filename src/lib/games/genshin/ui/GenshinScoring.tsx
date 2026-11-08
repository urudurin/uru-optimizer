import { hasTalentData } from 'lib/games/genshin/damage/damage'
import {
  EffectsCard,
  EnemyCard,
  RotationCard,
} from 'lib/games/genshin/damage/DamageCards'
import type { GenshinImages } from 'lib/games/genshin/data/images'
import { genshinMetadata } from 'lib/games/genshin/data/metadata'
import { GenshinTeamCards } from 'lib/games/genshin/GenshinTeamCards'
import { nameFromGoodKey } from 'lib/games/genshin/goodKeys'
import {
  genshinBenchmarkVariants,
  genshinDamageScore,
} from 'lib/games/genshin/optimizer/analysis'
import {
  genshinDamageDefaults,
  genshinDamageSetup,
  genshinScoringDefaults,
} from 'lib/games/genshin/optimizer/damageSetup'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import { genshinOverrideMembers } from 'lib/games/genshin/ui/teammateOverrideMembers'
import { fourPieceSetsOf } from 'lib/games/shared/teammateOverrides'
import {
  CharacterScoringPanel,
  useScoringSetup,
} from 'lib/games/shared/ui/CharacterScoring'
import { TeammateOverrideCard } from 'lib/games/shared/ui/optimizer/TeammateOverrideCard'
import type { ReactNode } from 'react'

// The Genshin Characters page's DPS score (shared/ui/CharacterScoring.tsx): Default is the character's metadata
// simulation or the kit alone, Custom their own scoring setup (genshin-scoring-overrides); the worn 4-piece counts in
// combat.
export function GenshinScoring({ character, worn, roster, artifacts, images, fallback }: {
  character: GenshinCharacter,
  // Five worn artifacts; fewer shows the fallback
  worn: Artifact[],
  // Every character (state/roster.ts), for teammates
  roster: GenshinCharacter[],
  artifacts: Artifact[],
  images: GenshinImages,
  // Shown when there's no DPS score (no talent data, not a full set): the gear score
  fallback: ReactNode,
}) {
  const scoring = useScoringSetup(
    'genshin',
    character.id,
    genshinScoringDefaults(character.id, character.constellation),
    genshinDamageDefaults(character.id, character.constellation),
  )
  if (!hasTalentData(character.id) || worn.length < 5) return <>{fallback}</>

  const { settings, custom, edit } = scoring
  const fourPieceSet = fourPieceSetsOf(worn.map((a) => a.setId))[0]
  const setup = genshinDamageSetup(character, settings, fourPieceSet, { characters: roster, artifacts })
  const score = genshinDamageScore(
    character,
    worn,
    { kind: 'damage', setup: setup.damageSetup },
    setup.teamBuffs,
    setup.combat,
    genshinBenchmarkVariants(worn, genshinMetadata(character.id).simulation),
  )
  if (!score) return <>{fallback}</>

  const iconOf = (id: string) => images.characters[id.startsWith('Traveler') ? 'Traveler' : id]?.icon ?? images.characters[id]?.icon

  return (
    <CharacterScoringPanel
      name={character.name}
      score={score}
      scoring={scoring}
      slots={3}
      teammates={settings.teammates.map((id) => ({ id, name: roster.find((c) => c.id === id)?.name ?? id, icon: iconOf(id) }))}
      defaultText={(genshinMetadata(character.id).simulation?.teammates.length ?? 0) > 0
        ? 'Default: the recommended team and rotation.'
        : 'Default: the kit alone, no team.'}
      setup={
        <>
          <GenshinTeamCards
            character={character}
            characters={roster}
            team={setup.team}
            result={setup.teamResult}
            onTeammates={(ids) => edit({ teammates: ids })}
            onField={(value) => edit({ onField: value })}
            onSetting={(key, value) => edit({ teamSettings: { ...custom.teamSettings, [key]: value } })}
          />
          <TeammateOverrideCard
            rankPrefix='C'
            weaponLabel='weapon'
            refinementPrefix='R'
            overrides={setup.team.overrides}
            onChange={(teammateOverrides) => edit({ teammateOverrides })}
            members={genshinOverrideMembers(character.id, custom.teammates, { characters: roster, artifacts, images, setName: nameFromGoodKey })}
          />
          <EnemyCard enemy={custom.enemy} debuffs={setup.damageSetup.debuffs} onChange={(enemy) => edit({ enemy })} />
          <RotationCard
            character={character}
            rotation={custom.rotation}
            talents={setup.talents}
            team={setup.reactionsInTeam}
            teamElements={setup.teamResult.members.flatMap((member) => member.element ?? [])}
            damage={score.damage}
            onChange={(rotation) => edit({ rotation })}
          />
          <EffectsCard
            name={character.name}
            fourPieceSet={fourPieceSet ? worn.find((a) => a.setId === fourPieceSet)?.setName ?? fourPieceSet : undefined}
            applied={setup.resolvedCombat.applied}
            onSetting={(id, value) => edit({ combatSettings: { ...custom.combatSettings, [id]: value } })}
          />
        </>
      }
    />
  )
}
