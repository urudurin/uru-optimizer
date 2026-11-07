import { hasTalentData } from 'lib/games/genshin/damage/damage'
import {
  EffectsCard,
  EnemyCard,
  RotationCard,
} from 'lib/games/genshin/damage/DamageCards'
import type { GenshinImages } from 'lib/games/genshin/data/images'
import { GenshinTeamCards } from 'lib/games/genshin/GenshinTeamCards'
import { genshinDamageScore } from 'lib/games/genshin/optimizer/analysis'
import {
  genshinDamageDefaults,
  type GenshinDamageSettings,
  genshinDamageSetup,
} from 'lib/games/genshin/optimizer/damageSetup'
import type {
  Artifact,
  GenshinCharacter,
} from 'lib/games/genshin/types'
import { fourPieceSetsOf } from 'lib/games/shared/teammateOverrides'
import {
  CharacterScoringPanel,
  useCustomDamageSettings,
  useScoringMode,
} from 'lib/games/shared/ui/CharacterScoring'
import type { ReactNode } from 'react'

// The Genshin Characters page's DPS score (shared/ui/CharacterScoring.tsx): Custom is the character's
// genshin-optimizer-settings damage fields, Default the kit alone; the worn 4-piece counts in combat.
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
  const [mode, setMode] = useScoringMode('genshin', character.id)
  const [custom, updateCustom] = useCustomDamageSettings('genshin-optimizer-settings', character.id, genshinDamageDefaults(character.id))
  if (!hasTalentData(character.id) || worn.length < 5) return <>{fallback}</>

  const settings = mode === 'default' ? genshinDamageDefaults(character.id, character.constellation) : custom
  const fourPieceSet = fourPieceSetsOf(worn.map((a) => a.setId))[0]
  const setup = genshinDamageSetup(character, settings, fourPieceSet, { characters: roster, artifacts })
  const score = genshinDamageScore(character, worn, { kind: 'damage', setup: setup.damageSetup }, setup.teamBuffs, setup.combat)
  if (!score) return <>{fallback}</>

  // Editing the setup scores Custom, like changing a teammate on HSR's showcase
  const edit = (change: Partial<GenshinDamageSettings>) => {
    updateCustom(change)
    if (mode !== 'custom') setMode('custom')
  }
  const iconOf = (id: string) => images.characters[id.startsWith('Traveler') ? 'Traveler' : id]?.icon ?? images.characters[id]?.icon

  return (
    <CharacterScoringPanel
      name={character.name}
      score={score}
      mode={mode}
      onMode={setMode}
      slots={3}
      teammates={settings.teammates.map((id) => ({ id, name: roster.find((c) => c.id === id)?.name ?? id, icon: iconOf(id) }))}
      defaultText='Default: the kit alone, no team.'
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
