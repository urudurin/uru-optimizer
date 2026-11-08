import {
  CharacterScoringPanel,
  useScoringSetup,
} from 'lib/games/shared/ui/CharacterScoring'
import { TeamCards } from 'lib/games/shared/ui/optimizer/TeamCards'
import { TeammateOverrideCard } from 'lib/games/shared/ui/optimizer/TeammateOverrideCard'
import {
  EnemyCard,
  KitEffectsCard,
  RotationCard,
} from 'lib/games/zzz/damage/DamageCards'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type {
  AgentData,
  WEngineData,
} from 'lib/games/zzz/data/dataTypes'
import type { ZzzImages } from 'lib/games/zzz/data/images'
import { zzzMetadata } from 'lib/games/zzz/data/metadata'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  zzzBenchmarkVariants,
  zzzDamageScore,
} from 'lib/games/zzz/optimizer/analysis'
import {
  zzzDamageDefaults,
  zzzDamageSetup,
  zzzScoringDefaults,
} from 'lib/games/zzz/optimizer/damageSetup'
import { zzzTeamEntries } from 'lib/games/zzz/team/teamEntries'
import type { Disc } from 'lib/games/zzz/types'
import { zzzOverrideMembers } from 'lib/games/zzz/ui/teammateOverrideMembers'
import type { ReactNode } from 'react'

// The 4-piece and 2-piece sets some discs complete (the most pieces first)
function wornSets(discs: Disc[]): { fourPieceSet?: string, twoPieceSet?: string } {
  const counts = new Map<string, number>()
  for (const disc of discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
  const sorted = [...counts].sort((a, b) => b[1] - a[1])
  const four = sorted.find(([, n]) => n >= 4)?.[0]
  const two = sorted.find(([id, n]) => n >= 2 && id !== four)?.[0]
  return { fourPieceSet: four, twoPieceSet: two }
}

// The ZZZ Agents page's DPS score (shared/ui/CharacterScoring.tsx): Default is the agent's metadata simulation or the
// kit alone (no squad, stat screen conditions), Custom their own scoring setup (zzz-scoring-overrides); the build's
// W-Engine and worn sets count.
export function ZzzScoring({ agent, wEngine, build, worn, coreSkill, roster, discs, images, fallback }: {
  agent: AgentData,
  wEngine?: WEngineData,
  build: ImportedBuild,
  // Six worn discs; fewer shows the fallback
  worn: Disc[],
  coreSkill: number,
  // Every agent's build (state/roster.ts), for teammates
  roster: ImportedBuild[],
  discs: Disc[],
  images: ZzzImages,
  // Shown when there's no DPS score: the gear score
  fallback: ReactNode,
}) {
  const scoring = useScoringSetup('zzz', agent.id, zzzScoringDefaults(agent.id), zzzDamageDefaults(agent.id))
  if (worn.length < 6) return <>{fallback}</>

  const { settings, custom, edit } = scoring
  const gear = { wEngineId: build.wEngineId ?? '', refinement: build.wEngineRefinement ?? 1, ...wornSets(worn) }
  const setup = zzzDamageSetup(agent, settings, gear, true, { builds: roster, discs })
  const input = {
    agent,
    wEngine,
    wEngineRefinement: build.wEngineRefinement ?? 1,
    coreSkillLevel: coreSkill,
    conditions: settings.conditions,
    teamEffects: setup.combatEffects,
    discs: worn,
  }
  const score = zzzDamageScore(input, setup.damageSetup, zzzBenchmarkVariants(worn, zzzMetadata(agent).simulation))
  if (!score) return <>{fallback}</>

  const teammateOptions = [...new Map(roster.filter((b) => b.agentId !== agent.id && AGENTS[b.agentId]).map((b) => [b.agentId, b.name]))]
    .map(([value, label]) => ({ value, label }))
  const nameOf = (id: string) => teammateOptions.find((o) => o.value === id)?.label ?? AGENTS[id]?.name ?? id

  return (
    <CharacterScoringPanel
      name={agent.name}
      score={score}
      scoring={scoring}
      slots={2}
      teammates={settings.teammates.map((id) => ({ id, name: nameOf(id), icon: images.agents[id]?.circle }))}
      defaultText={(zzzMetadata(agent).simulation?.teammates.length ?? 0) > 0
        ? 'Default: the recommended squad and rotation.'
        : 'Default: the kit alone, no squad.'}
      setup={
        <>
          <TeamCards
            name={agent.name}
            options={teammateOptions}
            teammates={custom.teammates}
            maxTeammates={2}
            entries={zzzTeamEntries(setup.teamResult.applied)}
            notice={setup.teamResult.missing.length > 0 ? `No stat screen for ${setup.teamResult.missing.join(', ')}: save a build for them first` : undefined}
            description='Their kits and 4-piece sets buff this agent. Teammates use the discs and W-Engine in their saved build.'
            emptyText='Pick teammates to see what they give.'
            footnote='Givers are taken at skill level 12 and Core Skill F.'
            onTeammates={(ids) => edit({ teammates: ids })}
            onSetting={(key, value) => edit({ teamSettings: { ...custom.teamSettings, [key]: value } })}
          />
          <TeammateOverrideCard
            rankPrefix='M'
            weaponLabel='W-Engine'
            refinementPrefix='R'
            overrides={setup.team.overrides}
            onChange={(teammateOverrides) => edit({ teammateOverrides })}
            members={zzzOverrideMembers(agent.id, custom.teammates, roster, discs)}
          />
          <EnemyCard enemy={custom.enemy} debuffs={setup.teamResult.debuffs} teamElements={setup.teamElements} onChange={(enemy) => edit({ enemy })} />
          <RotationCard
            agentId={agent.id}
            element={agent.element}
            teamElements={setup.teamElements}
            scaling={agent.specialty === 'Rupture' ? 'Sheer Force' : agent.specialty === 'Armorer' ? 'DEF' : 'ATK'}
            rotation={custom.rotation}
            damage={score.damage}
            onChange={(rotation) => edit({ rotation })}
          />
          <KitEffectsCard
            name={agent.name}
            applied={setup.kit.applied}
            onSetting={(id, value) => edit({ combatSettings: { ...custom.combatSettings, [id]: value } })}
          />
        </>
      }
    />
  )
}
