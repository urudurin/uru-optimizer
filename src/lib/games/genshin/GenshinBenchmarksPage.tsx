import { hasTalentData } from 'lib/games/genshin/damage/damage'
import { useGenshinImages } from 'lib/games/genshin/data/images'
import {
  MAIN_STAT_OPTIONS,
  MAX_MAIN_VALUE,
} from 'lib/games/genshin/data/mainStatOptions'
import {
  type GenshinMetadata,
  genshinMetadata,
} from 'lib/games/genshin/data/metadata'
import { nameFromGoodKey } from 'lib/games/genshin/goodKeys'
import {
  GENSHIN_SCORE_PARAMS,
  genshinBenchmarkVariants,
  genshinDamageScore,
  genshinScoreInputs,
} from 'lib/games/genshin/optimizer/analysis'
import {
  genshinDamageDefaults,
  genshinDamageSetup,
  genshinScoringDefaults,
} from 'lib/games/genshin/optimizer/damageSetup'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import { genshinRoster } from 'lib/games/genshin/state/roster'
import {
  type Artifact,
  type ArtifactSlot,
  type GenshinCharacter,
  type GenshinStatKey,
  SLOT_LABELS,
  statLabel,
} from 'lib/games/genshin/types'
import { GenshinCharacterSelect } from 'lib/games/genshin/ui/pickers'
import { benchmarkBuilds } from 'lib/games/shared/damageScore'
import { fourPieceSetsOf } from 'lib/games/shared/teammateOverrides'
import {
  type BenchmarksData,
  BenchmarksView,
} from 'lib/games/shared/ui/BenchmarksView'
import { useScoringSetup } from 'lib/games/shared/ui/CharacterScoring'
import {
  useMemo,
  useState,
} from 'react'

const SLOTS: ArtifactSlot[] = ['flower', 'plume', 'sands', 'goblet', 'circlet']

// A plain set of five +20 5-star artifacts with no substats, for characters with nothing worn: the metadata's first
// listed main stat per slot, else the character's element DMG goblet, a CRIT Rate circlet when CRIT counts, or the
// slot's best-weighted main stat; the first listed set
export function plainArtifacts(character: GenshinCharacter, metadata: GenshinMetadata): Artifact[] {
  const mainFor = (slot: ArtifactSlot): GenshinStatKey => {
    if (slot === 'flower') return 'hp'
    if (slot === 'plume') return 'atk'
    const listed = metadata.parts[slot]?.[0] as GenshinStatKey | undefined
    if (listed) return listed
    if (slot === 'goblet' && character.element) return `${character.element.toLowerCase()}Dmg` as GenshinStatKey
    if (slot === 'circlet' && (metadata.stats.critRate ?? 0) > 0) return 'critRate'
    return MAIN_STAT_OPTIONS[slot].reduce((a, b) => ((metadata.stats[b] ?? 0) > (metadata.stats[a] ?? 0) ? b : a))
  }
  const set = metadata.simulation?.sets[0]
  return SLOTS.map((slot, index) => {
    const setId = set ? set.length === 1 ? (index < 4 ? set[0] : 'none') : set[Math.floor(index / 2)] ?? 'none' : 'none'
    const stat = mainFor(slot)
    return {
      id: `benchmark-${slot}`,
      slot,
      setId,
      setName: setId === 'none' ? 'No set' : nameFromGoodKey(setId),
      rarity: 5,
      level: 20,
      main: { stat, value: MAX_MAIN_VALUE[stat] ?? 0 },
      substats: [],
    }
  })
}

function describeSets(pieces: Artifact[], names: Map<string, string>): string {
  const counts = new Map<string, number>()
  for (const piece of pieces) if (piece.setId !== 'none') counts.set(piece.setId, (counts.get(piece.setId) ?? 0) + 1)
  return [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${n >= 4 ? 4 : 2}pc ${names.get(id) ?? nameFromGoodKey(id)}`).join(
    ' + ',
  )
}

// Genshin's Benchmarks page (shared/ui/BenchmarksView.tsx), after HSR's Benchmarks tab
export function GenshinBenchmarksPage() {
  const saved = useGenshinStore((s) => s.characters)
  const artifacts = useGenshinStore((s) => s.artifacts)
  const images = useGenshinImages()
  const roster = useMemo(() => genshinRoster(saved, images), [saved, images])
  const usable = useMemo(() => roster.filter((c) => hasTalentData(c.id)), [roster])
  const [picked, setPicked] = useState<string | null>(null)
  const character = usable.find((c) => c.id === picked) ?? usable[0]
  const id = character?.id ?? ''
  const constellation = character?.constellation ?? 0
  const scoring = useScoringSetup('genshin', id, genshinScoringDefaults(id, constellation), genshinDamageDefaults(id, constellation))
  const metadata = character ? genshinMetadata(id, constellation) : undefined
  const worn = character ? Object.values(character.artifactIds).flatMap((artifactId) => artifacts.find((a) => a.id === artifactId) ?? []) : []

  const key = JSON.stringify([character, scoring.settings, worn.map((a) => a.id), metadata?.source, metadata?.simulation])
  const data = useMemo((): BenchmarksData | undefined => {
    if (!character || !metadata) return undefined
    const own = worn.length === 5
    const pieces = own ? worn : plainArtifacts(character, metadata)
    const setup = genshinDamageSetup(character, scoring.settings, fourPieceSetsOf(pieces.map((a) => a.setId))[0], { characters: roster, artifacts })
    const target = { kind: 'damage' as const, setup: setup.damageSetup }
    const variants = genshinBenchmarkVariants(pieces, metadata.simulation)
    const inputs = genshinScoreInputs(character, pieces, target, setup.teamBuffs, setup.combat, variants)
    if (!inputs) return undefined
    const builds = benchmarkBuilds(inputs.input, GENSHIN_SCORE_PARAMS, inputs.variants)
    const chosen = builds.variant !== undefined ? variants[builds.variant] : pieces
    return {
      builds,
      slots: chosen.map((a) => SLOT_LABELS[a.slot]),
      sets: describeSets(chosen, new Map(artifacts.map((a) => [a.setId, a.setName]))),
      basis: own
        ? `${character.name}'s worn artifacts${variants.length > 0 ? ', with the metadata\'s sets and main stats' : ''}.`
        : 'A plain build (nothing worn): five +20 5-star artifacts.',
      ...(own
        ? { current: { damage: inputs.input.score({}), score: genshinDamageScore(character, worn, target, setup.teamBuffs, setup.combat, variants) } }
        : {}),
    }
  }, [key, roster, artifacts])

  return (
    <BenchmarksView
      description='The builds a DPS score compares with: no useful substats (0%), the benchmark (100%) and a perfect build (200%), for any character with talent data. The team and rotation are the Characters page scoring setup.'
      picker={character && <GenshinCharacterSelect label='Character' characters={usable} images={images} value={character.id} onChange={setPicked} />}
      mode={scoring.mode}
      onMode={scoring.setMode}
      metadata={metadata}
      team={scoring.settings.teammates.map((mateId) => roster.find((c) => c.id === mateId)?.name ?? nameFromGoodKey(mateId))}
      data={data}
      emptyText='No character with talent data to benchmark.'
      statLabel={statLabel}
      unit='rolls'
    />
  )
}
