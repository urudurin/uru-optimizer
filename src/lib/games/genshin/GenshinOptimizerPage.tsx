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
  type CombatSetup,
  resolveCombat,
  setCountsOf,
} from 'lib/games/genshin/damage/combatEffects'
import { KIT_EFFECTS } from 'lib/games/genshin/damage/combatEffects'
import {
  type DamageSetup,
  DEFAULT_ENEMY,
  defaultRotation,
  type EnemySettings,
  hasTalentData,
  hexereiCount,
  migrateRotationCounts,
  type Rotation,
  rotationDamage,
  rotationLines,
  rotationTalents,
  singleLineRotation,
  stellarContribution,
  teamReactions,
} from 'lib/games/genshin/damage/damage'
import {
  EffectsCard,
  EnemyCard,
  RotationCard,
} from 'lib/games/genshin/damage/DamageCards'
import { useGenshinImages } from 'lib/games/genshin/data/images'
import { genshinSampleData } from 'lib/games/genshin/data/sampleData'
import {
  GenshinTeamCards,
  teamSummary,
} from 'lib/games/genshin/GenshinTeamCards'
import { nameFromGoodKey } from 'lib/games/genshin/goodKeys'
import { loadEnkaGenshinStore } from 'lib/games/genshin/importer/enkaClient'
import type { EnkaGenshinStore } from 'lib/games/genshin/importer/enkaParser'
import { mainStatValue } from 'lib/games/genshin/importer/goodParser'
import {
  genshinDamageScore,
  genshinSubstatUpgrades,
} from 'lib/games/genshin/optimizer/analysis'
import {
  filterPools,
  type MainStatSlot,
  type OptimizerOutcome,
  type OptimizerTarget,
  targetLabel,
} from 'lib/games/genshin/optimizer/artifactOptimizer'
import { artifactSearch } from 'lib/games/genshin/optimizer/optimizerClient'
import {
  GENSHIN_SETTINGS_KEY as SETTINGS_KEY,
  GENSHIN_TARGETS as TARGETS,
  genshinTarget,
} from 'lib/games/genshin/optimizer/targets'
import { genshinPiecesTaken } from 'lib/games/genshin/state/genshinState'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import { genshinRoster } from 'lib/games/genshin/state/roster'
import {
  genshinArtifactWeights,
  genshinBuildScore,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import {
  computeGenshinStats,
  hasStatData,
} from 'lib/games/genshin/stats/computeStats'
import {
  type BuffSetting,
  SET_4PC_BUFFS,
} from 'lib/games/genshin/team/buffs'
import {
  GENSHIN_EXTRA_BUFFS,
  withGenshinExtraBuffs,
  withGenshinExtraDebuffs,
} from 'lib/games/genshin/team/extraBuffs'
import { teamBuffsFor } from 'lib/games/genshin/team/teamBuffs'
import {
  type Artifact,
  ARTIFACT_SLOTS,
  ELEMENT_DMG_STAT,
  formatStatValue,
  type GenshinCharacter,
  type GenshinStatKey,
  PERCENT_STATS,
  SLOT_LABELS,
  statLabel,
} from 'lib/games/genshin/types'
import {
  ArtifactCard,
  elementColor,
} from 'lib/games/genshin/ui/ArtifactCard'
import {
  WEAPON_RARITY,
  weaponOptions,
} from 'lib/games/genshin/ui/CharacterForm'
import {
  ELEMENT_ACCENTS,
  genshinStatRows,
} from 'lib/games/genshin/ui/characterStats'
import {
  GenshinCharacterSelect,
  GenshinWeaponSelect,
} from 'lib/games/genshin/ui/pickers'
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
  optionCandidates,
  type PoolCandidate,
  poolCauses,
  statLimitCauses,
} from 'lib/games/shared/noResults'
import {
  fieldSetter,
  migrateOptimizerSettings,
  useActiveCharacter,
  useCharacterSettings,
} from 'lib/games/shared/optimizerSettings'
import {
  deleteSavedBuild,
  saveBuild,
  type SavedBuild,
  savedBuilds,
} from 'lib/games/shared/savedBuilds'
import {
  fourPieceSetsOf,
  keepOverridesFor,
  type TeammateOverrides,
} from 'lib/games/shared/teammateOverrides'
import {
  BuildAnalysis,
  pinnedCells,
  PreviewWithAnalysis,
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
import {
  NoBuildPanel,
  NoResults,
} from 'lib/games/shared/ui/optimizer/NoResults'
import { OptimizerOptionsCard } from 'lib/games/shared/ui/optimizer/OptimizerOptionsCard'
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
import { TeammateOverrideCard } from 'lib/games/shared/ui/optimizer/TeammateOverrideCard'
import { useOptimizerRun } from 'lib/games/shared/ui/optimizer/useOptimizerRun'
import {
  FormCard,
  FormRow,
  FormRows,
} from 'lib/games/shared/ui/OptimizerForm'
import type { StatView } from 'lib/games/shared/ui/OptimizerSidebar'
import { OptimizerSidebar } from 'lib/games/shared/ui/OptimizerSidebar'
import { Message } from 'lib/interactions/message'
import {
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react'

const MAIN_STAT_OPTIONS: Record<MainStatSlot, GenshinStatKey[]> = {
  sands: ['atkPct', 'hpPct', 'defPct', 'elementalMastery', 'energyRecharge'],
  goblet: ['atkPct', 'hpPct', 'defPct', 'elementalMastery', 'pyroDmg', 'hydroDmg', 'anemoDmg', 'electroDmg', 'dendroDmg', 'cryoDmg', 'geoDmg', 'physicalDmg'],
  circlet: ['critRate', 'critDmg', 'atkPct', 'hpPct', 'defPct', 'elementalMastery', 'healingBonus'],
}
const MAIN_STAT_SLOTS = Object.keys(MAIN_STAT_OPTIONS) as MainStatSlot[]

const MIN_STATS: GenshinStatKey[] = ['energyRecharge', 'critRate', 'critDmg', 'elementalMastery', 'atk', 'hp', 'def']
const SHOWN_STATS: GenshinStatKey[] = ['hp', 'atk', 'def', 'elementalMastery', 'critRate', 'critDmg', 'energyRecharge']

function formatScore(target: OptimizerTarget, score: number): string {
  if (target.kind === 'stat') return formatStatValue(target.stat, score)
  return target.kind === 'critValue' ? score.toFixed(1) : formatNumber(Math.round(score))
}

// A stat rounded the way formatStatValue shows it
function roundStat(stat: GenshinStatKey, value: number): number {
  return PERCENT_STATS.has(stat) ? Math.round(value * 10) / 10 : Math.round(value)
}

function describeSets(artifacts: Artifact[]): string {
  const counts = new Map<string, { name: string, count: number }>()
  for (const a of artifacts) counts.set(a.setId, { name: a.setName, count: (counts.get(a.setId)?.count ?? 0) + 1 })
  const sets = [...counts.values()].filter((s) => s.count >= 2).sort((a, b) => b.count - a.count)
  return sets.length > 0 ? sets.map((s) => `${s.count >= 4 ? 4 : 2}pc ${s.name}`).join(' + ') : 'No set bonus'
}

function statsToShow(character: GenshinCharacter): GenshinStatKey[] {
  return [...SHOWN_STATS, ...(character.element ? [ELEMENT_DMG_STAT[character.element]] : [])]
}

type GenshinOptimizerSettings = {
  targetValue: string,
  mainStats: Partial<Record<MainStatSlot, GenshinStatKey[]>>,
  fourPieceSet: string | null,
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
  minStats: Partial<Record<GenshinStatKey, number>>,
  maxStats: Partial<Record<GenshinStatKey, number>>,
  // The team (team/teamBuffs.ts): teammate ids, whether this character is on the field, buff toggles
  teammates: string[],
  onField: boolean,
  // Rank, weapon and 4-piece changes per teammate, for the team buffs only (shared/teammateOverrides.ts)
  teammateOverrides: TeammateOverrides,
  // Buffs typed in by hand, added to every build (shared/extraBuffs.ts)
  extraBuffs: ExtraBuffs,
  teamSettings: Record<string, BuffSetting>,
  // The rotation damage target (damage/damage.ts): the enemy and the rotation
  enemy: EnemySettings,
  rotation: Rotation,
  // Toggles of the character's own combat effects (damage/combatEffects.ts)
  combatSettings: Record<string, BuffSetting>,
}

// Rank by values: 'damage' plus the stat targets in optimizer/targets.ts
const DAMAGE_TARGET = 'damage'

// What a character starts with before their settings are changed (and saved)
function defaultSettings(characterId: string): GenshinOptimizerSettings {
  return {
    targetValue: hasTalentData(characterId) ? DAMAGE_TARGET : 'avg:atk',
    mainStats: {},
    fourPieceSet: null,
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
    teammates: [],
    onField: true,
    teamSettings: {},
    teammateOverrides: {},
    extraBuffs: {},
    enemy: DEFAULT_ENEMY,
    rotation: defaultRotation(characterId),
    combatSettings: {},
  }
}

// One-time changes to saves from older versions: characters still on the old default move to Rotation damage, and saved
// rotations switch from position keys to name keys
function migrateSaves() {
  migrateOptimizerSettings(
    SETTINGS_KEY,
    'rank-by-rotation-damage',
    (id, saved) => (saved.targetValue === 'avg:atk' && hasTalentData(id) ? { ...saved, targetValue: DAMAGE_TARGET } : saved),
  )
  migrateOptimizerSettings(SETTINGS_KEY, 'rotation-name-keys', (characterId: string, saved: Record<string, unknown>) => {
    const rotation = saved.rotation
    if (typeof rotation !== 'object' || rotation === null || !('counts' in rotation)) return saved
    const counts = (rotation as { counts: Record<string, number> }).counts
    return { ...saved, rotation: { ...rotation, counts: migrateRotationCounts(characterId, counts) } }
  })
}

// Each rotation line's share of a build's damage, for the build analysis
function genshinBreakdown(setup: DamageSetup, stats: Partial<Record<GenshinStatKey, number>>): DamagePart[] {
  return splitDamage(
    rotationLines(setup.characterId, setup.element, setup.rotation, setup.teamReactions),
    (line) => rotationDamage(stats, { ...setup, rotation: singleLineRotation(setup.rotation, line) }),
  )
}

export function GenshinOptimizerPage({ onImport }: { onImport: () => void }) {
  useState(migrateSaves)
  const artifacts = useGenshinStore((s) => s.artifacts)
  const savedCharacters = useGenshinStore((s) => s.characters)
  const images = useGenshinImages()
  // Every character, saved or not (state/roster.ts)
  const characters = useMemo(() => genshinRoster(savedCharacters, images), [savedCharacters, images])
  const saveCharacter = useGenshinStore((s) => s.saveCharacter)
  const usable = useMemo(() => characters.filter(hasStatData), [characters])
  // The open character, in the settings store (shared/optimizerSettings.ts)
  const [characterId, setCharacterId] = useActiveCharacter(SETTINGS_KEY)
  const character = usable.find((c) => c.id === characterId) ?? usable[0]

  // Saved per character, see shared/optimizerSettings.ts
  const [settings, updateSettings] = useCharacterSettings(SETTINGS_KEY, character?.id ?? '', () => defaultSettings(character?.id ?? ''))
  const {
    targetValue,
    mainStats,
    fourPieceSet,
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
    onField,
    teamSettings,
    teammateOverrides,
    extraBuffs,
    enemy,
    rotation,
    combatSettings,
  } = settings
  const setTargetValue = fieldSetter(updateSettings, 'targetValue')
  const setMainStats = fieldSetter(updateSettings, 'mainStats')
  const setFourPieceSet = fieldSetter(updateSettings, 'fourPieceSet')
  const setTwoPieceSets = fieldSetter(updateSettings, 'twoPieceSets')
  const setExcludeEquippedByOthers = fieldSetter(updateSettings, 'excludeEquippedByOthers')
  const setPriorityFilter = fieldSetter(updateSettings, 'priorityFilter')
  const setKeepCurrent = fieldSetter(updateSettings, 'keepCurrent')
  const setMinLevel = fieldSetter(updateSettings, 'minLevel')
  const setMinRarity = fieldSetter(updateSettings, 'minRarity')
  const setBoostMain = fieldSetter(updateSettings, 'boostMain')
  // Gear worn by characters ranked above is left out when the priority filter is on (and worn gear is otherwise allowed)
  const rankOrder = usePriority('genshin')
  const excludeOwners = useMemo(
    () => (priorityFilter && !excludeEquippedByOthers ? ranksAbove(characters.map((c) => c.id), rankOrder, character?.id ?? '') : undefined),
    [priorityFilter, excludeEquippedByOthers, rankOrder, characters, character?.id],
  )
  const setResultLimit = fieldSetter(updateSettings, 'resultLimit')
  const setMinStats = fieldSetter(updateSettings, 'minStats')
  const setMaxStats = fieldSetter(updateSettings, 'maxStats')
  const setTeammates = fieldSetter(updateSettings, 'teammates')
  const setOnField = fieldSetter(updateSettings, 'onField')
  const setTeamSettings = fieldSetter(updateSettings, 'teamSettings')
  const setTeammateOverrides = fieldSetter(updateSettings, 'teammateOverrides')
  const setExtraBuffs = fieldSetter(updateSettings, 'extraBuffs')
  const setEnemy = fieldSetter(updateSettings, 'enemy')
  const setRotation = fieldSetter(updateSettings, 'rotation')
  const setCombatSettings = fieldSetter(updateSettings, 'combatSettings')
  // The search (shared/ui/optimizer/useOptimizerRun.ts), its result kept with the target it was ranked by
  const search = useOptimizerRun<{ outcome: OptimizerOutcome, ms: number, target: OptimizerTarget }, typeof artifactSearch>(artifactSearch)
  const { running, progress, result, setResult, selected, setSelected } = search
  const pins = usePinnedBuilds(character?.id ?? '')
  // Results columns: in-combat stats (team, kit and set buffs) or the stat screen, after HSR's stat view
  const [statView, setStatView] = useState<StatView>('combat')
  // Saved builds of this character; bumped after a save or delete to read them again
  const [buildsVersion, bumpBuilds] = useReducer((n: number) => n + 1, 0)
  const savedList = useMemo(() => (buildsVersion >= 0 ? savedBuilds('genshin', character?.id ?? '') : []), [character?.id, buildsVersion])

  const ownerNames = useMemo(() => new Map(characters.map((c) => [c.id, c.name])), [characters])
  const equip = useGenshinStore((s) => s.equip)
  const filters = useMemo(
    () => ({
      mainStats,
      fourPieceSet: fourPieceSet ?? undefined,
      twoPieceSets,
      excludeEquippedByOthers,
      excludeOwners,
      keep: keepCurrent ? character?.artifactIds : undefined,
      minLevel,
      minRarity,
    }),
    [mainStats, fourPieceSet, twoPieceSets, excludeEquippedByOthers, excludeOwners, keepCurrent, character?.artifactIds, minLevel, minRarity],
  )
  // Boost main stat: low-level artifacts searched with their max-level main stat (values from Enka's relic levels)
  const [enkaStore, setEnkaStore] = useState<EnkaGenshinStore | undefined>()
  useEffect(() => {
    if (!boostMain || enkaStore) return
    let live = true
    void loadEnkaGenshinStore().then((loaded) => {
      if (live && loaded.ok) setEnkaStore(loaded.data)
    })
    return () => {
      live = false
    }
  }, [boostMain, enkaStore])
  const searchArtifacts = useMemo(
    () => (boostMain && enkaStore ? artifacts.map((artifact) => boostArtifact(artifact, enkaStore)) : artifacts),
    [boostMain, enkaStore, artifacts],
  )
  // Artifacts per slot after the filters, live as the filters change
  const poolSizes = useMemo(
    () => (character ? filterPools({ character, artifacts: searchArtifacts, filters }).map((pool) => pool.length) : []),
    [character, searchArtifacts, filters],
  )
  // What to loosen when nothing matches (shared/noResults.ts): pool filters, checked for emptying a slot, then stat limits
  const noResultCauses = (): FilterCause[] => {
    if (!character) return []
    const clear = () => setResult(undefined)
    const candidates: PoolCandidate<typeof filters>[] = []
    for (const slot of MAIN_STAT_SLOTS) {
      const allowed = mainStats[slot] ?? []
      if (allowed.length === 0) continue
      candidates.push({
        key: `main:${slot}`,
        label: `${slot[0].toUpperCase()}${slot.slice(1)} main stat: ${allowed.map(statLabel).join(', ')}`,
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
      gearNoun: 'artifacts',
      clear,
      setExcludeWorn: setExcludeEquippedByOthers,
      setPriority: setPriorityFilter,
      setKeep: setKeepCurrent,
      setMinLevel,
      rarity: { label: `Minimum rarity ${minRarity}★`, reset: () => setMinRarity(0) },
    }))
    const poolEmpty = (f: typeof filters) => filterPools({ character, artifacts: searchArtifacts, filters: f }).some((pool) => pool.length === 0)
    return [
      ...poolCauses(candidates, poolEmpty, poolSizes.some((size) => size === 0)),
      ...statLimitCauses(
        MIN_STATS.map((stat) => ({ key: stat, label: statLabel(stat) })),
        minStats,
        maxStats,
        (next) => (setMinStats(next), clear()),
        (next) => (setMaxStats(next), clear()),
      ),
    ]
  }
  const setOptions = useMemo(() => {
    const names = new Map(artifacts.map((a) => [a.setId, a.setName]))
    return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [artifacts])

  // Every character is always there (state/roster.ts), so the page waits for artifacts instead
  if (!character || artifacts.length === 0) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Optimizer' />
        <Panel>
          <EmptyState
            icon={<IconTrendingUp size={24} />}
            title='Import your artifacts first'
            action={
              <Group gap='xs'>
                <Button onClick={onImport}>Import data</Button>
                <Button variant='light' onClick={() => useGenshinStore.getState().importParsed(genshinSampleData(), 'replace')}>Try with sample data</Button>
              </Group>
            }
          >
            A GOOD file from an artifact scanner brings in your whole inventory, which the optimizer searches for the best 5-piece builds.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  // What the team gives this character, the same for every build
  const team = { teammates, onField, settings: teamSettings, overrides: keepOverridesFor(teammateOverrides, teammates) }
  const teamResult = teamBuffsFor(character, team, { characters, artifacts })
  const teamBuffs = withGenshinExtraBuffs({ premod: teamResult.premod, total: teamResult.total }, extraBuffs)
  const talents = rotationTalents(character, rotation)
  // The Lunar and Stellar kinds this team can trigger; the page only offers those
  const reactionsInTeam = teamReactions([character.id, ...teammates])
  // The character's own combat effects: their kit, and the 4-piece filter's set (every build has it)
  const combat: CombatSetup = {
    sets: fourPieceSet ? [fourPieceSet] : [],
    settings: combatSettings,
    hexerei: hexereiCount([character.id, ...teammates]),
  }
  const resolvedCombat = resolveCombat(character, combat, setCountsOf(fourPieceSet ? Array(4).fill(fourPieceSet) : []))
  const kitDebuffs = {
    defShred: teamResult.debuffs.defShred + resolvedCombat.debuffs.defShred,
    resShred: { ...teamResult.debuffs.resShred },
  }
  for (const [element, value] of Object.entries(resolvedCombat.debuffs.resShred) as [keyof typeof kitDebuffs.resShred, number][]) {
    kitDebuffs.resShred[element] = (kitDebuffs.resShred[element] ?? 0) + value
  }
  const debuffs = withGenshinExtraDebuffs(kitDebuffs, extraBuffs)
  const damageSetup = {
    characterId: character.id,
    characterLevel: character.level,
    element: character.element,
    rotation,
    talents,
    enemy,
    debuffs,
    // Lunar Reaction DMG from the team (Moonsign: Ascendant Gleam) adds to every Lunar kind
    reactionBonus: {
      ...resolvedCombat.reactions,
      // Bloom DMG from teammates (Nilou's Bountiful Cores)
      ...(teamResult.bloomBonus ? { bloom: (resolvedCombat.reactions.bloom ?? 0) + teamResult.bloomBonus } : {}),
      ...(teamResult.vaporizeBonus ? { vaporize: (resolvedCombat.reactions.vaporize ?? 0) + teamResult.vaporizeBonus } : {}),
      ...Object.fromEntries((['lunarcharged', 'lunarbloom', 'lunarcrystallize'] as const).map((kind) => [
        kind,
        (resolvedCombat.reactions[kind] ?? 0) + teamResult.lunarBonus,
      ])),
      // One kind's DMG Bonus from teammates (Baizhu, Mona, Ifa...)
      ...Object.fromEntries(
        Object.entries(teamResult.specialBonus).map(([kind, value]) => [
          kind,
          (resolvedCombat.reactions[kind as keyof typeof resolvedCombat.reactions] ?? 0)
          + (kind.startsWith('lunar') ? teamResult.lunarBonus : 0) + value,
        ]),
      ),
    },
    hitBuffs: resolvedCombat.hitBuffs,
    teamReactions: reactionsInTeam,
    baseBonus: teamResult.baseBonus,
    elevation: resolvedCombat.elevation,
    hitFlats: teamResult.hitFlats,
    reactionBonusPerEm: resolvedCombat.reactionsPerEm,
    specialFlat: teamResult.specialFlat,
    specialFlatHits: teamResult.specialFlatHits,
    specialCrit: teamResult.specialCrit,
    // Teammates who can trigger Stellar Swirl, ranked against for its contribution
    stellarContributors: teamResult.members
      .filter((member) => member.element === 'Anemo' || member.element === 'Cryo')
      .map((member) => stellarContribution(member.level, member.stats)),
  }
  const byDamage = targetValue === DAMAGE_TARGET && hasTalentData(character.id)
  const target: OptimizerTarget = byDamage ? { kind: 'damage', setup: damageSetup } : genshinTarget(targetValue, character.element)
  // The current artifacts' rotation damage, for the Rotation card
  const worn = ARTIFACT_SLOTS.flatMap((slot) => artifacts.find((a) => a.id === character.artifactIds[slot]) ?? [])
  const currentDamage = hasTalentData(character.id)
    ? rotationDamage(computeGenshinStats(character, worn, {}, teamBuffs, combat).stats, damageSetup)
    : undefined
  // The current artifacts' DPS score when ranking by damage (shared/damageScore.ts), kept for the Characters page
  const currentDpsScore = byDamage ? genshinDamageScore(character, worn, target, teamBuffs, combat) : undefined

  function run() {
    void search.start({
      character,
      artifacts: searchArtifacts,
      filters,
      minStats,
      maxStats,
      target,
      limit: resultLimitOf(resultLimit),
      teamBuffs,
      // Combat effects only count for rotation damage; the stat targets stay on the stat screen
      combat: byDamage ? combat : undefined,
    }, (response) => ({ ...response, target }))
  }

  function cancel() {
    search.cancel()
  }

  const outcome = result?.outcome
  const build = outcome?.ok ? outcome.builds[selected] : undefined
  const current = outcome?.ok ? outcome.current : undefined
  const pickedDpsScore = build && result ? genshinDamageScore(character, build.artifacts, result.target, teamBuffs, combat) : undefined
  const shown = statsToShow(character)
  const resultValues = (score: number, stats: Partial<Record<GenshinStatKey, number>>) => ({
    score,
    ...Object.fromEntries(shown.map((stat) => [stat, stats[stat] ?? 0])),
  })
  const setName = (id: string) => setOptions.find((o) => o.value === id)?.label ?? nameFromGoodKey(id)
  const mainFilters = MAIN_STAT_SLOTS.filter((slot) => mainStats[slot]?.length).length
  const filterSummary = [
    fourPieceSet ? `4pc ${setName(fourPieceSet)}` : twoPieceSets.length ? twoPieceSets.map((id) => `2pc ${setName(id)}`).join(' + ') : 'Any sets',
    mainFilters ? `${mainFilters} main stat filter${mainFilters === 1 ? '' : 's'}` : 'any main stats',
    limitsSummary(minStats, maxStats),
  ].join(' · ')
  const isWorn = build?.artifacts.every((a) => character.artifactIds[a.slot] === a.id) ?? false

  async function equipBuild() {
    if (!build || !result) return
    const losing = genshinPiecesTaken({ artifacts, characters }, character.id, build.artifacts).map((id) => ownerNames.get(id) ?? id)
    const swap = losing.length > 0
      ? `

${losing.join(', ')} ${swapsOnEquip('genshin') ? `will get ${character.name}'s current pieces in exchange` : 'will lose them (Settings: replace)'}.`
      : ''
    if (!await confirmAction('Equip build', `Equip build #${selected + 1} on ${character.name} in this browser's save?${swap}`, { confirmLabel: 'Equip' })) {
      return
    }
    equip(character, build.artifacts)
    Message.success('Equipped')
    // The "Now" row is this build from here on
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
      ...shown.map((stat) => ({
        key: stat,
        label: statLabel(stat),
        // Rounded like the screen first, so the change matches the numbers shown
        build: roundStat(stat, build.stats[stat] ?? 0),
        current: current ? roundStat(stat, current.stats[stat] ?? 0) : undefined,
        format: (value: number) => formatStatValue(stat, value),
      })),
    ]
    : []

  // Saved builds (the sidebar's Builds group, after HSR's), by piece id
  function saveBuildNow() {
    if (!build) return
    const pieceIds = build.artifacts.map((piece) => piece.id)
    openSaveBuildModal({
      defaultName: `Build ${savedList.length + 1}`,
      onSave: (name) => {
        saveBuild('genshin', character.id, name, pieceIds, todayString(new Date()))
        bumpBuilds()
        Message.success(`Saved build ${name}`)
      },
    })
  }
  function loadBuilds() {
    const piecesOf = (saved: SavedBuild) => saved.pieceIds.flatMap((id) => artifacts.find((piece) => piece.id === id) ?? [])
    const equipPieces = (pieces: Artifact[]) => equip(character, pieces)
    openSavedBuildsModal({
      name: character.name,
      builds: savedList,
      describe: (saved) => {
        const pieces = piecesOf(saved)
        const missing = saved.pieceIds.length - pieces.length
        return `${describeSets(pieces)}${missing ? ` · ${missing} no longer in the save` : ''}`
      },
      onEquip: async (saved) => {
        const pieces = piecesOf(saved)
        if (pieces.length === 0) return
        if (!await confirmAction('Equip saved build', `Equip ${saved.name} on ${character.name} in this browser's save?`, { confirmLabel: 'Equip' })) return
        equipPieces(pieces)
        Message.success('Equipped')
      },
      onDelete: (saved) => {
        const left = deleteSavedBuild('genshin', character.id, saved.name)
        bumpBuilds()
        return left
      },
    })
  }

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Optimizer'
        description='Searches your artifacts for the 5-piece builds that score highest, with stats worked out like the Characters page. Rotation damage counts talent multipliers, the enemy, team shred and Vaporize, Melt, Aggravate or Spread; set minimums (such as Energy Recharge) for anything else the character needs.'
      />

      <div className={classes.optimizerLayout}>
        <Stack gap='md'>
          <FormRows>
            <FormRow id='genshin-character' title='Character' summary={`${character.name} · ${targetLabel(target)}`}>
              <CharacterPortrait
                name={character.name}
                portrait={images.characters[character.id]?.portrait}
                accent={character.element ? ELEMENT_ACCENTS[character.element] : undefined}
                weapon={character.weapon && { image: images.weapons[character.weapon.id], name: character.weapon.name }}
              />
              <FormCard title='Character'>
                <GenshinCharacterSelect
                  characters={usable}
                  images={images}
                  value={character.id}
                  onChange={(value) => {
                    setCharacterId(value)
                    setResult(undefined)
                  }}
                />
                <Text size='xs' c='dimmed'>
                  {`Level ${character.level} · ${character.weapon ? `${character.weapon.name}, level ${character.weapon.level}` : 'No weapon'}`}
                </Text>
                {/* Like HSR's light cone, Eidolon and Superimposition pickers, these change the saved character */}
                <GenshinWeaponSelect
                  images={images}
                  weaponType={images.characterInfo[character.id.startsWith('Traveler') ? 'Traveler' : character.id]?.weaponType}
                  value={character.weapon?.id ?? null}
                  onChange={(id) => {
                    if (id === (character.weapon?.id ?? null)) return
                    const weapon = id
                      ? {
                        id,
                        name: images.weaponInfo[id]?.name ?? nameFromGoodKey(id),
                        rarity: WEAPON_RARITY[id] ?? 5,
                        level: character.weapon?.level ?? 90,
                        refinement: character.weapon?.refinement ?? 1,
                      }
                      : undefined
                    saveCharacter({ ...character, weapon })
                    setResult(undefined)
                  }}
                />
                <RankButtons
                  label='Constellation'
                  prefix='C'
                  from={0}
                  to={6}
                  value={character.constellation}
                  onChange={(constellation) => {
                    saveCharacter({ ...character, constellation })
                    setResult(undefined)
                  }}
                />
                {character.weapon && (
                  <RankButtons
                    label='Refinement'
                    prefix='R'
                    from={1}
                    to={5}
                    value={character.weapon.refinement}
                    onChange={(refinement) => {
                      if (character.weapon) saveCharacter({ ...character, weapon: { ...character.weapon, refinement } })
                      setResult(undefined)
                    }}
                  />
                )}
              </FormCard>
              <FormCard
                title='Rank by'
                description='Rotation damage uses the Damage row. The average hit is the scaling stat times the crit multiplier and DMG Bonus.'
              >
                <Select
                  aria-label='Rank by'
                  allowDeselect={false}
                  value={byDamage ? DAMAGE_TARGET : targetValue === DAMAGE_TARGET ? TARGETS[0].value : targetValue}
                  onChange={(value) => value && setTargetValue(value)}
                  data={[
                    ...(hasTalentData(character.id) ? [{ value: DAMAGE_TARGET, label: 'Rotation damage' }] : []),
                    ...TARGETS.map((t) => ({ value: t.value, label: targetLabel(t.target) })),
                  ]}
                />
                <ResultLimitSelect value={resultLimit} onChange={setResultLimit} />
              </FormCard>
              <OptimizerOptionsCard
                gearNoun='artifacts'
                ownerNoun='characters'
                rosterPage='Characters'
                excludeWorn={excludeEquippedByOthers}
                onExcludeWorn={setExcludeEquippedByOthers}
                priority={priorityFilter}
                onPriority={setPriorityFilter}
                keep={{ checked: keepCurrent, description: `Each slot only uses the artifact ${character.name} wears now`, onChange: setKeepCurrent }}
                levels={[0, 4, 8, 12, 16, 20]}
                minLevel={minLevel}
                onMinLevel={setMinLevel}
                rarity={{
                  label: 'Minimum rarity',
                  value: String(minRarity),
                  options: [{ value: '0', label: 'Any' }, { value: '4', label: '4★' }, { value: '5', label: '5★' }],
                  onChange: (value) => setMinRarity(Number(value)),
                }}
                boost={boostMain}
                boostDescription='Artifacts below max level count with their max-level main stat'
                onBoost={setBoostMain}
              />
            </FormRow>

            <FormRow id='genshin-filters' title='Artifact & stat filters' summary={filterSummary}>
              <FormCard
                title='Sets'
                description='Only 2-piece bonuses the character screen shows are counted, not 4-piece effects, so pick the set you want to run here.'
              >
                <SetPicker
                  label='4-piece set'
                  max={1}
                  options={setOptions.map((o) => ({ ...o, icon: images.artifacts[o.value]?.flower }))}
                  value={fourPieceSet ? [fourPieceSet] : []}
                  onChange={(ids) => {
                    setFourPieceSet(ids[0] ?? null)
                    if (ids[0]) setTwoPieceSets([])
                  }}
                />
                <SetPicker
                  label='2-piece sets'
                  max={2}
                  placeholder={fourPieceSet ? 'Not with a 4-piece set' : 'Any'}
                  disabled={!!fourPieceSet}
                  options={setOptions.map((o) => ({ ...o, icon: images.artifacts[o.value]?.flower }))}
                  value={twoPieceSets}
                  onChange={setTwoPieceSets}
                />
              </FormCard>
              <FormCard title='Main stats'>
                {MAIN_STAT_SLOTS.map((slot) => (
                  <MultiSelect
                    key={slot}
                    label={SLOT_LABELS[slot]}
                    placeholder={mainStats[slot]?.length ? undefined : 'Any'}
                    value={mainStats[slot] ?? []}
                    onChange={(value) => setMainStats((prev) => ({ ...prev, [slot]: value as GenshinStatKey[] }))}
                    data={MAIN_STAT_OPTIONS[slot].map((stat) => ({ value: stat, label: statLabel(stat) }))}
                  />
                ))}
              </FormCard>
              <FormCard title='Stat filters' description='Builds outside any of these are left out, e.g. Energy Recharge 200 to 250.'>
                <StatFilters
                  rows={MIN_STATS.map((stat) => ({ key: stat, label: statLabel(stat) }))}
                  min={minStats}
                  max={maxStats}
                  onMin={(next) => setMinStats(next)}
                  onMax={(next) => setMaxStats(next)}
                />
              </FormCard>
            </FormRow>

            <FormRow id='genshin-team' title='Teammates' summary={teamSummary(team, teamResult, characters)}>
              <GenshinTeamCards
                character={character}
                characters={characters}
                team={team}
                result={teamResult}
                onTeammates={(ids) => {
                  setTeammates(ids)
                  setResult(undefined)
                }}
                onField={(value) => {
                  setOnField(value)
                  setResult(undefined)
                }}
                onSetting={(key, value) => {
                  setTeamSettings((current) => ({ ...current, [key]: value }))
                  setResult(undefined)
                }}
              />
              <TeammateOverrideCard
                rankPrefix='C'
                weaponLabel='weapon'
                refinementPrefix='R'
                overrides={team.overrides}
                onChange={(next) => {
                  setTeammateOverrides(next)
                  setResult(undefined)
                }}
                members={teammates.flatMap((id) => {
                  const mate = characters.find((c) => c.id === id)
                  if (!mate || id === character.id) return []
                  const wornSets = Object.values(mate.artifactIds).flatMap((artifactId) => artifacts.find((a) => a.id === artifactId)?.setId ?? [])
                  const fourPiece = fourPieceSetsOf(wornSets)[0]
                  return [{
                    id,
                    name: mate.name,
                    roster: { rank: mate.constellation, weaponId: mate.weapon?.id, refinement: mate.weapon?.refinement ?? 1, fourPiece },
                    weapons: weaponOptions(images.weaponInfo, images.characterInfo[id.startsWith('Traveler') ? 'Traveler' : id]?.weaponType),
                    sets: [...new Set([...(fourPiece ? [fourPiece] : []), ...Object.keys(SET_4PC_BUFFS)])].map((setId) => ({
                      value: setId,
                      label: setName(setId),
                    })),
                  }]
                })}
              />
            </FormRow>

            <FormRow
              id='genshin-damage'
              title='Damage'
              summary={`Enemy level ${enemy.level}, ${enemy.res}% RES · ${Object.values(rotation.counts).reduce((sum, count) => sum + count, 0)} hits${
                rotation.reaction !== 'none' ? ` · ${rotation.reaction}` : ''
              }${byDamage ? '' : ' · not ranked by damage'}`}
            >
              <EnemyCard
                enemy={enemy}
                debuffs={debuffs}
                onChange={(next) => {
                  setEnemy(next)
                  setResult(undefined)
                }}
              />
              <RotationCard
                character={character}
                rotation={rotation}
                talents={talents}
                team={reactionsInTeam}
                damage={currentDamage}
                onChange={(next) => {
                  setRotation(next)
                  setResult(undefined)
                }}
              />
              <EffectsCard
                name={character.name}
                fourPieceSet={fourPieceSet ? setOptions.find((o) => o.value === fourPieceSet)?.label ?? fourPieceSet : undefined}
                applied={resolvedCombat.applied}
                onSetting={(id, value) => {
                  setCombatSettings((current) => ({ ...current, [id]: value }))
                  setResult(undefined)
                }}
              />
              <ExtraBuffsCard
                defs={GENSHIN_EXTRA_BUFFS}
                buffs={extraBuffs}
                onChange={(next) => {
                  setExtraBuffs(next)
                  setResult(undefined)
                }}
              />
            </FormRow>
          </FormRows>
          <KitDisclaimer name={character.name} effects={KIT_EFFECTS[character.id]} byDamage={byDamage} />

          {!outcome && (
            <Panel>
              <EmptyState icon={<IconTrendingUp size={24} />} title={`Find the best artifacts for ${character.name}`}>
                {`Pick what to rank by and any filters, then search. The best ${
                  resultLimitOf(resultLimit)
                } builds show up here next to ${character.name}'s current artifacts.`}
              </EmptyState>
            </Panel>
          )}

          {!running && poolSizes.some((size) => size === 0) && <NoBuildPanel causes={noResultCauses()} gearNoun='artifacts' empty='slot' />}

          {outcome && !outcome.ok && <Notices messages={[outcome.reason]} />}

          {outcome?.ok && result && (
            <Panel
              title='Results'
              description={`${(result.ms / 1000).toFixed(1)}s · ${formatNumber(outcome.visited)} partial and full builds checked · artifacts per slot ${
                outcome.poolSizes.join('/')
              }, ${outcome.prunedSizes.join('/')} after dropping ones that can't make the top ${resultLimitOf(resultLimit)}`}
            >
              <Stack gap='sm'>
                {outcome.truncated && (
                  <Text size='xs' c='yellow'>
                    The search stopped at its limit, so these are the best builds it found, not necessarily the best there are. A 4-piece set or main stat
                    filters make the search finish.
                  </Text>
                )}
                {outcome.builds.length === 0
                  ? <NoResults heading causes={noResultCauses()} gearNoun='artifacts' />
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
                        ...shown.map((stat) => ({ key: stat, label: statLabel(stat), format: (value: number) => formatStatValue(stat, value) })),
                      ]}
                      rows={outcome.builds.map((b, i) => ({
                        id: String(i),
                        rank: String(i + 1),
                        values: resultValues(b.score, statView === 'basic' ? computeGenshinStats(character, b.artifacts).stats : b.stats),
                        sets: describeSets(b.artifacts),
                      }))}
                      current={current
                        ? {
                          id: 'now',
                          rank: 'Now',
                          values: resultValues(current.score, statView === 'basic' ? computeGenshinStats(character, current.artifacts).stats : current.stats),
                          sets: describeSets(current.artifacts),
                        }
                        : undefined}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  )}
              </Stack>
            </Panel>
          )}

          <PreviewWithAnalysis game='genshin'>
            {build && result && (
              <BuildPreview
                title={`Build #${selected + 1}`}
                description={`${describeSets(build.artifacts)}${
                  current ? ` · ${build.score >= current.score ? '+' : ''}${(((build.score / current.score) - 1) * 100).toFixed(1)}% vs current` : ''
                }`}
                name={character.name}
                accent={character.element ? ELEMENT_ACCENTS[character.element] : undefined}
                portrait={images.characters[character.id]?.portrait}
                weapon={character.weapon && {
                  image: images.weapons[character.weapon.id],
                  name: character.weapon.name,
                  meta: `${character.weapon.rarity}★ · Lv ${character.weapon.level} · R${character.weapon.refinement}`,
                }}
                heading={
                  <Group gap={6} mt={4}>
                    {character.element && <Badge size='sm' variant='light' color={elementColor(character.element)}>{character.element}</Badge>}
                    <Text size='xs' c='dimmed'>
                      {`Lv ${character.level} · C${character.constellation}${teammates.some(Boolean) ? ' · with team buffs' : ''}`}
                    </Text>
                  </Group>
                }
                rows={genshinStatRows(character, build.stats)}
                rating={pickedDpsScore ?? genshinBuildScore(character, build.artifacts)}
                ratingLabel={pickedDpsScore ? DPS_SCORE_LABEL : 'Artifact score'}
                gear={build.artifacts.map((artifact) => (
                  <ArtifactCard
                    key={artifact.id}
                    artifact={artifact}
                    icon={images.artifacts[artifact.setId]?.[artifact.slot]}
                    owner={artifact.equippedBy ? (ownerNames.get(artifact.equippedBy) ?? artifact.equippedBy) : undefined}
                    score={scoreArtifact(artifact, genshinArtifactWeights(character))}
                  />
                ))}
              />
            )}

            {build && result && (
              <BuildAnalysis
                buildLabel={`Build #${selected + 1}`}
                rows={analysisRows}
                upgrades={genshinSubstatUpgrades(character, build.artifacts, result.target, teamBuffs, result.target.kind === 'damage' ? combat : undefined)}
                breakdown={result.target.kind === 'damage' ? genshinBreakdown(result.target.setup, build.stats) : undefined}
                scoreLabel={targetLabel(result.target)}
                formatRoll={(upgrade) => formatStatValue(upgrade.stat as GenshinStatKey, upgrade.roll)}
              />
            )}
          </PreviewWithAnalysis>
          <BuildCompare pinned={pins.pinned} onUnpin={pins.unpin} />
          <RememberDamageScore game='genshin' characterId={character.id} pieceIds={worn.map((a) => a.id)} score={currentDpsScore} />
        </Stack>

        <OptimizerSidebar
          pools={ARTIFACT_SLOTS.map((slot, i) => ({ label: SLOT_LABELS[slot], value: poolSizes[i] ?? 0 }))}
          combinations={poolSizes.reduce((product, size) => product * size, 1)}
          hint={poolSizes.some((size) => size === 0)
            ? { text: 'A slot has no artifacts left with these filters', warn: true }
            : { text: 'Most combinations are ruled out without being checked one by one.' }}
          canStart={poolSizes.every((size) => size > 0)}
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
          equip={build ? { label: `build #${selected + 1}`, onEquip: equipBuild, equipped: isWorn } : undefined}
          statView={{ value: statView, onChange: setStatView }}
          onReset={() => {
            updateSettings(defaultSettings(character.id))
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

// An artifact below max level with its max-level main stat (+20 for 5-star, +16 for 4-star), for Boost main stat
function boostArtifact(artifact: Artifact, store: EnkaGenshinStore): Artifact {
  const maxLevel = artifact.rarity * 4
  if (artifact.level >= maxLevel) return artifact
  const value = mainStatValue(store, artifact.rarity, maxLevel, artifact.main.stat as Parameters<typeof mainStatValue>[3])
  return value === undefined ? artifact : { ...artifact, main: { ...artifact.main, value } }
}
