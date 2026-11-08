import { benchmarkBuilds } from 'lib/games/shared/damageScore'
import {
  type BenchmarksData,
  BenchmarksView,
} from 'lib/games/shared/ui/BenchmarksView'
import { useScoringSetup } from 'lib/games/shared/ui/CharacterScoring'
import { agentHits } from 'lib/games/zzz/damage/damage'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type { AgentData } from 'lib/games/zzz/data/dataTypes'
import { useZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import { useZzzImages } from 'lib/games/zzz/data/images'
import {
  type ZzzMetadata,
  zzzMetadata,
} from 'lib/games/zzz/data/metadata'
import { SETS } from 'lib/games/zzz/data/sets'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import { MAIN_STATS_BY_SLOT } from 'lib/games/zzz/discStats'
import {
  ZZZ_SCORE_PARAMS,
  zzzBenchmarkVariants,
  zzzDamageScore,
  zzzScoreInputs,
} from 'lib/games/zzz/optimizer/analysis'
import {
  zzzDamageDefaults,
  zzzDamageSetup,
  zzzScoringDefaults,
} from 'lib/games/zzz/optimizer/damageSetup'
import { zzzRoster } from 'lib/games/zzz/state/roster'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import {
  type Disc,
  type DiscSlot,
  type MainStatSlot,
  ZzzStats,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'
import { sMainValue } from 'lib/games/zzz/ui/discKind'
import { ZzzAgentSelect } from 'lib/games/zzz/ui/pickers'
import {
  useMemo,
  useState,
} from 'react'

const SLOTS: DiscSlot[] = [1, 2, 3, 4, 5, 6]
const FIXED_MAIN: Record<number, ZzzStatsValues> = { 1: ZzzStats.HP, 2: ZzzStats.ATK, 3: ZzzStats.DEF }

// Six +15 S-rank discs with no substats, for agents with nothing worn: the metadata's first listed main stat per slot,
// else the slot's best-weighted one; the first listed 4-piece + 2-piece
export function plainDiscs(metadata: ZzzMetadata): Disc[] {
  const mainFor = (slot: DiscSlot): ZzzStatsValues => {
    if (FIXED_MAIN[slot]) return FIXED_MAIN[slot]
    const listed = metadata.parts[slot]?.[0] as ZzzStatsValues | undefined
    if (listed) return listed
    const options = MAIN_STATS_BY_SLOT[slot as MainStatSlot]
    return options.reduce((a, b) => ((metadata.stats[b] ?? 0) > (metadata.stats[a] ?? 0) ? b : a))
  }
  const set = metadata.simulation?.sets[0] ?? (metadata.preset.sets[0] ? [metadata.preset.sets[0].fourPiece, metadata.preset.sets[0].twoPiece ?? ''] : [])
  return SLOTS.map((slot, index) => {
    const setId = (index < 4 ? set[0] : set[1]) || 'none'
    const stat = mainFor(slot)
    return {
      id: `benchmark-${slot}`,
      slot,
      setId,
      setName: SETS[setId]?.name ?? 'No set',
      rarity: 'S',
      level: 15,
      main: { stat, value: sMainValue(stat, 15) ?? 0 },
      substats: [],
      locked: false,
    }
  })
}

function wornSets(discs: Disc[]): { fourPieceSet?: string, twoPieceSet?: string } {
  const counts = new Map<string, number>()
  for (const disc of discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
  const sorted = [...counts].sort((a, b) => b[1] - a[1])
  const four = sorted.find(([, n]) => n >= 4)?.[0]
  const two = sorted.find(([id, n]) => n >= 2 && id !== four)?.[0]
  return { fourPieceSet: four, twoPieceSet: two }
}

const describeSets = (discs: Disc[]) => {
  const { fourPieceSet, twoPieceSet } = wornSets(discs)
  return [fourPieceSet && `4pc ${SETS[fourPieceSet]?.name ?? fourPieceSet}`, twoPieceSet && `2pc ${SETS[twoPieceSet]?.name ?? twoPieceSet}`]
    .filter(Boolean).join(' + ')
}

// ZZZ's Benchmarks page (shared/ui/BenchmarksView.tsx), after HSR's Benchmarks tab
export function ZzzBenchmarksPage() {
  const builds = useZzzStore((s) => s.builds)
  const discs = useZzzStore((s) => s.discs)
  const images = useZzzImages()
  const gameData = useZzzGameData()
  const roster = useMemo(() => zzzRoster(builds), [builds, gameData])
  const [picked, setPicked] = useState<string | null>(null)
  const agents = useMemo(() => Object.values(AGENTS).filter((agent) => agentHits(agent.id).length > 0), [gameData])
  const agent: AgentData | undefined = (picked ? AGENTS[picked] : undefined) ?? agents.find((a) => builds.some((b) => b.agentId === a.id)) ?? agents[0]
  const id = agent?.id ?? ''
  const scoring = useScoringSetup('zzz', id, zzzScoringDefaults(id), zzzDamageDefaults(id))
  const metadata = agent ? zzzMetadata(agent) : undefined
  const build = roster.find((b) => b.agentId === id)
  const worn = build ? Object.values(build.discIds).flatMap((discId) => discs.find((d) => d.id === discId) ?? []) : []

  const key = JSON.stringify([id, build, scoring.settings, worn.map((d) => d.id), metadata?.source, metadata?.simulation])
  const data = useMemo((): BenchmarksData | undefined => {
    if (!agent || !metadata || !build) return undefined
    const own = worn.length === 6
    const pieces = own ? worn : plainDiscs(metadata)
    const refinement = build.wEngineRefinement ?? 1
    const setup = zzzDamageSetup(agent, scoring.settings, { wEngineId: build.wEngineId ?? '', refinement, ...wornSets(pieces) }, true, {
      builds: roster,
      discs,
    })
    const input = {
      agent,
      wEngine: build.wEngineId ? W_ENGINES[build.wEngineId] : undefined,
      wEngineRefinement: refinement,
      coreSkillLevel: 6,
      conditions: scoring.settings.conditions,
      teamEffects: setup.combatEffects,
      discs: pieces,
    }
    const variants = zzzBenchmarkVariants(pieces, metadata.simulation)
    const inputs = zzzScoreInputs(input, setup.damageSetup, variants)
    if (!inputs) return undefined
    const result = benchmarkBuilds(inputs.input, ZZZ_SCORE_PARAMS, inputs.variants)
    const chosen = result.variant !== undefined ? variants[result.variant] : pieces
    return {
      builds: result,
      slots: chosen.map((d) => `Slot ${d.slot}`),
      sets: describeSets(chosen),
      basis: own
        ? `${agent.name}'s worn discs and W-Engine${variants.length > 0 ? ', with the metadata\'s sets and main stats' : ''}, Core Skill F.`
        : `A plain build (nothing worn): six +15 S-rank discs, ${build.wEngineId ? 'the saved W-Engine' : 'no W-Engine'}, Core Skill F.`,
      ...(own ? { current: { damage: inputs.input.score({}), score: zzzDamageScore(input, setup.damageSetup, variants) } } : {}),
    }
  }, [key, roster, discs])

  return (
    <BenchmarksView
      description='The builds a DPS score compares with: no useful substats (0%), the benchmark (100%) and a perfect build (200%), for any agent with skill data. The squad and rotation are the Agents page scoring setup.'
      picker={agent && <ZzzAgentSelect label='Agent' images={images} value={agent.id} onChange={setPicked} />}
      mode={scoring.mode}
      onMode={scoring.setMode}
      metadata={metadata}
      team={scoring.settings.teammates.map((mateId) => AGENTS[mateId]?.name ?? mateId)}
      data={data}
      emptyText='No agent with skill data to benchmark yet.'
      statLabel={(stat) => stat}
      unit='rolls'
    />
  )
}
