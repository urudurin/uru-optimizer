import { benchmarkBuilds } from 'lib/games/shared/damageScore'
import {
  type BenchmarksData,
  BenchmarksView,
} from 'lib/games/shared/ui/BenchmarksView'
import { useScoringSetup } from 'lib/games/shared/ui/CharacterScoring'
import { hasSkillData } from 'lib/games/wuwa/damage/damage'
import {
  characterName,
  SONATA_SETS,
} from 'lib/games/wuwa/data/gameData'
import {
  type WuwaMetadata,
  wuwaMetadata,
} from 'lib/games/wuwa/data/metadata'
import { useUserArt } from 'lib/games/wuwa/data/userArt'
import { MAIN_STAT_MAX } from 'lib/games/wuwa/echoStats'
import {
  WUWA_SCORE_PARAMS,
  wuwaBenchmarkVariants,
  wuwaDamageScore,
  wuwaScoreInputs,
} from 'lib/games/wuwa/optimizer/analysis'
import {
  wuwaDamageDefaults,
  wuwaDamageSetup,
  wuwaScoringDefaults,
} from 'lib/games/wuwa/optimizer/damageSetup'
import { withFullSets } from 'lib/games/wuwa/optimizer/echoOptimizer'
import { wuwaRoster } from 'lib/games/wuwa/state/roster'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import { setPieceCounts } from 'lib/games/wuwa/stats/computeStats'
import {
  type Cost,
  type Echo,
  type StatKey,
  statLabel,
} from 'lib/games/wuwa/types'
import { WuwaCharacterSelect } from 'lib/games/wuwa/ui/pickers'
import {
  useMemo,
  useState,
} from 'react'

// The usual 12-cost loadout
const COSTS: Cost[] = [4, 3, 3, 1, 1]

// Five +25 echoes with no substats, for Resonators with nothing worn: the metadata's first listed main stat per cost,
// else the cost's best-weighted one; the first listed set on every echo
export function plainEchoes(metadata: WuwaMetadata): Echo[] {
  const set = metadata.simulation?.sets[0]?.[0] ?? ''
  return COSTS.map((cost, index) => {
    const listed = metadata.parts[String(cost)]?.[0] as StatKey | undefined
    const options = Object.keys(MAIN_STAT_MAX[cost]) as StatKey[]
    const mainStat = listed ?? options.reduce((a, b) => ((metadata.stats[b] ?? 0) > (metadata.stats[a] ?? 0) ? b : a))
    // Distinct echoes, so a set counts every piece
    return { id: `benchmark-${index}`, defId: `benchmark-${index}`, cost, setId: set, mainStat, level: 25, substats: [] }
  })
}

const describeSets = (echoes: Echo[]) =>
  [...setPieceCounts(echoes)].filter(([, n]) => n >= 2).map(([id, n]) => `${n}pc ${SONATA_SETS[id]?.name ?? id}`).join(' + ')

// WuWa's Benchmarks page (shared/ui/BenchmarksView.tsx), after HSR's Benchmarks tab
export function WuwaBenchmarksPage() {
  const saved = useWuwaStore((s) => s.characters)
  const echoes = useWuwaStore((s) => s.echoes)
  const art = useUserArt()
  const roster = useMemo(() => wuwaRoster(saved), [saved])
  const usable = useMemo(() => roster.filter((c) => hasSkillData(c.charId)), [roster])
  const [picked, setPicked] = useState<string | null>(null)
  const character = usable.find((c) => c.charId === picked) ?? usable[0]
  const id = character?.charId ?? ''
  const scoring = useScoringSetup('wuwa', id, wuwaScoringDefaults(id), wuwaDamageDefaults(id))
  const metadata = character ? wuwaMetadata(id) : undefined
  const worn = character ? character.echoIds.flatMap((echoId) => echoes.find((e) => e.id === echoId) ?? []) : []

  const key = JSON.stringify([character, scoring.settings, worn.map((e) => e.id), metadata?.source, metadata?.simulation])
  const data = useMemo((): BenchmarksData | undefined => {
    if (!character || !metadata) return undefined
    const own = worn.length > 0
    const pieces = own ? worn : plainEchoes(metadata)
    const complete = [...setPieceCounts(pieces)].filter(([setId, n]) => n >= (SONATA_SETS[setId]?.fullPieces ?? 5)).map(([setId]) => setId)
    const setup = wuwaDamageSetup(character, scoring.settings, complete, scoring.settings.rotation.echo?.id ?? pieces[0]?.defId, true, {
      characters: roster,
      echoes,
    })
    const target = { kind: 'damage' as const, setup: setup.damageSetup }
    const teamBonus = withFullSets(setup.combatBonus, pieces, setup.fullSetBonus)
    const variants = wuwaBenchmarkVariants(pieces, metadata.simulation)
    const inputs = wuwaScoreInputs(character, pieces, target, teamBonus, variants)
    if (!inputs) return undefined
    const builds = benchmarkBuilds(inputs.input, WUWA_SCORE_PARAMS, inputs.variants)
    const chosen = builds.variant !== undefined ? variants[builds.variant] : pieces
    return {
      builds,
      slots: chosen.map((e) => `Cost ${e.cost}`),
      sets: describeSets(chosen),
      basis: own
        ? `${characterName(id)}'s worn echoes${variants.length > 0 ? ', with the metadata\'s sets and main stats' : ''}.`
        : 'A plain build (nothing worn): five +25 echoes, cost 4-3-3-1-1.',
      ...(own ? { current: { damage: inputs.input.score({}), score: wuwaDamageScore(character, worn, target, teamBonus, variants) } } : {}),
    }
  }, [key, roster, echoes])

  return (
    <BenchmarksView
      description='The builds a DPS score compares with: no useful substats (0%), the benchmark (100%) and a perfect build (200%), for any Resonator with skill data. The team and rotation are the Resonators page scoring setup.'
      picker={character && <WuwaCharacterSelect label='Resonator' characters={usable} art={art} value={id} onChange={setPicked} />}
      mode={scoring.mode}
      onMode={scoring.setMode}
      metadata={metadata}
      team={scoring.settings.teammates.map(characterName)}
      data={data}
      emptyText='No Resonator with skill data to benchmark.'
      statLabel={statLabel}
      unit='rolls'
    />
  )
}
