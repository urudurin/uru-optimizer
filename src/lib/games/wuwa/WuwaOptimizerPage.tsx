import {
  Badge,
  Button,
  Group,
  MultiSelect,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { IconTrendingUp } from '@tabler/icons-react'
import {
  ranksAbove,
  usePriority,
} from 'lib/games/shared/characterPriority'
import {
  type DamagePart,
  splitDamage,
} from 'lib/games/shared/damageBreakdown'
import type { ExtraBuffs } from 'lib/games/shared/extraBuffs'
import { formatNumber } from 'lib/games/shared/format'
import { swapsOnEquip } from 'lib/games/shared/gameSettings'
import { todayString } from 'lib/games/shared/importedPresets'
import {
  type FilterCause,
  type PoolCandidate,
  poolCauses,
  statLimitCauses,
} from 'lib/games/shared/noResults'
import {
  fieldSetter,
  migrateOptimizerSettings,
  readOptimizerSettings,
  rememberCharacter,
  useCharacterSettings,
} from 'lib/games/shared/optimizerSettings'
import type { SearchProgress } from 'lib/games/shared/progress'
import {
  deleteSavedBuild,
  saveBuild,
  type SavedBuild,
  savedBuilds,
} from 'lib/games/shared/savedBuilds'
import {
  keepOverridesFor,
  type TeammateOverrides,
} from 'lib/games/shared/teammateOverrides'
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
import { ExtraBuffsCard } from 'lib/games/shared/ui/optimizer/ExtraBuffsCard'
import { KitDisclaimer } from 'lib/games/shared/ui/optimizer/KitDisclaimer'
import { NoResults } from 'lib/games/shared/ui/optimizer/NoResults'
import {
  DEFAULT_RESULT_LIMIT,
  resultLimitOf,
  ResultLimitSelect,
} from 'lib/games/shared/ui/optimizer/ResultLimit'
import { ResultsGrid } from 'lib/games/shared/ui/optimizer/ResultsGrid'
import {
  openSaveBuildModal,
  openSavedBuildsModal,
} from 'lib/games/shared/ui/optimizer/SavedBuilds'
import { SetPicker } from 'lib/games/shared/ui/optimizer/SetPicker'
import {
  limitsSummary,
  StatFilters,
} from 'lib/games/shared/ui/optimizer/StatFilters'
import { TeamCards } from 'lib/games/shared/ui/optimizer/TeamCards'
import { TeammateOverrideCard } from 'lib/games/shared/ui/optimizer/TeammateOverrideCard'
import {
  FormCard,
  FormRow,
  FormRows,
} from 'lib/games/shared/ui/OptimizerForm'
import type { StatView } from 'lib/games/shared/ui/OptimizerSidebar'
import { OptimizerSidebar } from 'lib/games/shared/ui/OptimizerSidebar'
import {
  resolveWuwaCombat,
  resolveWuwaSetEffects,
} from 'lib/games/wuwa/damage/combatEffects'
import { KIT_EFFECTS } from 'lib/games/wuwa/damage/combatEffects'
import {
  type DamageSetup,
  DEFAULT_ENEMY,
  defaultRotation,
  type EnemySettings,
  hasSkillData,
  mainEchoBonus,
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
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import { wuwaSampleData } from 'lib/games/wuwa/data/sampleData'
import { useUserArt } from 'lib/games/wuwa/data/userArt'
import { MAIN_STAT_MAX } from 'lib/games/wuwa/echoStats'
import {
  wuwaDamageScore,
  wuwaSubstatUpgrades,
} from 'lib/games/wuwa/optimizer/analysis'
import {
  countLoadouts,
  type EchoOutcome,
  type EchoTarget,
  filterPool,
  targetLabel,
  withFullSets,
  wuwaStatLabel,
} from 'lib/games/wuwa/optimizer/echoOptimizer'
import {
  cancelEchoOptimizer,
  runEchoOptimizer,
} from 'lib/games/wuwa/optimizer/optimizerClient'
import {
  WUWA_SETTINGS_KEY as SETTINGS_KEY,
  WUWA_TARGETS as TARGETS,
  wuwaTarget,
} from 'lib/games/wuwa/optimizer/targets'
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
import type { WuwaBuffSetting } from 'lib/games/wuwa/team/buffs'
import {
  withWuwaExtraBuffs,
  WUWA_EXTRA_BUFFS,
  wuwaExtraEnemy,
} from 'lib/games/wuwa/team/extraBuffs'
import {
  NO_WUWA_TEAM,
  wuwaTeamBuffsFor,
} from 'lib/games/wuwa/team/teamBuffs'
import {
  wuwaTeamEntries,
  wuwaTeamSummary,
} from 'lib/games/wuwa/team/teamEntries'
import {
  type Cost,
  type Echo,
  MAX_LOADOUT_COST,
  type StatKey,
  statLabel,
} from 'lib/games/wuwa/types'
import {
  EchoCard,
  elementColor,
  elementName,
  setName,
} from 'lib/games/wuwa/ui/EchoCard'
import { WEAPON_OPTIONS } from 'lib/games/wuwa/ui/ResonatorForm'
import { wuwaStatRows } from 'lib/games/wuwa/ui/resonatorStats'
import { Message } from 'lib/interactions/message'
import {
  useMemo,
  useReducer,
  useState,
} from 'react'

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

type WuwaOptimizerSettings = {
  targetValue: string,
  mainStats: Partial<Record<Cost, StatKey[]>>,
  fullSet: string | null,
  twoPieceSets: string[],
  excludeEquippedByOthers: boolean,
  // HSR's character priority filter: leave out gear worn by characters ranked above (shared/characterPriority.ts)
  priorityFilter: boolean,
  resultLimit: number,
  minStats: Partial<Record<keyof WuwaStats, number>>,
  maxStats: Partial<Record<keyof WuwaStats, number>>,
  // Character ids, and the team buffs' toggles and stack counts (team/teamBuffs.ts)
  teammates: string[],
  // Rank, weapon and 4-piece changes per teammate, for the team buffs only (shared/teammateOverrides.ts)
  teammateOverrides: TeammateOverrides,
  // Buffs typed in by hand, added to every build (shared/extraBuffs.ts)
  extraBuffs: ExtraBuffs,
  teamSettings: Record<string, WuwaBuffSetting>,
  // The rotation damage target (damage/damage.ts): the enemy and the rotation
  enemy: EnemySettings,
  rotation: Rotation,
  // Toggles of the Resonator's own kit effects (damage/combatEffects.ts)
  combatSettings: Record<string, boolean | number>,
}

// Rank by values: 'damage' plus the stat targets in optimizer/targets.ts
const DAMAGE_TARGET = 'damage'

// What a Resonator starts with before their settings are changed (and saved)
function defaultSettings(charId: string): WuwaOptimizerSettings {
  return {
    targetValue: hasSkillData(charId) ? DAMAGE_TARGET : 'avg:atk',
    mainStats: {},
    fullSet: null,
    twoPieceSets: [],
    excludeEquippedByOthers: true,
    priorityFilter: false,
    resultLimit: DEFAULT_RESULT_LIMIT,
    minStats: {},
    maxStats: {},
    teammates: [],
    teamSettings: {},
    teammateOverrides: {},
    extraBuffs: {},
    enemy: DEFAULT_ENEMY,
    rotation: defaultRotation(charId),
    combatSettings: {},
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

export function WuwaOptimizerPage({ onImport }: { onImport: () => void }) {
  useState(migrateSaves)
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const art = useUserArt()
  const saveCharacter = useWuwaStore((s) => s.saveCharacter)
  const teams = useWuwaStore((s) => s.teams)
  const priority = useWuwaStore((s) => s.priority)
  const equip = useWuwaStore((s) => s.equip)
  const [characterId, setCharacterId] = useState<string | null>(() => readOptimizerSettings(SETTINGS_KEY).last ?? null)
  const character = characters.find((c) => c.charId === characterId) ?? characters[0]

  // Saved per Resonator, see shared/optimizerSettings.ts
  const [settings, updateSettings] = useCharacterSettings(SETTINGS_KEY, character?.charId ?? '', () => defaultSettings(character?.charId ?? ''))
  const {
    targetValue,
    mainStats,
    fullSet,
    twoPieceSets,
    excludeEquippedByOthers,
    priorityFilter,
    resultLimit,
    minStats,
    maxStats,
    teammates,
    teamSettings,
    teammateOverrides,
    extraBuffs,
    enemy,
    rotation,
    combatSettings,
  } = settings
  const setTargetValue = fieldSetter(updateSettings, 'targetValue')
  const setMainStats = fieldSetter(updateSettings, 'mainStats')
  const setFullSet = fieldSetter(updateSettings, 'fullSet')
  const setTwoPieceSets = fieldSetter(updateSettings, 'twoPieceSets')
  const setExcludeEquippedByOthers = fieldSetter(updateSettings, 'excludeEquippedByOthers')
  const setPriorityFilter = fieldSetter(updateSettings, 'priorityFilter')
  // Gear worn by characters ranked above is left out when the priority filter is on (and worn gear is otherwise allowed)
  const rankOrder = usePriority('wuwa')
  const excludeOwners = useMemo(
    () => (priorityFilter && !excludeEquippedByOthers ? ranksAbove(characters.map((c) => c.charId), rankOrder, character?.charId ?? '') : undefined),
    [priorityFilter, excludeEquippedByOthers, rankOrder, characters, character?.charId],
  )
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
  // What the team gives this Resonator, the same for every loadout (nothing before anything is imported)
  const teamOverrides = keepOverridesFor(teammateOverrides, teammates)
  const teamResult = character
    ? wuwaTeamBuffsFor(character, { teammates, settings: teamSettings, overrides: teamOverrides }, { characters, echoes })
    : NO_WUWA_TEAM
  const teammateOptions = characters.filter((c) => c.charId !== character?.charId).map((c) => ({ value: c.charId, label: characterName(c.charId) }))
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SearchProgress | undefined>()
  const [result, setResult] = useState<{ outcome: EchoOutcome, ms: number, target: EchoTarget } | undefined>()
  const [selected, setSelected] = useState(0)
  const pins = usePinnedBuilds(character?.charId ?? '')
  // Results columns: in-combat stats (team, kit and set buffs) or the stat screen, after HSR's stat view
  const [statView, setStatView] = useState<StatView>('combat')
  // Saved builds of this character; bumped after a save or delete to read them again
  const [buildsVersion, bumpBuilds] = useReducer((n: number) => n + 1, 0)
  const savedList = useMemo(() => (buildsVersion >= 0 ? savedBuilds('wuwa', character?.charId ?? '') : []), [character?.charId, buildsVersion])

  const ownerOf = useMemo(() => {
    const owners = new Map<string, string>()
    for (const c of characters) for (const id of c.echoIds) if (id) owners.set(id, characterName(c.charId))
    return owners
  }, [characters])
  const setOptions = useMemo(
    () => [...new Set(echoes.map((e) => e.setId))].map((id) => ({ value: id, label: setName(id) })).sort((a, b) => a.label.localeCompare(b.label)),
    [echoes],
  )

  if (!character) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Optimizer' />
        <Panel>
          <EmptyState
            icon={<IconTrendingUp size={24} />}
            title='Import your echoes first'
            action={
              <Group gap='xs'>
                <Button onClick={onImport}>Import data</Button>
                <Button variant='light' onClick={() => useWuwaStore.getState().importParsed(wuwaSampleData(), 'replace')}>Try with sample data</Button>
              </Group>
            }
          >
            Import your WuwaEchoScorer save, then search your echoes for the best loadout under the 12-cost limit.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  const byDamage = targetValue === DAMAGE_TARGET && hasSkillData(character.charId)
  // The Resonator's own kit effects, counted only when ranking by rotation damage
  const kit = resolveWuwaCombat(character.charId, character.sequence, combatSettings)
  // The main echo: the one the rotation picked, or the one worn now. Its main-slot buff counts like the kit's
  const wornEchoes = character.echoIds.flatMap((id) => echoes.find((e) => e.id === id) ?? [])
  const mainEcho = mainEchoBonus(rotation.echo?.id ?? wornEchoes[0]?.defId, character.charId)
  // The team's bonus with the extra buffs, for every target; kit and main-echo buffs join it when ranking by damage
  const teamBonus = withWuwaExtraBuffs(teamResult.bonus, extraBuffs, CHARACTER_INFO[character.charId]?.element ?? undefined)
  const extraEnemy = wuwaExtraEnemy(extraBuffs)
  const combatBonus = { ...teamBonus }
  if (byDamage) {
    for (const [stat, value] of [...Object.entries(kit.bonus), ...Object.entries(mainEcho.stats)] as [keyof typeof combatBonus, number][]) {
      combatBonus[stat] = (combatBonus[stat] ?? 0) + value
    }
  }
  // Full-set Sonata effects: every set's bonus goes to the search (loadouts that complete it get it); the card shows the
  // Full set filter's set and the complete sets in the current and picked loadouts
  const completeSets = (list: Echo[]) => [...setPieceCounts(list)].filter(([id, count]) => count >= (SONATA_SETS[id]?.fullPieces ?? 5)).map(([id]) => id)
  const pickedEchoes = result?.outcome.ok ? result.outcome.builds[selected]?.echoes ?? [] : []
  const shownSets = [...new Set([...(fullSet ? [fullSet] : []), ...completeSets(wornEchoes), ...completeSets(pickedEchoes)])]
  const setEffects = resolveWuwaSetEffects(shownSets, character.sequence, combatSettings)
  const fullSetBonus = byDamage ? setEffects.bonusBySet : undefined
  const damageSetup = {
    charId: character.charId,
    characterLevel: character.level,
    rotation,
    enemy: {
      ...enemy,
      defIgnore: enemy.defIgnore + kit.defIgnore + teamResult.defIgnore + extraEnemy.defIgnore,
      resShred: enemy.resShred + kit.resShred + teamResult.resShred + extraEnemy.resShred,
    },
    element: CHARACTER_INFO[character.charId]?.element ?? undefined,
    // The kit's and the team's DMG Amplified add up per kind
    amplify: Object.fromEntries(
      [...new Set([...Object.keys(kit.amplify), ...Object.keys(teamResult.amplify), ...(extraEnemy.amplify ? ['all'] : [])])].map((kind) => [
        kind,
        (kit.amplify[kind as keyof typeof kit.amplify] ?? 0) + (teamResult.amplify[kind as keyof typeof teamResult.amplify] ?? 0)
        + (kind === 'all' ? extraEnemy.amplify : 0),
      ]),
    ),
    typeBonus: { echo: mainEcho.echoDmg },
    coordinatedDmg: mainEcho.coordinatedDmg,
    lineScale: kit.lineScale,
  }
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

  const filters = { mainStats, fullSet: fullSet ?? undefined, twoPieceSets: twoPieceSets.slice(0, maxTwoPiece), excludeEquippedByOthers, excludeOwners }
  // Echoes per cost after the filters, and the loadouts they make, live as the filters change
  const pool = filterPool({ character, characters, echoes, filters })
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
    if (excludeEquippedByOthers) {
      candidates.push({
        key: 'worn',
        label: 'Leave out echoes others are wearing',
        fixLabel: 'Allow them',
        without: { ...filters, excludeEquippedByOthers: false },
        apply: () => (setExcludeEquippedByOthers(false), clear()),
      })
    }
    if (excludeOwners?.length) {
      candidates.push({
        key: 'priority',
        label: 'Character priority filter',
        fixLabel: 'Turn off',
        without: { ...filters, excludeOwners: undefined },
        apply: () => (setPriorityFilter(false), clear()),
      })
    }
    const poolEmpty = (f: typeof filters) => filterPool({ character, characters, echoes, filters: f }).length === 0
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

  async function run() {
    setRunning(true)
    setProgress(undefined)
    const response = await runEchoOptimizer({
      character,
      characters,
      echoes,
      filters,
      minStats,
      maxStats,
      teamBonus: combatBonus,
      fullSetBonus,
      target,
      limit: resultLimitOf(resultLimit),
    }, setProgress)
    // undefined: cancelled, or replaced by a newer search that is still running
    if (response) {
      setResult({ ...response, target })
      setSelected(0)
      setRunning(false)
    }
  }

  function cancel() {
    cancelEchoOptimizer()
    setRunning(false)
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
    const taken = losing.length > 0
      ? `

${losing.join(', ')} ${
        swapsOnEquip('wuwa')
          ? 'will get echoes of the same cost this Resonator drops, where there are some'
          : 'will lose the echoes this loadout takes (Settings: replace)'
      }.`
      : ''
    if (
      !await confirmAction('Equip loadout', `Equip loadout #${selected + 1} on ${characterName(character.charId)} in this browser's save?${taken}`, {
        confirmLabel: 'Equip',
      })
    ) return
    equip(character.charId, build.echoes)
    Message.success('Equipped')
    // The "Now" row is this loadout from here on
    if (result.outcome.ok) setResult({ ...result, outcome: { ...result.outcome, current: build } })
  }

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
    if (!build) return
    const pieceIds = build.echoes.map((piece) => piece.id)
    openSaveBuildModal({
      defaultName: `Build ${savedList.length + 1}`,
      onSave: (name) => {
        saveBuild('wuwa', character.charId, name, pieceIds, todayString(new Date()))
        bumpBuilds()
        Message.success(`Saved build ${name}`)
      },
    })
  }
  function loadBuilds() {
    const piecesOf = (saved: SavedBuild) => saved.pieceIds.flatMap((id) => echoes.find((piece) => piece.id === id) ?? [])
    const equipPieces = (pieces: Echo[]) => equip(character.charId, pieces)
    openSavedBuildsModal({
      name: characterName(character.charId),
      builds: savedList,
      describe: (saved) => {
        const pieces = piecesOf(saved)
        const missing = saved.pieceIds.length - pieces.length
        return `${describeSets(pieces)}${missing ? ` · ${missing} no longer in the save` : ''}`
      },
      onEquip: async (saved) => {
        const pieces = piecesOf(saved)
        if (pieces.length === 0) return
        if (
          !await confirmAction('Equip saved build', `Equip ${saved.name} on ${characterName(character.charId)} in this browser's save?`, {
            confirmLabel: 'Equip',
          })
        ) return
        equipPieces(pieces)
        Message.success('Equipped')
      },
      onDelete: (saved) => {
        const left = deleteSavedBuild('wuwa', character.charId, saved.name)
        bumpBuilds()
        return left
      },
    })
  }

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Optimizer'
        description='Searches your echoes for the loadouts (up to 5 echoes, 12 cost) that score highest, with stats worked out like the Resonators page. Rotation damage counts skill multipliers, what each hit counts as, and the enemy; set minimums (such as Energy Regen) for anything else the Resonator needs.'
      />

      <div className={classes.optimizerLayout}>
        <Stack gap='md'>
          <FormRows>
            <FormRow id='wuwa-resonator' title='Resonator' summary={`${characterName(character.charId)} · ${targetLabel(target)}`}>
              <CharacterPortrait
                name={characterName(character.charId)}
                portrait={art[character.charId]?.portrait}
                accent={element && `var(--mantine-color-${elementColor(element)}-6)`}
                weapon={weapon && { name: weapon.name }}
              />
              <FormCard title='Resonator'>
                <Select
                  aria-label='Resonator'
                  searchable
                  allowDeselect={false}
                  value={character.charId}
                  onChange={(value) => {
                    if (!value) return
                    setCharacterId(value)
                    rememberCharacter(SETTINGS_KEY, value)
                    setResult(undefined)
                  }}
                  data={characters.map((c) => ({ value: c.charId, label: characterName(c.charId) }))}
                />
                <Text size='xs' c='dimmed'>
                  {`Level ${character.level} · ${weapon ? `${weapon.name}, level ${character.weaponLevel}` : 'No weapon'}`}
                </Text>
                {/* Like HSR's light cone, Eidolon and Superimposition pickers, these change the saved Resonator */}
                <Select
                  label='Weapon'
                  searchable
                  allowDeselect={false}
                  placeholder='No weapon'
                  value={character.weaponId ?? null}
                  onChange={(weaponId) => {
                    if (!weaponId || weaponId === character.weaponId) return
                    saveCharacter({ ...character, weaponId })
                    setResult(undefined)
                  }}
                  data={WEAPON_OPTIONS}
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
              <FormCard title='Optimizer options' size='narrow'>
                <Switch
                  label='Leave out echoes other Resonators are wearing'
                  checked={excludeEquippedByOthers}
                  onChange={(event) => setExcludeEquippedByOthers(event.currentTarget.checked)}
                />
                <Switch
                  label='Character priority filter'
                  description='Leave out echoes worn by Resonators ranked above this one on the Resonators page'
                  disabled={excludeEquippedByOthers}
                  checked={priorityFilter && !excludeEquippedByOthers}
                  onChange={(event) => setPriorityFilter(event.currentTarget.checked)}
                />
              </FormCard>
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
                overrides={teamOverrides}
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
          </FormRows>
          <KitDisclaimer name={characterName(character.charId)} effects={KIT_EFFECTS[character.charId]} byDamage={byDamage} />

          {!outcome && (
            <Panel>
              <EmptyState icon={<IconTrendingUp size={24} />} title={`Find the best echoes for ${characterName(character.charId)}`}>
                {`Pick what to rank by and any filters, then search. The best ${resultLimitOf(resultLimit)} loadouts show up here next to the current one.`}
              </EmptyState>
            </Panel>
          )}

          {!running && pool.length === 0 && echoes.length > 0 && (
            <Panel title='No loadout with these filters' description='No echoes are left, so the search can&apos;t start.'>
              <NoResults causes={noResultCauses()} gearNoun='echoes' />
            </Panel>
          )}

          {outcome && !outcome.ok && <Notices messages={[outcome.reason]} />}

          {outcome?.ok && result && (
            <Panel
              title='Results'
              description={`${(result.ms / 1000).toFixed(1)}s · ${
                formatNumber(outcome.visited)
              } partial and full loadouts checked · ${outcome.poolSize} echoes, ${outcome.prunedSize} after dropping ones that can't make the top ${
                resultLimitOf(resultLimit)
              }`}
            >
              <Stack gap='sm'>
                {outcome.truncated && (
                  <Text size='xs' c='yellow'>
                    The search stopped at its limit, so these are the best loadouts it found, not necessarily the best there are. A full set or main stat
                    filters make the search finish.
                  </Text>
                )}
                {outcome.builds.length === 0
                  ? <NoResults title='Nothing matched' causes={noResultCauses()} gearNoun='echoes' />
                  : (
                    <ResultsGrid
                      key={outcome.builds.length + result.target.kind}
                      columns={[
                        {
                          key: 'score',
                          label: targetLabel(result.target),
                          format: (value: number) => formatScore(result.target, value),
                          primary: true,
                          width: 110,
                        },
                        ...SHOWN_STATS.map((stat) => ({ key: stat, label: wuwaStatLabel(stat), format: (value: number) => formatValue(stat, value) })),
                        { key: 'cost', label: 'Cost', format: (value: number) => String(value), width: 60 },
                      ]}
                      rows={outcome.builds.map((b, i) => ({ id: String(i), rank: String(i + 1), values: resultValues(b), sets: describeSets(b.echoes) }))}
                      current={current ? { id: 'now', rank: 'Now', values: resultValues(current), sets: describeSets(current.echoes) } : undefined}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  )}
              </Stack>
            </Panel>
          )}

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
          <BuildCompare pinned={pins.pinned} onUnpin={pins.unpin} />
          <RememberDamageScore game='wuwa' characterId={character.charId} pieceIds={wornEchoes.map((e) => e.id)} score={currentDpsScore} />
        </Stack>

        <OptimizerSidebar
          pools={COSTS.map((cost) => ({ label: `${cost}-cost`, value: pool.filter((e) => e.cost === cost).length }))}
          combinations={countLoadouts(pool)}
          combinationsLabel='Loadouts'
          hint={pool.length === 0 ? { text: 'No echoes left with these filters', warn: true } : undefined}
          canStart={pool.length > 0}
          running={running}
          progress={progress}
          onStart={run}
          onCancel={cancel}
          results={outcome?.ok && result
            ? {
              count: outcome.builds.length,
              seconds: result.ms / 1000,
              note: outcome.truncated ? 'Stopped at its limit: best found, maybe not the best.' : undefined,
            }
            : undefined}
          equip={build ? { label: `loadout #${selected + 1}`, onEquip: equipBuild, equipped: isWorn } : undefined}
          statView={{ value: statView, onChange: setStatView }}
          onReset={() => {
            updateSettings(defaultSettings(character.charId))
            setResult(undefined)
          }}
          pins={{
            onPin: build && result ? () => pins.pin(`#${selected + 1} · ${formatScore(result.target, build.score)}`, pinnedCells(analysisRows)) : undefined,
            count: pins.pinned.length,
            onClear: pins.clear,
          }}
          builds={{ onSave: build ? saveBuildNow : undefined, onLoad: loadBuilds, count: savedList.length }}
        />
      </div>
    </Stack>
  )
}
