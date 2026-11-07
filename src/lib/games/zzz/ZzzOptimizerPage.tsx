import {
  Accordion,
  Badge,
  Button,
  FileInput,
  Group,
  MultiSelect,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import {
  splitDamage,
} from 'lib/games/shared/damageBreakdown'
import type { ExtraBuffs } from 'lib/games/shared/extraBuffs'
import { formatNumber } from 'lib/games/shared/format'
import { scoreBuild } from 'lib/games/shared/gearScore'
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
} from 'lib/games/shared/statSimulation'
import {
  fourPieceSetsOf,
  keepOverridesFor,
  NO_SET,
  type TeammateOverrides,
} from 'lib/games/shared/teammateOverrides'
import {
  rankTeammateUpgrades,
  teammateSetTries,
} from 'lib/games/shared/teammateUpgrades'
import {
  BuildAnalysis,
  pinnedCells,
  type StatDiffRow,
} from 'lib/games/shared/ui/BuildAnalysis'
import {
  DPS_SCORE_LABEL,
  RememberDamageScore,
} from 'lib/games/shared/ui/BuildRating'
import { confirmAction } from 'lib/games/shared/ui/confirm'
import {
  Notices,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
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
import { resolveZzzCombat } from 'lib/games/zzz/damage/combatEffects'
import { KIT_EFFECTS } from 'lib/games/zzz/damage/combatEffects'
import {
  addAnomalyBonuses,
  agentHits,
  type DamageSetup,
  DEFAULT_ENEMY,
  defaultRotation,
  type EnemySettings,
  type Rotation,
  rotationAnomaly,
  rotationDamage,
  rotationFlatHp,
  rotationLines,
  rotationSkills,
  singleLineRotation,
} from 'lib/games/zzz/damage/damage'
import {
  EnemyCard,
  KitEffectsCard,
  RotationCard,
} from 'lib/games/zzz/damage/DamageCards'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type {
  ActiveConditions,
  AgentData,
  Condition,
} from 'lib/games/zzz/data/dataTypes'
import { useZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import {
  useZzzImages,
  type ZzzImages,
} from 'lib/games/zzz/data/images'
import { parseImportedZzzPresets } from 'lib/games/zzz/data/importedPresets'
import {
  daysSinceReview,
  getPreset,
  needsReview,
  REVIEW_INTERVAL_DAYS,
  type SetChoice,
} from 'lib/games/zzz/data/presets'
import { zzzSampleData } from 'lib/games/zzz/data/sampleData'
import { SETS } from 'lib/games/zzz/data/sets'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import { SUBSTAT_STATS } from 'lib/games/zzz/discStats'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  ZZZ_SIM_ROLLS,
  zzzSimulatedStats,
  zzzSubstatTotals,
} from 'lib/games/zzz/optimizer/analysis'
import {
  zzzDamageScore,
  zzzSubstatUpgrades,
} from 'lib/games/zzz/optimizer/analysis'
import {
  countCombinations,
  filterPools,
  type MainStatSlot,
  MAX_COMBINATIONS,
  type OptimizerBuild,
  type OptimizerFilters,
  type OptimizerOutcome,
  type RankKey,
} from 'lib/games/zzz/optimizer/discOptimizer'
import { discSearch } from 'lib/games/zzz/optimizer/optimizerClient'
import type { DiscWorkerResponse } from 'lib/games/zzz/optimizer/optimizerWorker'
import { usePresetImportStore } from 'lib/games/zzz/state/presetImportStore'
import { zzzRoster } from 'lib/games/zzz/state/roster'
import { zzzPiecesTaken } from 'lib/games/zzz/state/zzzState'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import {
  CONDITION_LABELS,
  formatStat,
  STAT_ROWS,
  type StatRow,
} from 'lib/games/zzz/statLabels'
import {
  computeStats,
  type FinalStats,
  statScreenConditions,
  toDisplayStats,
} from 'lib/games/zzz/stats/computeStats'
import {
  scoreDisc,
  zzzDiscWeights,
} from 'lib/games/zzz/stats/discScore'
import {
  SET_4PC_BUFFS,
  type ZzzBuffSetting,
} from 'lib/games/zzz/team/buffs'
import {
  withZzzExtraDebuffs,
  ZZZ_EXTRA_BUFFS,
  zzzExtraEffects,
} from 'lib/games/zzz/team/extraBuffs'
import {
  zzzTeamBuffsFor,
  type ZzzTeamResult,
} from 'lib/games/zzz/team/teamBuffs'
import {
  zzzTeamEntries,
  zzzTeamSummary,
} from 'lib/games/zzz/team/teamEntries'
import {
  type Disc,
  type DiscRarity,
  MAX_DISC_LEVEL,
  type ZzzStatsValues,
} from 'lib/games/zzz/types'
import { zzzStatRows } from 'lib/games/zzz/ui/agentStats'
import {
  DiscCard,
  elementColor,
} from 'lib/games/zzz/ui/DiscCard'
import { sMainValue } from 'lib/games/zzz/ui/discKind'
import {
  ZzzAgentSelect,
  ZzzWEngineSelect,
} from 'lib/games/zzz/ui/pickers'
import { Message } from 'lib/interactions/message'
import {
  useMemo,
  useState,
} from 'react'

const MAX_IMPORT_WARNINGS = 6
const MAIN_STAT_SLOTS: MainStatSlot[] = [4, 5, 6]

// wEngineId '' is no W-Engine
type Loadout = { wEngineId: string, refinement: string }

const SETTINGS_KEY = 'zzz-optimizer-settings'

// Everything on the page that's saved per agent, see shared/optimizerSettings.ts
type ZzzOptimizerSettings = {
  loadout: Loadout,
  coreSkill: string,
  conditions: ActiveConditions,
  sortBy: RankKey,
  thenBy: (keyof FinalStats)[],
  presetChoice: string,
  fourPieceSet: string | null,
  twoPieceSet: string | null,
  mainStats: Partial<Record<MainStatSlot, ZzzStatsValues[]>>,
  minStats: Partial<Record<keyof FinalStats, number>>,
  maxStats: Partial<Record<keyof FinalStats, number>>,
  excludeEquippedByOthers: boolean,
  // HSR's character priority filter: leave out gear worn by characters ranked above (shared/characterPriority.ts)
  priorityFilter: boolean,
  // HSR's Keep current, Min enhance, Min rarity and Boost main stat (Optimizer options)
  keepCurrent: boolean,
  minLevel: number,
  minRarity: '' | DiscRarity,
  boostMain: boolean,
  resultLimit: number,
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
  // Stat simulation (shared/statSimulation.ts)
  simulations: StatSimulation[],
}

// The user's own W-Engine for this agent when it's supported, otherwise none
function defaultLoadout(agent: AgentData, builds: ImportedBuild[]): Loadout {
  const build = builds.find((b) => b.agentId === agent.id && b.wEngineId && W_ENGINES[b.wEngineId])
  return { wEngineId: build?.wEngineId ?? '', refinement: String(build?.wEngineRefinement ?? 1) }
}

function setName(setId: string): string {
  return SETS[setId]?.name ?? setId
}

// How many of the six slots have at least one disc of this set
function slotsWithSet(discs: Disc[], setId: string): number {
  return new Set(discs.filter((d) => d.setId === setId).map((d) => d.slot)).size
}

function describeChoice(choice: SetChoice): string {
  return `4pc ${setName(choice.fourPiece)}${choice.twoPiece ? ` + 2pc ${setName(choice.twoPiece)}` : ''}`
}

function mainStatText(stats: ZzzStatsValues[]): string {
  return stats.length > 0 ? stats.join(' / ') : 'any'
}

function describeSets(discs: Disc[]): string {
  const counts = new Map<string, number>()
  for (const disc of discs) counts.set(disc.setName, (counts.get(disc.setName) ?? 0) + 1)
  return [...counts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${count >= 4 ? 4 : 2}pc ${name}`)
    .join(' + ') || 'No set bonus'
}

// Agents with skill data rank by rotation damage unless changed
function defaultRank(agentId: string): RankKey {
  return agentHits(agentId).length > 0 ? 'damage' : 'critDmg'
}

// One-time change to saves from older versions: agents still on the old default (CRIT DMG) move to Rotation damage
function migrateSaves() {
  migrateOptimizerSettings(
    SETTINGS_KEY,
    'rank-by-rotation-damage',
    (id, saved) => (saved.sortBy === 'critDmg' && defaultRank(id) === 'damage' ? { ...saved, sortBy: 'damage' } : saved),
  )
}

// What the shared optimizer parts need to know about this game's gear (shared/ui/optimizer/useBuildActions.ts)
const ZZZ_OPTIMIZER_KIND: OptimizerKind<Disc> = {
  game: 'zzz',
  buildNoun: 'build',
  describeSets,
  takenNote: (name, swap) => (swap ? `will get ${name}'s current discs in exchange` : 'will lose them (Settings: replace)'),
}

type ZzzOptimizerData = OptimizerData<AgentData, Disc> & { builds: ImportedBuild[], storeBuilds: ImportedBuild[], images: ZzzImages }

function useZzzOptimizerData(): ZzzOptimizerData {
  const discs = useZzzStore((s) => s.discs)
  const storeBuilds = useZzzStore((s) => s.builds)
  const images = useZzzImages()
  // Every agent and W-Engine, once Enka's data has loaded (data/enkaGameData.ts)
  const gameData = useZzzGameData()
  // A build for every agent, saved or a default one (state/roster.ts), so any agent can be a teammate
  const builds = useMemo(() => zzzRoster(storeBuilds), [storeBuilds, gameData])
  const agents = useMemo(() => Object.values(AGENTS), [gameData])
  return { characters: agents, gear: discs, builds, storeBuilds, images }
}

// An agent nobody changed yet starts with the user's own W-Engine and the stat screen's conditions
function defaultSettings(id: string, data: ZzzOptimizerData): ZzzOptimizerSettings {
  return {
    loadout: defaultLoadout(AGENTS[id] ?? data.characters[0], data.builds),
    coreSkill: '6',
    conditions: statScreenConditions(),
    sortBy: defaultRank(id),
    thenBy: [],
    presetChoice: '0',
    fourPieceSet: null,
    twoPieceSet: null,
    mainStats: {},
    minStats: {},
    maxStats: {},
    excludeEquippedByOthers: false,
    priorityFilter: false,
    keepCurrent: false,
    minLevel: 0,
    minRarity: '',
    boostMain: false,
    resultLimit: DEFAULT_RESULT_LIMIT,
    teammates: [],
    teamSettings: {},
    teammateOverrides: {},
    extraBuffs: {},
    enemy: DEFAULT_ENEMY,
    rotation: defaultRotation(id),
    combatSettings: {},
    simulations: [],
  }
}

// The ZZZ optimizer on the shared page (shared/ui/optimizer/GameOptimizerPage.tsx)
const ZZZ_PAGE_KIND: OptimizerPageKind<AgentData, Disc, ZzzOptimizerSettings, DiscWorkerResponse, typeof discSearch, ZzzOptimizerData> = {
  ...ZZZ_OPTIMIZER_KIND,
  settingsKey: SETTINGS_KEY,
  gearNoun: 'discs',
  description:
    'Searches every combination of your discs and ranks them by rotation damage or the stat you pick. Rotation damage uses the Damage row; set minimums (such as Energy Regen) for anything else the agent needs.',
  importText: 'The optimizer searches every combination of the discs you own for the best build.',
  loadSample: () => useZzzStore.getState().importParsed(zzzSampleData(), 'replace'),
  migrateSaves,
  runner: discSearch,
  useData: useZzzOptimizerData,
  idOf: (agent) => agent.id,
  nameOf: (agent) => agent.name,
  // The first agent with a build, until one is opened (Enka's agents load after the first render)
  fallback: (data) => data.characters.find((a) => data.storeBuilds.some((b) => b.agentId === a.id)),
  defaultSettings,
  equip: (agent, pieces, settings) =>
    useZzzStore.getState().equip(agent, { id: settings.loadout.wEngineId, refinement: Number(settings.loadout.refinement) }, pieces),
  useView: useZzzOptimizerView,
}

export function ZzzOptimizerPage({ onImport }: { onImport: () => void }) {
  return <GameOptimizerPage kind={ZZZ_PAGE_KIND} onImport={onImport} />
}

function useZzzOptimizerView({ character, data, settings, update: updateSettings, openCharacter, search, statView, buildActions }: OptimizerViewContext<
  AgentData,
  Disc,
  ZzzOptimizerSettings,
  DiscWorkerResponse,
  typeof discSearch,
  ZzzOptimizerData
>): OptimizerView {
  const agent = character
  const { gear: discs, builds, images } = data
  const { running, result, setResult, selected, setSelected } = search
  const outcome: OptimizerOutcome | null = result?.outcome ?? null

  const {
    loadout,
    coreSkill,
    conditions,
    sortBy,
    thenBy,
    presetChoice,
    fourPieceSet,
    twoPieceSet,
    mainStats,
    minStats,
    maxStats,
    excludeEquippedByOthers,
    priorityFilter,
    keepCurrent,
    minLevel,
    minRarity,
    boostMain,
    resultLimit,
    teammates,
    teamSettings,
    teammateOverrides,
    extraBuffs,
    enemy,
    rotation,
    simulations,
    combatSettings,
  } = settings
  const setLoadout = fieldSetter(updateSettings, 'loadout')
  const setCoreSkill = fieldSetter(updateSettings, 'coreSkill')
  const setConditions = fieldSetter(updateSettings, 'conditions')
  const setSortBy = fieldSetter(updateSettings, 'sortBy')
  const setThenBy = fieldSetter(updateSettings, 'thenBy')
  const setPresetChoice = fieldSetter(updateSettings, 'presetChoice')
  const setFourPieceSet = fieldSetter(updateSettings, 'fourPieceSet')
  const setTwoPieceSet = fieldSetter(updateSettings, 'twoPieceSet')
  const setMainStats = fieldSetter(updateSettings, 'mainStats')
  const setMinStats = fieldSetter(updateSettings, 'minStats')
  const setMaxStats = fieldSetter(updateSettings, 'maxStats')
  const setExcludeEquippedByOthers = fieldSetter(updateSettings, 'excludeEquippedByOthers')
  const setPriorityFilter = fieldSetter(updateSettings, 'priorityFilter')
  const setKeepCurrent = fieldSetter(updateSettings, 'keepCurrent')
  const setMinLevel = fieldSetter(updateSettings, 'minLevel')
  const setMinRarity = fieldSetter(updateSettings, 'minRarity')
  const setBoostMain = fieldSetter(updateSettings, 'boostMain')
  // Gear worn by characters ranked above is left out when the priority filter is on (and worn gear is otherwise allowed)
  const rosterIds = useMemo(() => [...new Set(builds.map((b) => b.agentId))], [builds])
  const excludeOwners = useExcludeOwners('zzz', rosterIds, agent.id, priorityFilter, excludeEquippedByOthers)
  const setResultLimit = fieldSetter(updateSettings, 'resultLimit')
  const setTeammates = fieldSetter(updateSettings, 'teammates')
  const setTeamSettings = fieldSetter(updateSettings, 'teamSettings')
  const setTeammateOverrides = fieldSetter(updateSettings, 'teammateOverrides')
  const setExtraBuffs = fieldSetter(updateSettings, 'extraBuffs')
  const setEnemy = fieldSetter(updateSettings, 'enemy')
  const setRotation = fieldSetter(updateSettings, 'rotation')
  const setCombatSettings = fieldSetter(updateSettings, 'combatSettings')
  const setSimulations = fieldSetter(updateSettings, 'simulations')
  // What the squad gives this agent, the same for every build
  const team = { teammates, settings: teamSettings, overrides: keepOverridesFor(teammateOverrides, teammates) }
  const teamResult = zzzTeamBuffsFor(agent.id, team, { builds, discs }, fourPieceSet ?? undefined)
  // The agent's own kit effects, counted only when ranking by rotation damage
  const byDamage = sortBy === 'damage'
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
  const teammateOptions = [...new Map(builds.filter((b) => b.agentId !== agent.id && AGENTS[b.agentId]).map((b) => [b.agentId, b.name]))]
    .map(([value, label]) => ({ value, label }))
  const storedImport = usePresetImportStore((s) => s.stored)
  const importPresetText = usePresetImportStore((s) => s.importText)
  const clearImportedPresets = usePresetImportStore((s) => s.clear)
  const [presetSource, setPresetSource] = useState<'imported' | 'builtin'>('imported')

  const statRows = STAT_ROWS.filter((row) => !row.ruptureOnly || agent.specialty === 'Rupture')
  const imported = useMemo(() => storedImport ? parseImportedZzzPresets(storedImport, Object.values(AGENTS)) : undefined, [storedImport])
  const importedPreset = imported?.presets[agent.id]
  // The imported preset wins when there is one, unless the user picks the built-in one
  const preset = importedPreset && presetSource === 'imported' ? importedPreset : getPreset(agent)
  const reviewAge = daysSinceReview(preset, new Date())
  const ownerNames = useMemo(() => new Map(builds.map((b) => [b.agentId, b.name])), [builds])

  const setOptions = useMemo(() => {
    const names = new Map(discs.map((d) => [d.setId, d.setName]))
    return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [discs])

  const mainStatOptions = useMemo(
    () => Object.fromEntries(MAIN_STAT_SLOTS.map((slot) => [slot, [...new Set(discs.filter((d) => d.slot === slot).map((d) => d.main.stat))].sort()])),
    [discs],
  ) as Record<MainStatSlot, string[]>

  const filters: OptimizerFilters = {
    mainStats,
    fourPieceSet: fourPieceSet ?? undefined,
    twoPieceSet: twoPieceSet ?? undefined,
    excludeEquippedByOthers,
    excludeOwners,
    keep: keepCurrent ? builds.find((b) => b.agentId === agent.id)?.discIds : undefined,
    minLevel,
    minRarity: minRarity || undefined,
  }
  // Boost main stat: S-rank discs below +15 searched with their +15 main stat
  const searchDiscs = boostMain
    ? discs.map((disc) =>
      disc.rarity === 'S' && disc.level < MAX_DISC_LEVEL
        ? { ...disc, main: { ...disc.main, value: sMainValue(disc.main.stat, MAX_DISC_LEVEL) ?? disc.main.value } }
        : disc
    )
    : discs
  const pools = filterPools({ agent, discs: searchDiscs, filters })
  const combinations = countCombinations(pools)
  const emptySlots = pools.flatMap((pool, i) => pool.length === 0 ? [i + 1] : [])
  // What to loosen when nothing matches (shared/noResults.ts): pool filters, checked for emptying a slot, then stat limits
  const noResultCauses = (): FilterCause[] => {
    const clear = () => setResult(undefined)
    const candidates: PoolCandidate<OptimizerFilters>[] = []
    for (const slot of [4, 5, 6] as MainStatSlot[]) {
      const allowed = mainStats[slot] ?? []
      if (allowed.length === 0) continue
      candidates.push({
        key: `main:${slot}`,
        label: `Slot ${slot} main stat: ${allowed.join(', ')}`,
        fixLabel: 'Allow any',
        without: { ...filters, mainStats: { ...mainStats, [slot]: [] } },
        apply: () => (setMainStats({ ...mainStats, [slot]: [] }), clear()),
      })
    }
    if (fourPieceSet) {
      candidates.push({
        key: '4pc',
        label: `4-piece set: ${setName(fourPieceSet)}`,
        fixLabel: 'Clear',
        without: { ...filters, fourPieceSet: undefined },
        apply: () => (setFourPieceSet(null), clear()),
      })
    }
    if (twoPieceSet) {
      candidates.push({
        key: '2pc',
        label: `2-piece set: ${setName(twoPieceSet)}`,
        fixLabel: 'Clear',
        without: { ...filters, twoPieceSet: undefined },
        apply: () => (setTwoPieceSet(null), clear()),
      })
    }
    candidates.push(...optionCandidates(filters, {
      gearNoun: 'discs',
      clear,
      setExcludeWorn: setExcludeEquippedByOthers,
      setPriority: setPriorityFilter,
      setKeep: setKeepCurrent,
      setMinLevel,
      rarity: { label: `Minimum rank ${minRarity}`, reset: () => setMinRarity('') },
    }))
    const poolEmpty = (f: OptimizerFilters) => filterPools({ agent, discs: searchDiscs, filters: f }).some((pool) => pool.length === 0)
    return [
      ...poolCauses(candidates, poolEmpty, emptySlots.length > 0),
      ...statLimitCauses(statRows, minStats, maxStats, (next) => (setMinStats(next), clear()), (next) => (setMaxStats(next), clear())),
    ]
  }

  function changeAgent(id: string | null) {
    if (!id || !AGENTS[id]) return
    openCharacter(id)
    setResult(undefined)
  }

  // Fills the filters and ranking from the preset, minimum stats and conditions are left as they are
  function applyPreset() {
    const choice = preset.sets[Number(presetChoice)]
    updateSettings({
      fourPieceSet: choice?.fourPiece ?? null,
      twoPieceSet: choice?.twoPiece ?? null,
      mainStats: { ...preset.mainStats },
      sortBy: preset.rankBy,
      thenBy: preset.thenBy.filter((key) => statRows.some((row) => row.key === key)),
    })
    setResult(undefined)
  }

  async function handlePresetFile(file: File | null) {
    if (!file) return
    importPresetText(await file.text())
    setPresetSource('imported')
    setPresetChoice('0')
  }

  async function removeImportedPresets() {
    if (!await confirmAction('Remove imported presets', 'Remove the imported presets from this browser?', { danger: true, confirmLabel: 'Remove' })) return
    clearImportedPresets()
    Message.success('Removed the imported presets')
  }

  // The search runs in a web worker, so the page stays responsive while it works
  function run() {
    if (loadout.wEngineId && !W_ENGINES[loadout.wEngineId]) return
    void search.start({
      agentId: agent.id,
      wEngineId: loadout.wEngineId || undefined,
      wEngineRefinement: Number(loadout.refinement),
      coreSkillLevel: Number(coreSkill),
      conditions,
      discs: searchDiscs,
      filters,
      minStats,
      maxStats,
      teamEffects: combatEffects,
      damage: damageSetup,
      sortBy,
      thenBy,
      limit: resultLimitOf(resultLimit),
    }, (response) => response)
  }

  const best: OptimizerBuild | undefined = outcome?.ok ? outcome.builds[selected] : undefined
  const resultColumns = resultColumnsFor(agent, sortBy, thenBy)
  const canSearch = combinations > 0 && combinations <= MAX_COMBINATIONS
  const searchHint = emptySlots.length > 0
    ? `None of your discs fit slot ${emptySlots.join(', ')} with these filters`
    : combinations > MAX_COMBINATIONS
    ? `${formatNumber(combinations)} combinations, narrow the filters first`
    : 'Every combination is checked.'
  const agentBuild = builds.find((b) => b.agentId === agent.id)
  // The settings on the page now, for the build analysis: the agent's current discs, and the picked build again
  const wEngine = W_ENGINES[loadout.wEngineId]
  const computeInput = wEngine || !loadout.wEngineId
    ? { agent, wEngine, wEngineRefinement: Number(loadout.refinement), coreSkillLevel: Number(coreSkill), conditions, teamEffects: combatEffects }
    : undefined
  const currentDiscs = agentBuild ? Object.values(agentBuild.discIds).flatMap((id) => discs.find((d) => d.id === id) ?? []) : []
  const currentStats = computeInput && currentDiscs.length > 0 ? computeStats({ ...computeInput, discs: currentDiscs }).stats : undefined
  const currentDisplay = currentStats && toDisplayStats(currentStats)
  // The stat screen of some discs: no combat conditions or squad buffs (Basic stats view)
  const screenDisplay = (list: Disc[]) =>
    computeInput ? toDisplayStats(computeStats({ ...computeInput, discs: list, conditions: statScreenConditions(), teamEffects: [] }).stats) : undefined
  const currentDamage = currentStats && rotationDamage(currentStats, damageSetup)
  // DPS scores when ranking by damage (shared/damageScore.ts): the current discs' is kept for the Agents page
  const currentDpsScore = byDamage && computeInput ? zzzDamageScore({ ...computeInput, discs: currentDiscs }, damageSetup) : undefined
  const pickedDpsScore = byDamage && computeInput && best ? zzzDamageScore({ ...computeInput, discs: best.discs }, damageSetup) : undefined
  // Teammate set upgrades (shared/teammateUpgrades.ts, after HSR's): the picked build's rotation damage with each teammate
  // on each squad 4-piece instead, through their 4-piece override
  const teammateUpgrades = byDamage && computeInput && best
    ? (() => {
      const damageWith = (overrides: typeof team.overrides) => {
        const parts = teamPartsFor(zzzTeamBuffsFor(agent.id, { ...team, overrides }, { builds, discs }, fourPieceSet ?? undefined))
        const stats = computeStats({ ...computeInput, teamEffects: parts.combatEffects, discs: best.discs }).stats
        return rotationDamage(stats, parts.setupFor(rotation))
      }
      const mates = teammates.flatMap((id) => {
        const build = builds.find((b) => b.agentId === id)
        if (!build || id === agent.id) return []
        const override = team.overrides[id]?.fourPiece
        const worn = fourPieceSetsOf(Object.values(build.discIds).flatMap((discId) => discs.find((d) => d.id === discId)?.setId ?? []))[0]
        return [{ id, name: build.name, fourPiece: override === NO_SET ? undefined : override ?? worn }]
      })
      const tries = teammateSetTries(
        mates,
        Object.keys(SET_4PC_BUFFS),
        (id, set) => damageWith({ ...team.overrides, [id]: { ...team.overrides[id], fourPiece: set } }),
      )
      return rankTeammateUpgrades(damageWith(team.overrides), tries)
    })()
    : undefined
  // Each rotation line's share of the picked build's damage, for the build analysis
  const bestStats = best && computeInput ? computeStats({ ...computeInput, discs: best.discs }).stats : undefined
  const breakdown = bestStats && byDamage
    ? splitDamage(
      rotationLines(agent.id, agent.element, rotation, teamElements),
      (line) => rotationDamage(bestStats, setupFor(singleLineRotation(rotation, line))),
    )
    : undefined
  const rankRow = statRows.find((row) => row.key === sortBy) ?? statRows[0]
  const rankLabel = byDamage ? 'Rotation damage' : rankRow.label
  const rankText = (
    build: { display: FinalStats, damage?: number },
  ) => (byDamage ? formatNumber(Math.round(build.damage ?? 0)) : formatStat(rankRow, build.display[sortBy as keyof FinalStats]))
  const agentSummary = `${agent.name} · ${
    W_ENGINES[loadout.wEngineId] ? `${W_ENGINES[loadout.wEngineId].name} R${loadout.refinement}` : 'No W-Engine'
  } · ranked by ${rankLabel}`
  const mainFilters = MAIN_STAT_SLOTS.filter((slot) => mainStats[slot]?.length).length
  const conditionCount = Object.values(conditions).filter(Boolean).length
  const filterSummary = [
    [fourPieceSet ? `4pc ${setName(fourPieceSet)}` : '', twoPieceSet ? `2pc ${setName(twoPieceSet)}` : ''].filter(Boolean).join(' + ') || 'Any sets',
    mainFilters ? `${mainFilters} main stat filter${mainFilters === 1 ? '' : 's'}` : 'any main stats',
    conditionCount ? `${conditionCount} combat condition${conditionCount === 1 ? '' : 's'} on` : 'stat screen',
    limitsSummary(minStats, maxStats),
  ].join(' · ')
  const isWorn = !!best && best.discs.every((disc) => agentBuild?.discIds[disc.slot] === disc.id)

  async function equipBuild() {
    if (!best) return
    const losing = zzzPiecesTaken({ discs, builds }, agent.id, best.discs).map((id) => ownerNames.get(id) ?? AGENTS[id]?.name ?? `Agent ${id}`)
    await buildActions.equipResult(selected, best.discs, losing)
  }

  // Stat simulation (shared/statSimulation.ts): each simulated build's stats and score, worked out like the results
  const simulated = computeInput
    ? simulations.flatMap((simulation) => {
      const pieces = simulation.pieceIds.flatMap((id) => discs.find((d) => d.id === id) ?? [])
      if (pieces.length < 6 || pieces.length !== simulation.pieceIds.length) return []
      const stats = zzzSimulatedStats({ ...computeInput, discs: pieces }, simulation.rolls)
      const display = toDisplayStats(stats)
      const damage = byDamage ? rotationDamage(stats, damageSetup) : undefined
      const scoreText = byDamage ? formatNumber(Math.round(damage ?? 0)) : formatStat(rankRow, display[sortBy as keyof FinalStats])
      const mains = pieces.slice(3).map((d) => d.main.stat).join(' / ')
      return [{ simulation, pieces, display, damage, scoreText, describe: `${describeSets(pieces)} · ${mains}` }]
    })
    : []
  const simulatedOf = (simulation: StatSimulation) => simulated.find((s) => s.simulation.id === simulation.id)
  const simSubstats = SUBSTAT_STATS.map((stat) => ({ key: stat, label: stat }))
  const pickedForSimulation = best
    ? {
      label: `build #${selected + 1}`,
      pieceIds: best.discs.map((d) => d.id),
      rolls: rollsFromTotals(ZZZ_SIM_ROLLS, zzzSubstatTotals(best.discs)),
    }
    : undefined

  // The picked build's analysis rows, for Build analysis and Pin build
  const analysisRows: StatDiffRow[] = best
    ? [
      ...(byDamage
        ? [{
          key: 'damage',
          label: 'Rotation damage',
          build: best.damage ?? 0,
          current: currentDamage,
          format: (value: number) => formatNumber(Math.round(value)),
        }]
        : []),
      ...statRows.map((row) => ({
        key: row.key,
        label: row.label,
        build: best.display[row.key],
        current: currentDisplay?.[row.key],
        format: (value: number) => formatStat(row, value),
      })),
    ]
    : []

  // Saved builds (the sidebar's Builds group, after HSR's), by piece id
  function saveBuildNow() {
    if (best) buildActions.saveBuildNow(best.discs)
  }

  return {
    form: (
      <>
        <FormRows>
          <FormRow id='zzz-agent' title='Agent' summary={agentSummary}>
            <CharacterPortrait
              name={agent.name}
              portrait={images.agents[agent.id]?.portrait}
              accent={images.agents[agent.id]?.accent}
              weapon={wEngine && { image: images.wEngines[wEngine.id], name: wEngine.name }}
            />
            <FormCard title='Agent'>
              <ZzzAgentSelect images={images} value={agent.id} onChange={changeAgent} />
              <ZzzWEngineSelect
                images={images}
                value={loadout.wEngineId || null}
                onChange={(value) => setLoadout((prev) => ({ ...prev, wEngineId: value ?? '' }))}
              />
              <RankButtons
                label='Refinement'
                prefix='R'
                from={1}
                to={5}
                value={Number(loadout.refinement)}
                onChange={(value) => setLoadout((prev) => ({ ...prev, refinement: String(value) }))}
              />
              <RankButtons
                label='Core Skill'
                prefix=''
                from={1}
                to={6}
                names={['A', 'B', 'C', 'D', 'E', 'F']}
                value={Number(coreSkill)}
                onChange={(value) => setCoreSkill(String(value))}
              />
            </FormCard>

            <FormCard title='Recommended build' size='wide' description={`${preset.source} · ${preset.confidence}`}>
              <Button size='xs' variant='light' onClick={applyPreset}>Apply to the filters</Button>
              {importedPreset && (
                <SegmentedControl
                  fullWidth
                  value={presetSource}
                  onChange={(value) => {
                    setPresetSource(value === 'builtin' ? 'builtin' : 'imported')
                    setPresetChoice('0')
                  }}
                  data={[
                    { value: 'imported', label: `Imported: ${importedPreset.source}` },
                    { value: 'builtin', label: 'Built-in' },
                  ]}
                />
              )}
              {preset.sets.length > 1 && (
                <Select
                  allowDeselect={false}
                  value={presetChoice}
                  onChange={(value) => setPresetChoice(value ?? '0')}
                  data={preset.sets.map((choice, i) => ({ value: String(i), label: describeChoice(choice) }))}
                />
              )}
              <Stack gap={2}>
                {preset.sets.map((choice, i) => (
                  <Text key={i} size='xs'>
                    <Text span size='xs' c='dimmed'>{i === 0 ? 'Sets ' : 'Or '}</Text>
                    {`4pc ${setName(choice.fourPiece)} (${slotsWithSet(discs, choice.fourPiece)}/6 slots)${
                      choice.twoPiece ? ` + 2pc ${setName(choice.twoPiece)} (${slotsWithSet(discs, choice.twoPiece)}/6)` : ''
                    }`}
                  </Text>
                ))}
                {MAIN_STAT_SLOTS.map((slot) => (
                  <Text key={slot} size='xs'>
                    <Text span size='xs' c='dimmed'>{`Slot ${slot} `}</Text>
                    {mainStatText(preset.mainStats[slot])}
                  </Text>
                ))}
                {preset.substatPriority.length > 0 && (
                  <Text size='xs'>
                    <Text span size='xs' c='dimmed'>Substats</Text>
                    {preset.substatPriority.join(' > ')}
                  </Text>
                )}
              </Stack>
              {preset.notes && <Text size='xs' c='dimmed'>{preset.notes}</Text>}
              {needsReview(preset, new Date()) && (
                <Text size='xs' c='yellow'>
                  {preset === importedPreset
                    ? `Not updated in ${REVIEW_INTERVAL_DAYS} days or more, import a fresh copy`
                    : `Not reviewed in ${REVIEW_INTERVAL_DAYS} days or more`}
                </Text>
              )}
              <Text size='xs' c='dimmed'>
                {`Last reviewed ${preset.reviewed}${reviewAge === undefined ? '' : ` (${reviewAge} day${reviewAge === 1 ? '' : 's'} ago)`}`}
              </Text>

              <Accordion variant='contained' radius='sm'>
                <Accordion.Item value='own'>
                  <Accordion.Control>
                    <Text size='xs'>
                      {imported ? `Your presets: ${Object.keys(imported.presets).length} from ${imported.source || 'a file'}` : 'Use your own presets file'}
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap='xs'>
                      <FileInput placeholder='Choose a presets file (.json)' accept='application/json,.json' clearable onChange={handlePresetFile} />
                      {storedImport && <Button size='xs' variant='subtle' color='red' onClick={removeImportedPresets}>Remove imported presets</Button>}
                      <Text size='xs' c='dimmed'>
                        Kept in this browser only. Imported presets are for personal, non-commercial use, follow the terms of wherever they came from.
                      </Text>
                      {imported && <Notices messages={imported.warnings} max={MAX_IMPORT_WARNINGS} />}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </FormCard>

            <FormCard title='Rank by'>
              <Select
                label='Rank by'
                allowDeselect={false}
                value={sortBy}
                onChange={(value) => value && setSortBy(value as RankKey)}
                data={[{ value: 'damage', label: 'Rotation damage' }, ...statRows.map((row) => ({ value: row.key, label: row.label }))]}
              />
              <MultiSelect
                label='Then by (breaks ties)'
                placeholder={thenBy.length ? undefined : 'None'}
                value={thenBy}
                onChange={(value) => setThenBy(value as (keyof FinalStats)[])}
                data={statRows.filter((row) => row.key !== sortBy).map((row) => ({ value: row.key, label: row.label }))}
              />
              <ResultLimitSelect value={resultLimit} onChange={setResultLimit} />
            </FormCard>

            <OptimizerOptionsCard
              gearNoun='discs'
              ownerNoun='agents'
              rosterPage='Agents'
              excludeWorn={excludeEquippedByOthers}
              onExcludeWorn={setExcludeEquippedByOthers}
              priority={priorityFilter}
              onPriority={setPriorityFilter}
              keep={{ checked: keepCurrent, description: `Each slot only uses the disc in ${agent.name}'s build`, onChange: setKeepCurrent }}
              levels={[0, 3, 6, 9, 12, 15]}
              minLevel={minLevel}
              onMinLevel={setMinLevel}
              rarity={{
                label: 'Minimum rank',
                value: minRarity || 'any',
                options: [{ value: 'any', label: 'Any' }, { value: 'A', label: 'A-rank' }, { value: 'S', label: 'S-rank' }],
                onChange: (value) => setMinRarity(value === 'any' ? '' : value as DiscRarity),
              }}
              boost={boostMain}
              boostDescription='S-rank discs below +15 count with their +15 main stat'
              onBoost={setBoostMain}
            />
          </FormRow>

          <FormRow id='zzz-filters' title='Disc & stat filters' summary={filterSummary}>
            <FormCard title='Sets' size='narrow'>
              <SetPicker
                label='4-piece set'
                max={1}
                options={setOptions.map((o) => ({ ...o, icon: images.sets[o.value] }))}
                value={fourPieceSet ? [fourPieceSet] : []}
                onChange={(ids) => setFourPieceSet(ids[0] ?? null)}
              />
              <SetPicker
                label='2-piece set'
                max={1}
                options={setOptions.map((o) => ({ ...o, icon: images.sets[o.value] }))}
                value={twoPieceSet ? [twoPieceSet] : []}
                onChange={(ids) => setTwoPieceSet(ids[0] ?? null)}
              />
            </FormCard>
            <FormCard title='Main stats' size='narrow'>
              {MAIN_STAT_SLOTS.map((slot) => (
                <MultiSelect
                  key={slot}
                  label={`Slot ${slot}`}
                  placeholder={mainStats[slot]?.length ? undefined : 'Any'}
                  value={mainStats[slot] ?? []}
                  onChange={(value) => setMainStats((prev) => ({ ...prev, [slot]: value as ZzzStatsValues[] }))}
                  data={mainStatOptions[slot]}
                />
              ))}
            </FormCard>
            <FormCard title='Combat conditions' size='narrow' description='All off matches the stat screen. 4-pieces and most passives need combat.'>
              {(Object.keys(CONDITION_LABELS) as Condition[]).map((condition) => (
                <Switch
                  key={condition}
                  label={CONDITION_LABELS[condition]}
                  checked={conditions[condition]}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked
                    setConditions((prev) => ({ ...prev, [condition]: checked }))
                  }}
                />
              ))}
            </FormCard>
            <FormCard title='Stat filters' description='Builds outside any of these are left out.'>
              <StatFilters rows={statRows} min={minStats} max={maxStats} onMin={(next) => setMinStats(next)} onMax={(next) => setMaxStats(next)} />
            </FormCard>
          </FormRow>

          <FormRow
            id='zzz-team'
            title='Teammates'
            summary={zzzTeamSummary(teammates.map((id) => teammateOptions.find((o) => o.value === id)?.label ?? id), teamResult.applied)}
          >
            <TeamCards
              name={agent.name}
              options={teammateOptions}
              teammates={teammates}
              maxTeammates={2}
              entries={zzzTeamEntries(teamResult.applied)}
              notice={teamResult.missing.length > 0 ? `No stat screen for ${teamResult.missing.join(', ')}: save a build for them first` : undefined}
              description='Their kits and 4-piece sets buff this agent. Teammates use the discs and W-Engine in their saved build.'
              emptyText='Pick teammates to see what they give. Covers the squad buffs of 33 agents (Astra Yao, Caesar, Ju Fufu, Lighter, Lucia, Yuzuha, Zhao and more), squad 4-pieces (Swing Jazz, Astral Voice, Moonlight Lullaby, King of the Summit, Bunny in Wonderland) and 20 squad-buffing W-Engines.'
              footnote="Givers are taken at skill level 12 and Core Skill F (saved builds don't record those). W-Engines count at the refinement in their build. Enemy shred and Aftershock DMG count only in rotation damage; Daze isn't counted."
              onTeammates={(ids) => setTeammates(ids)}
              onSetting={(key, value) => setTeamSettings((prev) => ({ ...prev, [key]: value }))}
            />
            <TeammateOverrideCard
              rankPrefix='M'
              weaponLabel='W-Engine'
              refinementPrefix='R'
              overrides={team.overrides}
              onChange={setTeammateOverrides}
              members={teammates.flatMap((id) => {
                const build = builds.find((b) => b.agentId === id)
                if (!build || id === agent.id) return []
                const fourPiece = fourPieceSetsOf(Object.values(build.discIds).flatMap((discId) => discs.find((d) => d.id === discId)?.setId ?? []))[0]
                return [{
                  id,
                  name: build.name,
                  roster: { rank: build.mindscapeLevel, weaponId: build.wEngineId, refinement: build.wEngineRefinement ?? 1, fourPiece },
                  weapons: Object.values(W_ENGINES).map((w) => ({ value: w.id, label: w.name })),
                  sets: [...new Set([...(fourPiece ? [fourPiece] : []), ...Object.keys(SET_4PC_BUFFS)])].map((setId) => ({
                    value: setId,
                    label: SETS[setId]?.name ?? setId,
                  })),
                }]
              })}
            />
          </FormRow>

          <FormRow
            id='zzz-damage'
            title='Damage'
            summary={`${formatNumber(Math.round(damageSetup.multiplier + (damageSetup.aftershock?.multiplier ?? 0)))}% of ATK per rotation${
              damageSetup.anomalyMultiplier ? ` + ${formatNumber(Math.round(damageSetup.anomalyMultiplier))}% anomaly` : ''
            } · enemy DEF ${enemy.def}${enemy.stunned ? ', stunned' : ''}`}
          >
            <EnemyCard enemy={enemy} debuffs={teamResult.debuffs} teamElements={teamElements} onChange={(next) => setEnemy(next)} />
            <RotationCard
              agentId={agent.id}
              element={agent.element}
              teamElements={teamElements}
              scaling={agent.specialty === 'Rupture' ? 'Sheer Force' : agent.specialty === 'Armorer' ? 'DEF' : 'ATK'}
              rotation={rotation}
              damage={currentDamage}
              onChange={(next) => setRotation(next)}
            />
            <KitEffectsCard
              name={agent.name}
              applied={kit.applied}
              onSetting={(id, value) => setCombatSettings((current) => ({ ...current, [id]: value }))}
            />
            <ExtraBuffsCard defs={ZZZ_EXTRA_BUFFS} buffs={extraBuffs} onChange={setExtraBuffs} />
          </FormRow>
          <FormRow
            id='zzz-simulation'
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
        <KitDisclaimer name={agent.name} effects={KIT_EFFECTS[agent.id]} byDamage={byDamage} />
      </>
    ),
    sidebar: {
      pools: pools.map((pool, i) => ({ label: `Slot ${i + 1}`, value: pool.length })),
      combinations: combinations,
      hint: { text: searchHint, warn: !canSearch },
      canStart: canSearch,
      results: outcome?.ok ? { count: outcome.builds.length, seconds: (result?.ms ?? 0) / 1000 } : undefined,
      equip: best ? { label: `build #${selected + 1}`, onEquip: equipBuild, equipped: isWorn } : undefined,
      onStart: run,
      pin: best ? { label: `#${selected + 1} · ${rankText(best)}`, cells: pinnedCells(analysisRows) } : undefined,
      onSave: best ? saveBuildNow : undefined,
    },
    results: {
      intro: outcome ? undefined : {
        title: `Find the best discs for ${agent.name}`,
        text: 'Apply the recommended build or pick your own filters, then search. The best 50 combinations show up here.',
      },
      emptyPool: !running && emptySlots.length > 0 ? { causes: noResultCauses(), empty: 'slot' } : undefined,
      failure: outcome && !outcome.ok ? outcome.reason : undefined,
      results: outcome?.ok
        ? {
          description: `${formatNumber(outcome.matched)} of ${
            formatNumber(outcome.combinations)
          } combinations meet the filters, showing the best ${outcome.builds.length}`,
          causes: noResultCauses,
          grid: outcome.builds.length === 0 ? undefined : {
            gridKey: `${outcome.builds.length}${sortBy}`,
            columns: [
              ...(byDamage
                ? [{ key: 'damage', label: 'Rotation damage', format: (value: number) => formatNumber(Math.round(value)), primary: true, width: 110 }]
                : []),
              ...resultColumns.map((row) => ({
                key: row.key,
                label: row.label,
                format: (value: number) => formatStat(row, value),
                primary: row.key === sortBy,
              })),
            ],
            rows: outcome.builds.map((build, i) => ({
              id: String(i),
              rank: String(i + 1),
              values: {
                ...Object.fromEntries(
                  resultColumns.map((row) => [row.key, (statView === 'basic' ? screenDisplay(build.discs) ?? build.display : build.display)[row.key]]),
                ),
                damage: build.damage ?? 0,
              },
              sets: describeSets(build.discs),
            })),
            current: currentDisplay
              ? {
                id: 'now',
                rank: 'Now',
                values: {
                  ...Object.fromEntries(
                    resultColumns.map((row) => [row.key, (statView === 'basic' ? screenDisplay(currentDiscs) ?? currentDisplay : currentDisplay)[row.key]]),
                  ),
                  damage: currentDamage ?? 0,
                },
                sets: describeSets(currentDiscs),
              }
              : undefined,
            simulated: simulated.map((s) => ({
              id: s.simulation.id,
              rank: 'Sim',
              values: {
                ...Object.fromEntries(resultColumns.map((row) => [row.key, s.display[row.key]])),
                damage: s.damage ?? 0,
              },
              sets: `${s.simulation.name} · ${describeSets(s.pieces)}`,
            })),
            selected,
            onSelect: setSelected,
          },
        }
        : undefined,
      preview: (
        <>
          {best && (
            <BuildPreview
              title={`Build #${selected + 1}`}
              description={`${describeSets(best.discs)}${
                currentDisplay ? ` · ${rankLabel} ${rankText(best)} vs ${rankText({ display: currentDisplay, damage: currentDamage })} now` : ''
              }`}
              name={agent.name}
              accent={images.agents[agent.id]?.accent}
              portrait={images.agents[agent.id]?.portrait}
              weapon={wEngine && { image: images.wEngines[wEngine.id], name: wEngine.name, meta: `${wEngine.rarity}-rank · R${loadout.refinement}` }}
              heading={
                <Group gap={6} mt={4}>
                  <Badge size='sm' variant='light' color={elementColor(agent.element)}>{agent.element}</Badge>
                  <Badge size='sm' variant='light' color='gray'>{agent.specialty}</Badge>
                  <Text size='xs' c='dimmed'>{`Lv ${agent.level} · Core Skill ${'ABCDEF'[Number(coreSkill) - 1]}`}</Text>
                </Group>
              }
              rows={zzzStatRows(best.display, agent.specialty)}
              rating={pickedDpsScore ?? scoreBuild(best.discs.map((disc) => scoreDisc(disc, zzzDiscWeights(agent))), 6)}
              ratingLabel={pickedDpsScore ? DPS_SCORE_LABEL : 'Disc score'}
              notes={best.warnings}
              gear={best.discs.map((disc) => (
                <DiscCard
                  key={disc.id}
                  disc={disc}
                  icon={images.sets[disc.setId]}
                  owner={disc.equippedBy ? (ownerNames.get(disc.equippedBy) ?? `Agent ${disc.equippedBy}`) : undefined}
                  score={scoreDisc(disc, zzzDiscWeights(agent))}
                />
              ))}
            />
          )}

          {best && computeInput && (
            <BuildAnalysis
              teammateUpgrades={teammateUpgrades && { ranked: teammateUpgrades, setName }}
              buildLabel={`Build #${selected + 1}`}
              rows={analysisRows}
              upgrades={zzzSubstatUpgrades({ ...computeInput, discs: best.discs }, sortBy, damageSetup)}
              breakdown={breakdown}
              scoreLabel={rankLabel}
              formatRoll={(upgrade) => /%|CRIT/.test(upgrade.stat) ? `${upgrade.roll}%` : String(upgrade.roll)}
            />
          )}
        </>
      ),
    },
    footer: (
      <>
        <RememberDamageScore game='zzz' characterId={agent.id} pieceIds={currentDiscs.map((d) => d.id)} score={currentDpsScore} />
      </>
    ),
  }
}

// The columns of the results table: the ranking stats first, then what matters for the agent's specialty
function resultColumnsFor(agent: AgentData, sortBy: RankKey, thenBy: (keyof FinalStats)[]): StatRow[] {
  const bySpecialty: Partial<Record<string, (keyof FinalStats)[]>> = {
    Anomaly: ['anomalyProficiency', 'anomalyMastery'],
    Stun: ['impact'],
    Rupture: ['sheerForce'],
  }
  const keys = [
    ...(sortBy === 'damage' ? [] : [sortBy]),
    ...thenBy,
    'atk',
    'critRate',
    'critDmg',
    ...(bySpecialty[agent.specialty] ?? []),
    'hp',
    'def',
  ] as (keyof FinalStats)[]
  return [...new Set(keys)].flatMap((key) => STAT_ROWS.filter((row) => row.key === key))
}
