import {
  Badge,
  Group,
  MultiSelect,
  Select,
  Text,
} from '@mantine/core'
import {
  type DamagePart,
  splitDamage,
} from 'lib/games/shared/damageBreakdown'
import { formatNumber } from 'lib/games/shared/format'
import {
  type FilterCause,
  optionCandidates,
  type PoolCandidate,
  poolCauses,
  statLimitCauses,
} from 'lib/games/shared/noResults'
import {
  fieldSetter,
  migrateOptimizerSettings,
} from 'lib/games/shared/optimizerSettings'
import {
  rollsFromTotals,
  type StatSimulation,
  substatTotals,
} from 'lib/games/shared/statSimulation'
import { keepOverridesFor } from 'lib/games/shared/teammateOverrides'
import {
  BuildAnalysis,
  pinnedCells,
  type StatDiffRow,
} from 'lib/games/shared/ui/BuildAnalysis'
import {
  DPS_SCORE_LABEL,
  RememberDamageScore,
} from 'lib/games/shared/ui/BuildRating'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import { BuildPreview } from 'lib/games/shared/ui/optimizer/BuildPreview'
import {
  CharacterPortrait,
  RankButtons,
} from 'lib/games/shared/ui/optimizer/CharacterPanel'
import { ExtraBuffsCard } from 'lib/games/shared/ui/optimizer/ExtraBuffsCard'
import {
  GameOptimizerPage,
  type OptimizerData,
  type OptimizerPageKind,
  type OptimizerView,
  type OptimizerViewContext,
} from 'lib/games/shared/ui/optimizer/GameOptimizerPage'
import { KitDisclaimer } from 'lib/games/shared/ui/optimizer/KitDisclaimer'
import { OptimizerOptionsCard } from 'lib/games/shared/ui/optimizer/OptimizerOptionsCard'
import {
  DEFAULT_RESULT_LIMIT,
  resultLimitOf,
  ResultLimitSelect,
} from 'lib/games/shared/ui/optimizer/ResultLimit'
import { SetPicker } from 'lib/games/shared/ui/optimizer/SetPicker'
import {
  limitsSummary,
  StatFilters,
} from 'lib/games/shared/ui/optimizer/StatFilters'
import { StatSimulationCard } from 'lib/games/shared/ui/optimizer/StatSimulationCard'
import { TeamCards } from 'lib/games/shared/ui/optimizer/TeamCards'
import { TeammateOverrideCard } from 'lib/games/shared/ui/optimizer/TeammateOverrideCard'
import {
  type OptimizerKind,
  useBuildActions,
  useExcludeOwners,
} from 'lib/games/shared/ui/optimizer/useBuildActions'
import {
  FormCard,
  FormRow,
  FormRows,
} from 'lib/games/shared/ui/OptimizerForm'
import { KIT_EFFECTS } from 'lib/games/wuwa/damage/combatEffects'
import {
  type DamageSetup,
  hasSkillData,
  migrateRotationCounts,
  type Rotation,
  rotationDamage,
  rotationLines,
  singleLineRotation,
} from 'lib/games/wuwa/damage/damage'
import {
  EnemyCard,
  KitEffectsCard,
  RotationCard,
} from 'lib/games/wuwa/damage/DamageCards'
import { CHARACTER_INFO } from 'lib/games/wuwa/data/characters'
import {
  characterName,
  CHARACTERS,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import { wuwaMetadata } from 'lib/games/wuwa/data/metadata'
import { wuwaSampleData } from 'lib/games/wuwa/data/sampleData'
import { useUserArt } from 'lib/games/wuwa/data/userArt'
import { SUBSTAT_KEYS } from 'lib/games/wuwa/echoStats'
import { MAIN_STAT_MAX } from 'lib/games/wuwa/echoStats'
import {
  WUWA_SIM_ROLLS,
  wuwaSimulatedStats,
} from 'lib/games/wuwa/optimizer/analysis'
import {
  wuwaDamageScore,
  wuwaSubstatUpgrades,
} from 'lib/games/wuwa/optimizer/analysis'
import {
  wuwaDamageDefaults,
  type WuwaDamageSettings,
  wuwaDamageSetup,
} from 'lib/games/wuwa/optimizer/damageSetup'
import { scoreStats } from 'lib/games/wuwa/optimizer/echoOptimizer'
import {
  countLoadouts,
  type EchoOutcome,
  type EchoTarget,
  filterPool,
  targetLabel,
  withFullSets,
  wuwaStatLabel,
} from 'lib/games/wuwa/optimizer/echoOptimizer'
import { echoSearch } from 'lib/games/wuwa/optimizer/optimizerClient'
import {
  WUWA_SETTINGS_KEY as SETTINGS_KEY,
  WUWA_TARGETS as TARGETS,
  wuwaTarget,
} from 'lib/games/wuwa/optimizer/targets'
import { wuwaRoster } from 'lib/games/wuwa/state/roster'
import { wuwaPiecesTaken } from 'lib/games/wuwa/state/wuwaState'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import {
  computeWuwaStats,
  setPieceCounts,
  toDisplayStats,
  type WuwaStats,
} from 'lib/games/wuwa/stats/computeStats'
import {
  scoreEcho,
  wuwaBuildScore,
  wuwaEchoWeights,
} from 'lib/games/wuwa/stats/echoScore'
import { WUWA_EXTRA_BUFFS } from 'lib/games/wuwa/team/extraBuffs'
import {
  wuwaTeamEntries,
  wuwaTeamSummary,
} from 'lib/games/wuwa/team/teamEntries'
import {
  type CharacterState,
  type Cost,
  type Echo,
  MAX_ECHO_LEVEL,
  MAX_LOADOUT_COST,
  type SavedTeam,
  type StatKey,
  statLabel,
} from 'lib/games/wuwa/types'
import {
  EchoCard,
  elementColor,
  elementName,
  setName,
} from 'lib/games/wuwa/ui/EchoCard'
import {
  WuwaCharacterSelect,
  WuwaWeaponSelect,
} from 'lib/games/wuwa/ui/pickers'
import { WEAPON_OPTIONS } from 'lib/games/wuwa/ui/ResonatorForm'
import { wuwaStatRows } from 'lib/games/wuwa/ui/resonatorStats'
import { useMemo } from 'react'

const COSTS: Cost[] = [4, 3, 1]
const SHOWN_STATS: (keyof WuwaStats)[] = ['hp', 'atk', 'def', 'critRate', 'critDmg', 'energyRegen', 'elementDmg']
const MIN_STATS: (keyof WuwaStats)[] = ['energyRegen', 'critRate', 'critDmg', 'atk', 'hp', 'def', 'elementDmg']
const FLAT_STATS = new Set<keyof WuwaStats>(['hp', 'atk', 'def'])

// One stat value as the overview screen rounds it: down
function formatValue(stat: keyof WuwaStats, value: number): string {
  return FLAT_STATS.has(stat) ? formatNumber(Math.floor(value + 1e-6)) : `${Math.floor(value * 10 + 1e-6) / 10}%`
}

function formatScore(target: EchoTarget, score: number): string {
  if (target.kind === 'stat') return FLAT_STATS.has(target.stat) ? formatNumber(Math.floor(score)) : `${score.toFixed(1)}%`
  return target.kind === 'critValue' ? score.toFixed(1) : formatNumber(Math.round(score))
}

function describeSets(echoes: Echo[]): string {
  const sets = [...setPieceCounts(echoes)].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1])
  // Only different echoes count, and a set has its 2-piece and full (5, or 3) tiers only, so name the tier that's on
  return sets.length > 0
    ? sets.map(([id, count]) => {
      const full = SONATA_SETS[id]?.fullPieces ?? 5
      if (count >= full) return `${full}pc ${setName(id)}`
      return `2pc ${setName(id)}${count > 2 ? ` (${count} of ${full} different echoes, no full set)` : ''}`
    }).join(' + ')
    : 'No set bonus'
}

function costOf(echoes: Echo[]): number {
  return echoes.reduce((sum, echo) => sum + echo.cost, 0)
}

// The optimizer settings saved per Resonator: the damage setup (optimizer/damageSetup.ts) plus the search's own
type WuwaOptimizerSettings = WuwaDamageSettings & {
  targetValue: string,
  mainStats: Partial<Record<Cost, StatKey[]>>,
  fullSet: string | null,
  twoPieceSets: string[],
  excludeEquippedByOthers: boolean,
  // HSR's character priority filter: leave out gear worn by characters ranked above (shared/characterPriority.ts)
  priorityFilter: boolean,
  // HSR's Keep current, Min enhance, Min rarity and Boost main stat (Optimizer options)
  keepCurrent: boolean,
  minLevel: number,
  minRarity: number,
  boostMain: boolean,
  resultLimit: number,
  minStats: Partial<Record<keyof WuwaStats, number>>,
  maxStats: Partial<Record<keyof WuwaStats, number>>,
  // Stat simulation (shared/statSimulation.ts)
  simulations: StatSimulation[],
}

// Rank by values: 'damage' plus the stat targets in optimizer/targets.ts
const DAMAGE_TARGET = 'damage'

// What a Resonator starts with before their settings are changed (and saved)
function defaultSettings(charId: string): WuwaOptimizerSettings {
  return {
    // The default rank from the Resonator's metadata (data/metadata.ts)
    targetValue: wuwaMetadata(charId).sortOption,
    mainStats: {},
    fullSet: null,
    twoPieceSets: [],
    excludeEquippedByOthers: true,
    priorityFilter: false,
    keepCurrent: false,
    minLevel: 0,
    minRarity: 0,
    boostMain: false,
    resultLimit: DEFAULT_RESULT_LIMIT,
    minStats: {},
    maxStats: {},
    ...wuwaDamageDefaults(charId),
    simulations: [],
  }
}

// One-time changes to saves from older versions: Resonators still on the old default move to Rotation damage, and saved
// rotations switch from position keys to name keys
function migrateSaves() {
  migrateOptimizerSettings(
    SETTINGS_KEY,
    'rank-by-rotation-damage',
    (id, saved) => (saved.targetValue === 'avg:atk' && hasSkillData(id) ? { ...saved, targetValue: DAMAGE_TARGET } : saved),
  )
  migrateOptimizerSettings(SETTINGS_KEY, 'rotation-name-keys', (characterId: string, saved: Record<string, unknown>) => {
    const rotation = saved.rotation
    if (typeof rotation !== 'object' || rotation === null || !('counts' in rotation)) return saved
    const counts = (rotation as { counts: Record<string, number> }).counts
    return { ...saved, rotation: { ...rotation, counts: migrateRotationCounts(characterId, counts) } }
  })
}

// Each rotation line's share of a loadout's damage, for the build analysis
function wuwaBreakdown(setup: DamageSetup, stats: WuwaStats): DamagePart[] {
  return splitDamage(
    rotationLines(setup.charId, setup.rotation),
    (line) => rotationDamage(stats, { ...setup, rotation: singleLineRotation(setup.rotation, line) }),
  )
}

// What the shared optimizer parts need to know about this game's gear (shared/ui/optimizer/useBuildActions.ts)
const WUWA_OPTIMIZER_KIND: OptimizerKind<Echo> = {
  game: 'wuwa',
  buildNoun: 'loadout',
  describeSets,
  takenNote: (_, swap) =>
    swap ? 'will get echoes of the same cost this Resonator drops, where there are some' : 'will lose the echoes this loadout takes (Settings: replace)',
}

type WuwaResult = { outcome: EchoOutcome, ms: number, target: EchoTarget }
type WuwaOptimizerData = OptimizerData<CharacterState, Echo> & { teams: SavedTeam[], priority: string[] }

function useWuwaOptimizerData(): WuwaOptimizerData {
  const echoes = useWuwaStore((s) => s.echoes)
  const savedCharacters = useWuwaStore((s) => s.characters)
  const teams = useWuwaStore((s) => s.teams)
  const priority = useWuwaStore((s) => s.priority)
  // Every Resonator, saved or not (state/roster.ts)
  const characters = useMemo(() => wuwaRoster(savedCharacters), [savedCharacters])
  return { characters, gear: echoes, teams, priority }
}

// The WuWa optimizer on the shared page (shared/ui/optimizer/GameOptimizerPage.tsx)
const WUWA_PAGE_KIND: OptimizerPageKind<CharacterState, Echo, WuwaOptimizerSettings, WuwaResult, typeof echoSearch, WuwaOptimizerData> = {
  ...WUWA_OPTIMIZER_KIND,
  settingsKey: SETTINGS_KEY,
  gearNoun: 'echoes',
  description:
    'Searches your echoes for the loadouts (up to 5 echoes, 12 cost) that score highest, with stats worked out like the Resonators page. Rotation damage counts skill multipliers, what each hit counts as, and the enemy; set minimums (such as Energy Regen) for anything else the Resonator needs.',
  importText: 'Import your WuwaEchoScorer save, then search your echoes for the best loadout under the 12-cost limit.',
  loadSample: () => useWuwaStore.getState().importParsed(wuwaSampleData(), 'replace'),
  migrateSaves,
  runner: echoSearch,
  useData: useWuwaOptimizerData,
  idOf: (character) => character.charId,
  nameOf: (character) => characterName(character.charId),
  defaultSettings: (charId) => defaultSettings(charId),
  equip: (character, pieces) => useWuwaStore.getState().equip(character, pieces),
  useView: useWuwaOptimizerView,
}

export function WuwaOptimizerPage({ onImport }: { onImport: () => void }) {
  return <GameOptimizerPage kind={WUWA_PAGE_KIND} onImport={onImport} />
}

function useWuwaOptimizerView({ character, data, settings, update: updateSettings, openCharacter, search, statView, buildActions }: OptimizerViewContext<
  CharacterState,
  Echo,
  WuwaOptimizerSettings,
  WuwaResult,
  typeof echoSearch,
  WuwaOptimizerData
>): OptimizerView {
  const { gear: echoes, characters, teams, priority } = data
  const art = useUserArt()
  const saveCharacter = useWuwaStore((s) => s.saveCharacter)
  const { running, result, setResult, selected, setSelected } = search

  const {
    targetValue,
    mainStats,
    fullSet,
    twoPieceSets,
    excludeEquippedByOthers,
    priorityFilter,
    keepCurrent,
    minLevel,
    minRarity,
    boostMain,
    resultLimit,
    minStats,
    maxStats,
    teammates,
    teamSettings,
    teammateOverrides,
    extraBuffs,
    enemy,
    rotation,
    simulations,
    combatSettings,
  } = settings
  const setTargetValue = fieldSetter(updateSettings, 'targetValue')
  const setMainStats = fieldSetter(updateSettings, 'mainStats')
  const setFullSet = fieldSetter(updateSettings, 'fullSet')
  const setTwoPieceSets = fieldSetter(updateSettings, 'twoPieceSets')
  const setExcludeEquippedByOthers = fieldSetter(updateSettings, 'excludeEquippedByOthers')
  const setPriorityFilter = fieldSetter(updateSettings, 'priorityFilter')
  const setKeepCurrent = fieldSetter(updateSettings, 'keepCurrent')
  const setMinLevel = fieldSetter(updateSettings, 'minLevel')
  const setMinRarity = fieldSetter(updateSettings, 'minRarity')
  const setBoostMain = fieldSetter(updateSettings, 'boostMain')
  // Gear worn by characters ranked above is left out when the priority filter is on (and worn gear is otherwise allowed)
  const rosterIds = useMemo(() => characters.map((c) => c.charId), [characters])
  const excludeOwners = useExcludeOwners('wuwa', rosterIds, character?.charId ?? '', priorityFilter, excludeEquippedByOthers)
  const setResultLimit = fieldSetter(updateSettings, 'resultLimit')
  const setMinStats = fieldSetter(updateSettings, 'minStats')
  const setMaxStats = fieldSetter(updateSettings, 'maxStats')
  const setTeammates = fieldSetter(updateSettings, 'teammates')
  const setTeamSettings = fieldSetter(updateSettings, 'teamSettings')
  const setTeammateOverrides = fieldSetter(updateSettings, 'teammateOverrides')
  const setExtraBuffs = fieldSetter(updateSettings, 'extraBuffs')
  const setEnemy = fieldSetter(updateSettings, 'enemy')
  const setRotation = fieldSetter(updateSettings, 'rotation')
  const setCombatSettings = fieldSetter(updateSettings, 'combatSettings')
  const setSimulations = fieldSetter(updateSettings, 'simulations')
  const teammateOptions = characters.filter((c) => c.charId !== character?.charId).map((c) => ({ value: c.charId, label: characterName(c.charId) }))
  const ownerOf = useMemo(() => {
    const owners = new Map<string, string>()
    for (const c of characters) for (const id of c.echoIds) if (id) owners.set(id, characterName(c.charId))
    return owners
  }, [characters])
  const setOptions = useMemo(
    () => [...new Set(echoes.map((e) => e.setId))].map((id) => ({ value: id, label: setName(id) })).sort((a, b) => a.label.localeCompare(b.label)),
    [echoes],
  )

  const byDamage = targetValue === DAMAGE_TARGET && hasSkillData(character.charId)
  const wornEchoes = character.echoIds.flatMap((id) => echoes.find((e) => e.id === id) ?? [])
  // Full-set Sonata effects: every set's bonus goes to the search (loadouts that complete it get it); the card shows the
  // Full set filter's set and the complete sets in the current and picked loadouts
  const completeSets = (list: Echo[]) => [...setPieceCounts(list)].filter(([id, count]) => count >= (SONATA_SETS[id]?.fullPieces ?? 5)).map(([id]) => id)
  const pickedEchoes = result?.outcome.ok ? result.outcome.builds[selected]?.echoes ?? [] : []
  const shownSets = [...new Set([...(fullSet ? [fullSet] : []), ...completeSets(wornEchoes), ...completeSets(pickedEchoes)])]
  // What the team gives this Resonator and the damage setup, the same for every loadout (optimizer/damageSetup.ts)
  const { teamResult, kit, combatBonus, teamBonus, setEffects, fullSetBonus, damageSetup } = wuwaDamageSetup(
    character,
    settings,
    shownSets,
    rotation.echo?.id ?? wornEchoes[0]?.defId,
    byDamage,
    { characters, echoes },
  )
  const target: EchoTarget = byDamage ? { kind: 'damage', setup: damageSetup } : wuwaTarget(targetValue)
  // The current loadout's rotation damage, for the Rotation card
  const currentDamage = hasSkillData(character.charId) && wornEchoes.length > 0
    ? rotationDamage(computeWuwaStats(character, wornEchoes, withFullSets(combatBonus, wornEchoes, fullSetBonus)).stats, damageSetup)
    : undefined
  // The current loadout's DPS score when ranking by damage (shared/damageScore.ts), kept for the Resonators page
  const currentDpsScore = byDamage ? wuwaDamageScore(character, wornEchoes, target, withFullSets(combatBonus, wornEchoes, fullSetBonus)) : undefined
  // A complete 5-piece set leaves no room for a 2-piece set, a 3-piece set leaves room for one
  const fullSetPieces = fullSet ? (SONATA_SETS[fullSet]?.fullPieces ?? 5) : 0
  const maxTwoPiece = fullSet ? Math.floor((5 - fullSetPieces) / 2) : 2
  const twoPieceOptions = setOptions.filter((o) => o.value !== fullSet && (SONATA_SETS[o.value]?.fullPieces ?? 5) === 5)
  const weapon = character.weaponId ? WEAPONS[character.weaponId] : undefined
  const element = CHARACTER_INFO[character.charId]?.element
  const resultValues = (b: { echoes: Echo[], stats: WuwaStats, score: number }) => ({
    score: b.score,
    ...Object.fromEntries(
      SHOWN_STATS.map((stat) => [stat, toDisplayStats(statView === 'basic' ? computeWuwaStats(character, b.echoes).stats : b.stats)[stat]]),
    ),
    cost: costOf(b.echoes),
  })

  const filters = {
    mainStats,
    fullSet: fullSet ?? undefined,
    twoPieceSets: twoPieceSets.slice(0, maxTwoPiece),
    excludeEquippedByOthers,
    excludeOwners,
    minLevel,
  }
  // Echoes per cost after the filters, and the loadouts they make, live as the filters change
  // Boost main stat: echoes below +25 searched with their +25 main stats (main stat values follow the level)
  const searchEchoes = boostMain ? echoes.map((echo) => (echo.level < MAX_ECHO_LEVEL ? { ...echo, level: MAX_ECHO_LEVEL } : echo)) : echoes
  const pool = filterPool({ character, characters, echoes: searchEchoes, filters })
  // What to loosen when nothing matches (shared/noResults.ts): pool filters, checked for emptying the pool, then stat limits
  const noResultCauses = (): FilterCause[] => {
    const clear = () => setResult(undefined)
    const candidates: PoolCandidate<typeof filters>[] = []
    for (const [cost, allowed] of Object.entries(mainStats) as [string, StatKey[] | undefined][]) {
      if (!allowed?.length) continue
      candidates.push({
        key: `main:${cost}`,
        label: `Cost ${cost} main stat: ${allowed.map(statLabel).join(', ')}`,
        fixLabel: 'Allow any',
        without: { ...filters, mainStats: { ...mainStats, [cost]: [] } },
        apply: () => (setMainStats({ ...mainStats, [cost]: [] }), clear()),
      })
    }
    if (fullSet) {
      candidates.push({
        key: 'full',
        label: `Full set: ${setName(fullSet)}`,
        fixLabel: 'Clear',
        without: { ...filters, fullSet: undefined },
        apply: () => (setFullSet(null), clear()),
      })
    }
    if (twoPieceSets.length > 0) {
      candidates.push({
        key: '2pc',
        label: `2-piece sets: ${twoPieceSets.map(setName).join(', ')}`,
        fixLabel: 'Clear',
        without: { ...filters, twoPieceSets: [] },
        apply: () => (setTwoPieceSets([]), clear()),
      })
    }
    candidates.push(...optionCandidates(filters, {
      gearNoun: 'echoes',
      clear,
      setExcludeWorn: setExcludeEquippedByOthers,
      setPriority: setPriorityFilter,
      setMinLevel,
    }))
    const poolEmpty = (f: typeof filters) => filterPool({ character, characters, echoes: searchEchoes, filters: f }).length === 0
    return [
      ...poolCauses(candidates, poolEmpty, pool.length === 0),
      ...statLimitCauses(
        MIN_STATS.map((stat) => ({ key: stat, label: wuwaStatLabel(stat) })),
        minStats,
        maxStats,
        (next) => (setMinStats(next), clear()),
        (next) => (setMaxStats(next), clear()),
      ),
    ]
  }

  function run() {
    void search.start({
      character,
      characters,
      echoes: searchEchoes,
      filters,
      minStats,
      maxStats,
      teamBonus: combatBonus,
      fullSetBonus,
      target,
      limit: resultLimitOf(resultLimit),
    }, (response) => ({ ...response, target }))
  }

  const outcome = result?.outcome
  const build = outcome?.ok ? outcome.builds[selected] : undefined
  const current = outcome?.ok ? outcome.current : undefined
  const pickedDpsScore = build && result
    ? wuwaDamageScore(character, build.echoes, result.target, withFullSets(combatBonus, build.echoes, fullSetBonus))
    : undefined
  const mainFilters = COSTS.filter((cost) => mainStats[cost]?.length).length
  const filterSummary = [
    [fullSet ? `Full ${setName(fullSet)}` : '', ...twoPieceSets.slice(0, maxTwoPiece).map((id) => `2pc ${setName(id)}`)].filter(Boolean).join(' + ')
    || 'Any sets',
    mainFilters ? `${mainFilters} main stat filter${mainFilters === 1 ? '' : 's'}` : 'any main stats',
    limitsSummary(minStats, maxStats),
  ].join(' · ')
  const wornIds = new Set(character.echoIds.filter((id) => id !== null))
  const isWorn = !!build && build.echoes.length === wornIds.size && build.echoes.every((e) => wornIds.has(e.id))

  async function equipBuild() {
    if (!build || !result) return
    const losing = wuwaPiecesTaken({ echoes, characters, teams, priority }, character.charId, build.echoes).map(characterName)
    if (!await buildActions.equipResult(selected, build.echoes, losing)) return
    // The "Now" row is this loadout from here on
    if (result.outcome.ok) setResult({ ...result, outcome: { ...result.outcome, current: build } })
  }

  // Stat simulation (shared/statSimulation.ts): each simulated loadout's stats and score, worked out like the results
  const simulated = simulations.flatMap((simulation) => {
    const pieces = simulation.pieceIds.flatMap((id) => echoes.find((e) => e.id === id) ?? [])
    if (pieces.length === 0 || pieces.length !== simulation.pieceIds.length) return []
    const stats = wuwaSimulatedStats(character, pieces, simulation.rolls, withFullSets(combatBonus, pieces, fullSetBonus))
    const score = scoreStats(stats, target)
    const mains = pieces.map((e) => statLabel(e.mainStat)).join(' / ')
    return [{
      simulation,
      pieces,
      stats,
      score,
      scoreText: formatScore(target, score),
      describe: `${describeSets(pieces)} · Cost ${costOf(pieces)} · ${mains}`,
    }]
  })
  const simulatedOf = (simulation: StatSimulation) => simulated.find((s) => s.simulation.id === simulation.id)
  const simSubstats = SUBSTAT_KEYS.map((stat) => ({ key: stat, label: statLabel(stat) }))
  const pickedForSimulation = build
    ? {
      label: `loadout #${selected + 1}`,
      pieceIds: build.echoes.map((e) => e.id),
      rolls: rollsFromTotals(WUWA_SIM_ROLLS, substatTotals(build.echoes.flatMap((e) => e.substats))),
    }
    : undefined

  // The picked build's analysis rows, for Build analysis and Pin build
  const analysisRows: StatDiffRow[] = build && result
    ? [
      {
        key: 'score',
        label: targetLabel(result.target),
        build: build.score,
        current: current?.score,
        format: (value: number) => formatScore(result.target, value),
      },
      ...SHOWN_STATS.map((stat) => ({
        key: stat,
        label: wuwaStatLabel(stat),
        // Rounded like the screen first, so the change matches the numbers shown
        build: toDisplayStats(build.stats)[stat],
        current: current ? toDisplayStats(current.stats)[stat] : undefined,
        format: (value: number) => formatValue(stat, value),
      })),
    ]
    : []

  // Saved builds (the sidebar's Builds group, after HSR's), by piece id
  function saveBuildNow() {
    if (build) buildActions.saveBuildNow(build.echoes)
  }

  return {
    form: (
      <>
        <FormRows>
          <FormRow id='wuwa-resonator' title='Resonator' summary={`${characterName(character.charId)} · ${targetLabel(target)}`}>
            <CharacterPortrait
              name={characterName(character.charId)}
              portrait={art[character.charId]?.portrait}
              accent={element && `var(--mantine-color-${elementColor(element)}-6)`}
              weapon={weapon && { name: weapon.name }}
            />
            <FormCard title='Resonator'>
              <WuwaCharacterSelect
                characters={characters}
                art={art}
                value={character.charId}
                onChange={(value) => {
                  openCharacter(value)
                  setResult(undefined)
                }}
              />
              <Text size='xs' c='dimmed'>
                {`Level ${character.level} · ${weapon ? `${weapon.name}, level ${character.weaponLevel}` : 'No weapon'}`}
              </Text>
              {/* Like HSR's light cone, Eidolon and Superimposition pickers, these change the saved Resonator */}
              <WuwaWeaponSelect
                weaponType={CHARACTERS[character.charId]?.weaponType}
                value={character.weaponId ?? null}
                onChange={(weaponId) => {
                  if ((weaponId ?? undefined) === character.weaponId) return
                  saveCharacter({ ...character, weaponId: weaponId ?? undefined })
                  setResult(undefined)
                }}
              />
              <RankButtons
                label='Sequence'
                prefix='S'
                from={0}
                to={6}
                value={character.sequence}
                onChange={(sequence) => {
                  saveCharacter({ ...character, sequence })
                  setResult(undefined)
                }}
              />
              {weapon && (
                <RankButtons
                  label='Rank'
                  prefix='R'
                  from={1}
                  to={5}
                  value={character.refinement}
                  onChange={(refinement) => {
                    saveCharacter({ ...character, refinement })
                    setResult(undefined)
                  }}
                />
              )}
            </FormCard>
            <FormCard
              title='Rank by'
              description='Rotation damage uses the Damage row. The average hit is the scaling stat times the crit multiplier and DMG bonus.'
            >
              <Select
                aria-label='Rank by'
                allowDeselect={false}
                value={byDamage ? DAMAGE_TARGET : targetValue === DAMAGE_TARGET ? TARGETS[0].value : targetValue}
                onChange={(value) => value && setTargetValue(value)}
                data={[
                  ...(hasSkillData(character.charId) ? [{ value: DAMAGE_TARGET, label: 'Rotation damage' }] : []),
                  ...TARGETS.map((t) => ({ value: t.value, label: targetLabel(t.target) })),
                ]}
              />
              <ResultLimitSelect value={resultLimit} onChange={setResultLimit} />
            </FormCard>
            <OptimizerOptionsCard
              gearNoun='echoes'
              ownerNoun='Resonators'
              rosterPage='Resonators'
              excludeWorn={excludeEquippedByOthers}
              onExcludeWorn={setExcludeEquippedByOthers}
              priority={priorityFilter}
              onPriority={setPriorityFilter}
              levels={[0, 5, 10, 15, 20, 25]}
              minLevel={minLevel}
              onMinLevel={setMinLevel}
              boost={boostMain}
              boostDescription='Echoes below +25 count with their +25 main stats'
              onBoost={setBoostMain}
            />
          </FormRow>

          <FormRow id='wuwa-filters' title='Echo & stat filters' summary={filterSummary}>
            <FormCard
              title='Sonata sets'
              description='Only bonuses the overview screen shows are counted (2-pieces, not most 5-piece effects), so pick the set you want to run here. Two copies of one echo count once.'
            >
              <SetPicker
                label='Full set (5-piece, or 3 for three-piece sets)'
                max={1}
                options={setOptions}
                value={fullSet ? [fullSet] : []}
                onChange={(ids) => {
                  setFullSet(ids[0] ?? null)
                  setTwoPieceSets([])
                }}
              />
              <SetPicker
                label='2-piece sets'
                max={Math.max(maxTwoPiece, 1)}
                placeholder={maxTwoPiece === 0 ? 'No room with a 5-piece set' : 'Any'}
                disabled={maxTwoPiece === 0}
                options={twoPieceOptions}
                value={twoPieceSets}
                onChange={setTwoPieceSets}
              />
            </FormCard>
            <FormCard title='Main stats'>
              {COSTS.map((cost) => (
                <MultiSelect
                  key={cost}
                  label={`${cost}-cost`}
                  placeholder={mainStats[cost]?.length ? undefined : 'Any'}
                  value={mainStats[cost] ?? []}
                  onChange={(value) => setMainStats((prev) => ({ ...prev, [cost]: value as StatKey[] }))}
                  data={(Object.keys(MAIN_STAT_MAX[cost]) as StatKey[]).map((stat) => ({ value: stat, label: statLabel(stat) }))}
                />
              ))}
            </FormCard>
            <FormCard title='Stat filters' description='Loadouts outside any of these are left out, e.g. Energy Regen 120 to 140.'>
              <StatFilters
                rows={MIN_STATS.map((stat) => ({ key: stat, label: wuwaStatLabel(stat) }))}
                min={minStats}
                max={maxStats}
                onMin={(next) => setMinStats(next)}
                onMax={(next) => setMaxStats(next)}
              />
            </FormCard>
          </FormRow>

          <FormRow id='wuwa-team' title='Teammates' summary={wuwaTeamSummary(teammates.map(characterName), teamResult.applied)}>
            <TeamCards
              name={characterName(character.charId)}
              options={teammateOptions}
              teammates={teammates}
              maxTeammates={2}
              entries={wuwaTeamEntries(teamResult.applied)}
              description='Their skills buff this Resonator. Teammates use the echoes they wear in the save.'
              emptyText='Pick teammates to see what they give. Phase 1 covers Shorekeeper, Verina, Rebecca, Ciaccona, Denia, Buling, Suoming and Sigrika.'
              footnote="DMG Amplification buffs (most Outros) scale every loadout the same, so they can't change the ranking and aren't listed. Echo Skill DMG isn't calculated yet."
              onTeammates={(ids) => setTeammates(ids)}
              onSetting={(key, value) => setTeamSettings((prev) => ({ ...prev, [key]: value }))}
            />
            <TeammateOverrideCard
              rankPrefix='S'
              weaponLabel='weapon'
              refinementPrefix='R'
              overrides={keepOverridesFor(teammateOverrides, teammates)}
              onChange={setTeammateOverrides}
              members={teammates.flatMap((id) => {
                const mate = characters.find((c) => c.charId === id)
                if (!mate || id === character.charId) return []
                return [{
                  id,
                  name: characterName(id),
                  roster: { rank: mate.sequence, weaponId: mate.weaponId, refinement: mate.refinement },
                  weapons: WEAPON_OPTIONS,
                }]
              })}
            />
          </FormRow>

          <FormRow
            id='wuwa-damage'
            title='Damage'
            summary={`Enemy level ${enemy.level}, ${enemy.res}% RES · ${
              Object.values(rotation.counts).reduce((sum, count) => sum + count, 0)
            } hits · skill level ${rotation.skillLevel}${byDamage ? '' : ' · not ranked by damage'}`}
          >
            <EnemyCard
              enemy={enemy}
              onChange={(next) => {
                setEnemy(next)
                setResult(undefined)
              }}
            />
            <RotationCard
              charId={character.charId}
              rotation={rotation}
              mainEcho={wornEchoes[0]?.defId}
              damage={currentDamage}
              onChange={(next) => {
                setRotation(next)
                setResult(undefined)
              }}
            />
            <KitEffectsCard
              name={characterName(character.charId)}
              applied={kit.applied}
              onSetting={(id, value) => {
                setCombatSettings((current) => ({ ...current, [id]: value }))
                setResult(undefined)
              }}
            />
            <KitEffectsCard
              name={characterName(character.charId)}
              title='Set effects'
              description='Full-set Sonata effects, counted for every loadout that completes its set with different echoes, only when ranking by rotation damage. Shown for the Full set filter and the complete sets in the current and picked loadouts.'
              emptyText='Pick a set under Full set, or a loadout with a complete set, to see its effects.'
              applied={setEffects.applied}
              onSetting={(id, value) => {
                setCombatSettings((current) => ({ ...current, [id]: value }))
                setResult(undefined)
              }}
            />
            <ExtraBuffsCard
              defs={WUWA_EXTRA_BUFFS}
              buffs={extraBuffs}
              onChange={(next) => {
                setExtraBuffs(next)
                setResult(undefined)
              }}
            />
          </FormRow>
          <FormRow
            id='wuwa-simulation'
            title='Stat simulation'
            summary={simulations.length > 0 ? `${simulations.length} simulated build${simulations.length === 1 ? '' : 's'}` : 'No simulated builds'}
          >
            <StatSimulationCard
              simulations={simulations}
              onChange={setSimulations}
              substats={simSubstats}
              picked={pickedForSimulation}
              describe={(simulation) => simulatedOf(simulation)?.describe}
              scoreOf={(simulation) => simulatedOf(simulation)?.scoreText}
            />
          </FormRow>
        </FormRows>
        <KitDisclaimer name={characterName(character.charId)} effects={KIT_EFFECTS[character.charId]} byDamage={byDamage} />
      </>
    ),
    sidebar: {
      pools: COSTS.map((cost) => ({ label: `${cost}-cost`, value: pool.filter((e) => e.cost === cost).length })),
      combinations: countLoadouts(pool),
      combinationsLabel: 'Loadouts',
      hint: pool.length === 0 ? { text: 'No echoes left with these filters', warn: true } : undefined,
      canStart: pool.length > 0,
      results: outcome?.ok && result
        ? {
          count: outcome.builds.length,
          seconds: result.ms / 1000,
          note: outcome.truncated ? 'Stopped at its limit: best found, maybe not the best.' : undefined,
        }
        : undefined,
      equip: build ? { label: `loadout #${selected + 1}`, onEquip: equipBuild, equipped: isWorn } : undefined,
      onStart: run,
      pin: build && result ? { label: `#${selected + 1} · ${formatScore(result.target, build.score)}`, cells: pinnedCells(analysisRows) } : undefined,
      onSave: build ? saveBuildNow : undefined,
    },
    results: {
      intro: outcome ? undefined : {
        title: `Find the best echoes for ${characterName(character.charId)}`,
        text: `Pick what to rank by and any filters, then search. The best ${resultLimitOf(resultLimit)} loadouts show up here next to the current one.`,
      },
      emptyPool: !running && pool.length === 0 && echoes.length > 0 ? { causes: noResultCauses(), empty: 'pool' } : undefined,
      failure: outcome && !outcome.ok ? outcome.reason : undefined,
      results: outcome?.ok && result
        ? {
          description: `${(result.ms / 1000).toFixed(1)}s · ${
            formatNumber(outcome.visited)
          } partial and full loadouts checked · ${outcome.poolSize} echoes, ${outcome.prunedSize} after dropping ones that can't make the top ${
            resultLimitOf(resultLimit)
          }`,
          warning: outcome.truncated
            ? 'The search stopped at its limit, so these are the best loadouts it found, not necessarily the best there are. A full set or main stat filters make the search finish.'
            : undefined,
          causes: noResultCauses,
          grid: outcome.builds.length === 0 ? undefined : {
            gridKey: `${outcome.builds.length}${result.target.kind}`,
            columns: [
              {
                key: 'score',
                label: targetLabel(result.target),
                format: (value: number) => formatScore(result.target, value),
                primary: true,
                width: 110,
              },
              ...SHOWN_STATS.map((stat) => ({ key: stat, label: wuwaStatLabel(stat), format: (value: number) => formatValue(stat, value) })),
              { key: 'cost', label: 'Cost', format: (value: number) => String(value), width: 60 },
            ],
            rows: outcome.builds.map((b, i) => ({ id: String(i), rank: String(i + 1), values: resultValues(b), sets: describeSets(b.echoes) })),
            current: current ? { id: 'now', rank: 'Now', values: resultValues(current), sets: describeSets(current.echoes) } : undefined,
            simulated: simulated.map((s) => ({
              id: s.simulation.id,
              rank: 'Sim',
              values: resultValues({ echoes: s.pieces, stats: s.stats, score: s.score }),
              sets: `${s.simulation.name} · ${describeSets(s.pieces)}`,
            })),
            selected,
            onSelect: setSelected,
          },
        }
        : undefined,
      preview: (
        <>
          {build && result && (
            <BuildPreview
              title={`Loadout #${selected + 1}`}
              description={`${describeSets(build.echoes)} · Cost ${costOf(build.echoes)} / ${MAX_LOADOUT_COST}${
                current ? ` · ${build.score >= current.score ? '+' : ''}${(((build.score / current.score) - 1) * 100).toFixed(1)}% vs current` : ''
              }`}
              name={characterName(character.charId)}
              accent={element && `var(--mantine-color-${elementColor(element)}-6)`}
              portrait={art[character.charId]?.portrait}
              weapon={weapon && { name: weapon.name, meta: `Lv ${character.weaponLevel} · R${character.refinement}` }}
              heading={
                <Group gap={6} mt={4}>
                  {element && <Badge size='sm' variant='light' color={elementColor(element)}>{elementName(element)}</Badge>}
                  <Text size='xs' c='dimmed'>{`Lv ${character.level} · S${character.sequence}`}</Text>
                </Group>
              }
              rows={wuwaStatRows(toDisplayStats(build.stats), element)}
              rating={pickedDpsScore ?? wuwaBuildScore(character, build.echoes)}
              ratingLabel={pickedDpsScore ? DPS_SCORE_LABEL : 'Echo score'}
              footer={<Text size='xs' c='dimmed'>Pick the main echo (its skill) yourself: echo skills don't change the overview screen.</Text>}
              gear={build.echoes.map((echo) => (
                <EchoCard
                  key={echo.id}
                  echo={echo}
                  owner={ownerOf.get(echo.id)}
                  score={scoreEcho(echo, wuwaEchoWeights(character))}
                />
              ))}
            />
          )}

          {build && result && (
            <BuildAnalysis
              buildLabel={`Loadout #${selected + 1}`}
              rows={analysisRows}
              upgrades={wuwaSubstatUpgrades(
                character,
                build.echoes,
                result.target,
                result.target.kind === 'damage' ? withFullSets(combatBonus, build.echoes, fullSetBonus) : teamBonus,
              )}
              breakdown={result.target.kind === 'damage' ? wuwaBreakdown(result.target.setup, build.stats) : undefined}
              scoreLabel={targetLabel(result.target)}
              formatRoll={(upgrade) => upgrade.stat.endsWith('Flat') ? String(Math.round(upgrade.roll)) : `${upgrade.roll.toFixed(1)}%`}
            />
          )}
        </>
      ),
    },
    footer: (
      <>
        <RememberDamageScore game='wuwa' characterId={character.charId} pieceIds={wornEchoes.map((e) => e.id)} score={currentDpsScore} />
      </>
    ),
  }
}
