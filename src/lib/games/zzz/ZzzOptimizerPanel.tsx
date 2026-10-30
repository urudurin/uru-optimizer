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
import { IconTrendingUp } from '@tabler/icons-react'
import {
  splitDamage,
} from 'lib/games/shared/damageBreakdown'
import { formatNumber } from 'lib/games/shared/format'
import { scoreBuild } from 'lib/games/shared/gearScore'
import {
  fieldSetter,
  migrateOptimizerSettings,
  readOptimizerSettings,
  rememberCharacter,
  useCharacterSettings,
} from 'lib/games/shared/optimizerSettings'
import type { SearchProgress } from 'lib/games/shared/progress'
import { BuildAnalysis } from 'lib/games/shared/ui/BuildAnalysis'
import {
  EmptyState,
  Notices,
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import classes from 'lib/games/shared/ui/Optimizer.module.css'
import {
  BuildCompare,
  usePinnedBuilds,
} from 'lib/games/shared/ui/optimizer/BuildCompare'
import { BuildPreview } from 'lib/games/shared/ui/optimizer/BuildPreview'
import {
  CharacterPortrait,
  RankButtons,
} from 'lib/games/shared/ui/optimizer/CharacterPanel'
import { ResultsGrid } from 'lib/games/shared/ui/optimizer/ResultsGrid'
import { SetPicker } from 'lib/games/shared/ui/optimizer/SetPicker'
import {
  limitsSummary,
  StatFilters,
} from 'lib/games/shared/ui/optimizer/StatFilters'
import { TeamCards } from 'lib/games/shared/ui/optimizer/TeamCards'
import {
  FormCard,
  FormRow,
  FormRows,
} from 'lib/games/shared/ui/OptimizerForm'
import { OptimizerSidebar } from 'lib/games/shared/ui/OptimizerSidebar'
import { resolveZzzCombat } from 'lib/games/zzz/damage/combatEffects'
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
import { useZzzImages } from 'lib/games/zzz/data/images'
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
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import { zzzSubstatUpgrades } from 'lib/games/zzz/optimizer/analysis'
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
import {
  cancelDiscOptimizer,
  runDiscOptimizer,
} from 'lib/games/zzz/optimizer/optimizerClient'
import { usePresetImportStore } from 'lib/games/zzz/state/presetImportStore'
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
import type { ZzzBuffSetting } from 'lib/games/zzz/team/buffs'
import { zzzTeamBuffsFor } from 'lib/games/zzz/team/teamBuffs'
import {
  zzzTeamEntries,
  zzzTeamSummary,
} from 'lib/games/zzz/team/teamEntries'
import type {
  Disc,
  ZzzStatsValues,
} from 'lib/games/zzz/types'
import { zzzStatRows } from 'lib/games/zzz/ui/agentStats'
import {
  DiscCard,
  elementColor,
} from 'lib/games/zzz/ui/DiscCard'
import {
  useCallback,
  useMemo,
  useState,
} from 'react'

const RESULT_LIMIT = 50
const MAX_IMPORT_WARNINGS = 6
const MAIN_STAT_SLOTS: MainStatSlot[] = [4, 5, 6]

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
  // Agent ids, and the team buffs' toggles and stack counts (team/teamBuffs.ts)
  teammates: string[],
  teamSettings: Record<string, ZzzBuffSetting>,
  // The enemy and the rotation, for ranking by damage (damage/damage.ts)
  enemy: EnemySettings,
  rotation: Rotation,
  // Toggles of the agent's own kit effects (damage/combatEffects.ts)
  combatSettings: Record<string, boolean | number>,
}

// The user's own W-Engine for this agent when it's supported, otherwise the first one of the agent's specialty
function defaultLoadout(agent: AgentData, builds: ImportedBuild[]): Loadout {
  const build = builds.find((b) => b.agentId === agent.id && b.wEngineId && W_ENGINES[b.wEngineId])
  if (build?.wEngineId) return { wEngineId: build.wEngineId, refinement: String(build.wEngineRefinement) }
  const engine = Object.values(W_ENGINES).find((w) => w.specialty === agent.specialty) ?? Object.values(W_ENGINES)[0]
  return { wEngineId: engine.id, refinement: '1' }
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

export function ZzzOptimizerPanel({ onImport }: { onImport: () => void }) {
  useState(migrateSaves)
  const discs = useZzzStore((s) => s.discs)
  const builds = useZzzStore((s) => s.builds)
  const images = useZzzImages()
  // Every agent and W-Engine, once Enka's data has loaded (data/enkaGameData.ts)
  useZzzGameData()

  const agents = Object.values(AGENTS)
  const fallbackAgent = agents.find((a) => builds.some((b) => b.agentId === a.id)) ?? agents[0]
  // The last agent opened, even one from Enka's data, which loads after the first render: until it has, the page shows
  // the first agent with a build
  const [agentId, setAgentId] = useState(() => readOptimizerSettings(SETTINGS_KEY).last ?? fallbackAgent.id)
  const agent = AGENTS[agentId] ?? fallbackAgent
  // An agent nobody changed yet starts with the user's own W-Engine and the stat screen's conditions
  const defaultSettings = useCallback((id: string): ZzzOptimizerSettings => ({
    loadout: defaultLoadout(AGENTS[id] ?? agent, builds),
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
    teammates: [],
    teamSettings: {},
    enemy: DEFAULT_ENEMY,
    rotation: defaultRotation(id),
    combatSettings: {},
  }), [agent, builds])
  const [settings, updateSettings] = useCharacterSettings(SETTINGS_KEY, agent.id, defaultSettings)
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
    teammates,
    teamSettings,
    enemy,
    rotation,
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
  const setTeammates = fieldSetter(updateSettings, 'teammates')
  const setTeamSettings = fieldSetter(updateSettings, 'teamSettings')
  const setEnemy = fieldSetter(updateSettings, 'enemy')
  const setRotation = fieldSetter(updateSettings, 'rotation')
  const setCombatSettings = fieldSetter(updateSettings, 'combatSettings')
  // What the squad gives this agent, the same for every build
  const team = { teammates, settings: teamSettings }
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
  // The agent's kit and gear plus what teammates give some hits only (Pulchra's Aftershock DMG)
  // The kit's anomaly bonuses plus the squad's (Remielle's Refringe)
  const anomalyBonus = addAnomalyBonuses(addAnomalyBonuses({}, kit.anomalyBonus), teamResult.anomalyBonus)
  const kindBonus = { ...kit.kindBonus }
  for (const [kind, value] of Object.entries(teamResult.kindBonus) as [keyof typeof kindBonus, number][]) {
    kindBonus[kind] = (kindBonus[kind] ?? 0) + value
  }
  const combatEffects = byDamage ? [...teamResult.effects, ...kit.statEffects] : teamResult.effects
  // The squad's attributes: Vortex lines, Windswept and Frostbite need a Wind or Ice agent
  const teamElements = [agent.element, ...teammates.map((id) => AGENTS[id]?.element ?? '')]
  // The rotation and enemy, for ranking by damage; the team's shred counts here
  const setupFor = (lines: Rotation): DamageSetup => ({
    ...rotationSkills(agent.id, lines, kindBonus, kit.skillBonus, {
      critDmgFromCritDmg: kit.aftershockCritDmg,
      defIgnore: kit.aftershockDefIgnore,
    }, kit.kindDefIgnore),
    ...(kit.veilVulnerabilityCap > 0 ? { veilVulnerabilityCap: kit.veilVulnerabilityCap } : {}),
    scaling: agent.specialty === 'Rupture' ? 'sheer' : agent.specialty === 'Armorer' ? 'sharp' : 'atk',
    lacerationDmg: 150 + kit.lacerationBonus,
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
    debuffs: {
      ...teamResult.debuffs,
      defShred: teamResult.debuffs.defShred + kit.defIgnore,
      resShred: teamResult.debuffs.resShred + kit.resIgnore,
      // Stun multiplier bonuses from different agents add up (Nangong Yu's Misstep, Norma's Tech Divide)
      stunBonus: teamResult.debuffs.stunBonus + kit.stunBonus,
    },
  })
  const damageSetup = setupFor(rotation)
  const teammateOptions = [...new Map(builds.filter((b) => b.agentId !== agent.id && AGENTS[b.agentId]).map((b) => [b.agentId, b.name]))]
    .map(([value, label]) => ({ value, label }))
  const [outcome, setOutcome] = useState<OptimizerOutcome | null>(null)
  const [selected, setSelected] = useState(0)
  const pins = usePinnedBuilds(agent.id)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SearchProgress | undefined>()
  const [searchSeconds, setSearchSeconds] = useState(0)
  const equip = useZzzStore((s) => s.equip)

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
  }
  const pools = filterPools({ agent, discs, filters })
  const combinations = countCombinations(pools)
  const emptySlots = pools.flatMap((pool, i) => pool.length === 0 ? [i + 1] : [])

  function changeAgent(id: string | null) {
    if (!id || !AGENTS[id]) return
    setAgentId(id)
    rememberCharacter(SETTINGS_KEY, id)
    setOutcome(null)
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
    setOutcome(null)
  }

  async function handlePresetFile(file: File | null) {
    if (!file) return
    importPresetText(await file.text())
    setPresetSource('imported')
    setPresetChoice('0')
  }

  function removeImportedPresets() {
    if (window.confirm('Remove the imported presets from this browser?')) clearImportedPresets()
  }

  // The search runs in a web worker, so the page stays responsive while it works
  async function run() {
    if (!W_ENGINES[loadout.wEngineId]) return
    setRunning(true)
    setProgress(undefined)
    const response = await runDiscOptimizer({
      agentId: agent.id,
      wEngineId: loadout.wEngineId,
      wEngineRefinement: Number(loadout.refinement),
      coreSkillLevel: Number(coreSkill),
      conditions,
      discs,
      filters,
      minStats,
      maxStats,
      teamEffects: combatEffects,
      damage: damageSetup,
      sortBy,
      thenBy,
      limit: RESULT_LIMIT,
    }, setProgress)
    // undefined: cancelled, or replaced by a newer search that is still running
    if (response) {
      setOutcome(response.outcome)
      setSearchSeconds(response.ms / 1000)
      setSelected(0)
      setRunning(false)
    }
  }

  function cancel() {
    cancelDiscOptimizer()
    setRunning(false)
  }

  if (discs.length === 0) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Optimizer' />
        <Panel>
          <EmptyState
            icon={<IconTrendingUp size={24} />}
            title='Import your discs first'
            action={
              <Group gap='xs'>
                <Button onClick={onImport}>Import discs</Button>
                <Button variant='light' onClick={() => useZzzStore.getState().importParsed(zzzSampleData(), 'replace')}>Try with sample data</Button>
              </Group>
            }
          >
            The optimizer searches every combination of the discs you own for the best build.
          </EmptyState>
        </Panel>
      </Stack>
    )
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
  const computeInput = wEngine
    ? { agent, wEngine, wEngineRefinement: Number(loadout.refinement), coreSkillLevel: Number(coreSkill), conditions, teamEffects: combatEffects }
    : undefined
  const currentDiscs = agentBuild ? Object.values(agentBuild.discIds).flatMap((id) => discs.find((d) => d.id === id) ?? []) : []
  const currentStats = computeInput && currentDiscs.length > 0 ? computeStats({ ...computeInput, discs: currentDiscs }).stats : undefined
  const currentDisplay = currentStats && toDisplayStats(currentStats)
  const currentDamage = currentStats && rotationDamage(currentStats, damageSetup)
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
  const agentSummary = `${agent.name} · ${W_ENGINES[loadout.wEngineId]?.name ?? 'No W-Engine'} R${loadout.refinement} · ranked by ${rankLabel}`
  const mainFilters = MAIN_STAT_SLOTS.filter((slot) => mainStats[slot]?.length).length
  const conditionCount = Object.values(conditions).filter(Boolean).length
  const filterSummary = [
    [fourPieceSet ? `4pc ${setName(fourPieceSet)}` : '', twoPieceSet ? `2pc ${setName(twoPieceSet)}` : ''].filter(Boolean).join(' + ') || 'Any sets',
    mainFilters ? `${mainFilters} main stat filter${mainFilters === 1 ? '' : 's'}` : 'any main stats',
    conditionCount ? `${conditionCount} combat condition${conditionCount === 1 ? '' : 's'} on` : 'stat screen',
    limitsSummary(minStats, maxStats),
  ].join(' · ')
  const isWorn = !!best && best.discs.every((disc) => agentBuild?.discIds[disc.slot] === disc.id)

  function equipBuild() {
    if (!best) return
    const losing = zzzPiecesTaken({ discs, builds }, agent.id, best.discs).map((id) => ownerNames.get(id) ?? AGENTS[id]?.name ?? `Agent ${id}`)
    const swap = losing.length > 0
      ? `

${losing.join(', ')} will get ${agent.name}'s current discs in exchange.`
      : ''
    if (!window.confirm(`Equip build #${selected + 1} on ${agent.name} in this browser's save?${swap}`)) return
    equip(agent, { id: loadout.wEngineId, refinement: Number(loadout.refinement) }, best.discs)
  }

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Optimizer'
        description='Searches every combination of your discs and ranks them by rotation damage or the stat you pick. Rotation damage uses the Damage row; set minimums (such as Energy Regen) for anything else the agent needs.'
      />

      <div className={classes.optimizerLayout}>
        <Stack gap='md'>
          <FormRows>
            <FormRow id='zzz-agent' title='Agent' summary={agentSummary}>
              <CharacterPortrait
                name={agent.name}
                portrait={images.agents[agent.id]?.portrait}
                accent={images.agents[agent.id]?.accent}
                weapon={wEngine && { image: images.wEngines[wEngine.id], name: wEngine.name }}
              />
              <FormCard title='Agent'>
                <Select
                  aria-label='Agent'
                  allowDeselect={false}
                  value={agent.id}
                  onChange={changeAgent}
                  data={agents.map((a) => ({ value: a.id, label: a.name }))}
                />
                <Select
                  label='W-Engine'
                  allowDeselect={false}
                  value={loadout.wEngineId}
                  onChange={(value) => value && setLoadout((prev) => ({ ...prev, wEngineId: value }))}
                  data={Object.values(W_ENGINES).map((w) => ({ value: w.id, label: w.name }))}
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

              <FormCard title='Ranking'>
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
              </FormCard>
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
            </FormRow>

            <FormRow
              id='zzz-team'
              title='Team'
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
                emptyText='Pick teammates to see what they give. Covers Astra Yao, Lucy, Soukaku, Caesar, Rina, Nicole, Trigger, Seth and Pulchra, squad 4-pieces (Swing Jazz, Astral Voice, Moonlight Lullaby, King of the Summit, Bunny in Wonderland) and 20 squad-buffing W-Engines.'
                footnote="Givers are taken at skill level 12 and Core Skill F (saved builds don't record those). W-Engines count at the refinement in their build. Enemy shred and Aftershock DMG count only in rotation damage; Daze isn't counted."
                onTeammates={(ids) => setTeammates(ids)}
                onSetting={(key, value) => setTeamSettings((prev) => ({ ...prev, [key]: value }))}
              />
            </FormRow>

            <FormRow id='zzz-filters' title='Disc filters' summary={filterSummary}>
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
                <Switch
                  label='Leave out discs other agents are wearing'
                  checked={excludeEquippedByOthers}
                  onChange={(event) => setExcludeEquippedByOthers(event.currentTarget.checked)}
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
          </FormRows>

          {!outcome && (
            <Panel>
              <EmptyState icon={<IconTrendingUp size={24} />} title={`Find the best discs for ${agent.name}`}>
                Apply the recommended build or pick your own filters, then search. The best 50 combinations show up here.
              </EmptyState>
            </Panel>
          )}

          {outcome && !outcome.ok && <Notices messages={[outcome.reason]} />}

          {outcome?.ok && (
            <Panel
              title='Results'
              description={`${formatNumber(outcome.matched)} of ${
                formatNumber(outcome.combinations)
              } combinations meet the filters, showing the best ${outcome.builds.length}`}
            >
              {outcome.builds.length === 0
                ? <Text size='sm' c='dimmed'>Nothing matched. Loosen the minimum stats or filters and search again.</Text>
                : (
                  <ResultsGrid
                    key={outcome.builds.length + sortBy}
                    columns={[
                      ...(byDamage
                        ? [{ key: 'damage', label: 'Rotation damage', format: (value: number) => formatNumber(Math.round(value)), primary: true, width: 110 }]
                        : []),
                      ...resultColumns.map((row) => ({
                        key: row.key,
                        label: row.label,
                        format: (value: number) => formatStat(row, value),
                        primary: row.key === sortBy,
                      })),
                    ]}
                    rows={outcome.builds.map((build, i) => ({
                      id: String(i),
                      rank: String(i + 1),
                      values: { ...Object.fromEntries(resultColumns.map((row) => [row.key, build.display[row.key]])), damage: build.damage ?? 0 },
                      sets: describeSets(build.discs),
                    }))}
                    current={currentDisplay
                      ? {
                        id: 'now',
                        rank: 'Now',
                        values: { ...Object.fromEntries(resultColumns.map((row) => [row.key, currentDisplay[row.key]])), damage: currentDamage ?? 0 },
                        sets: describeSets(currentDiscs),
                      }
                      : undefined}
                    selected={selected}
                    onSelect={setSelected}
                  />
                )}
            </Panel>
          )}

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
              rating={scoreBuild(best.discs.map((disc) => scoreDisc(disc, zzzDiscWeights(agent))), 6)}
              ratingLabel='Disc score'
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
              buildLabel={`Build #${selected + 1}`}
              rows={[
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
              ]}
              onPin={(cells) => pins.pin(`#${selected + 1} · ${rankText(best)}`, cells)}
              upgrades={zzzSubstatUpgrades({ ...computeInput, discs: best.discs }, sortBy, damageSetup)}
              breakdown={breakdown}
              scoreLabel={rankLabel}
              formatRoll={(upgrade) => /%|CRIT/.test(upgrade.stat) ? `${upgrade.roll}%` : String(upgrade.roll)}
            />
          )}
          <BuildCompare pinned={pins.pinned} onUnpin={pins.unpin} />
        </Stack>

        <OptimizerSidebar
          pools={pools.map((pool, i) => ({ label: `Slot ${i + 1}`, value: pool.length }))}
          combinations={combinations}
          hint={{ text: searchHint, warn: !canSearch }}
          canStart={canSearch}
          running={running}
          progress={progress}
          onStart={run}
          onCancel={cancel}
          results={outcome?.ok ? { count: outcome.builds.length, seconds: searchSeconds } : undefined}
          equip={best ? { label: `build #${selected + 1}`, onEquip: equipBuild, equipped: isWorn } : undefined}
        />
      </div>
    </Stack>
  )
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
