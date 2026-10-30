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
import {
  DEFAULT_ENEMY,
  defaultRotation,
  type EnemySettings,
  hasTalentData,
  migrateRotationCounts,
  type Rotation,
  rotationDamage,
  rotationTalents,
  stellarContribution,
  teamReactions,
} from 'lib/games/genshin/damage/damage'
import {
  EffectsCard,
  EnemyCard,
  RotationCard,
} from 'lib/games/genshin/damage/DamageCards'
import { useGenshinImages } from 'lib/games/genshin/data/images'
import {
  GenshinTeamCards,
  teamSummary,
} from 'lib/games/genshin/GenshinTeamCards'
import { nameFromGoodKey } from 'lib/games/genshin/goodKeys'
import { genshinSubstatUpgrades } from 'lib/games/genshin/optimizer/analysis'
import {
  filterPools,
  type MainStatSlot,
  type OptimizerOutcome,
  type OptimizerTarget,
  targetLabel,
} from 'lib/games/genshin/optimizer/artifactOptimizer'
import {
  cancelOptimizer,
  runOptimizer,
} from 'lib/games/genshin/optimizer/optimizerClient'
import {
  GENSHIN_SETTINGS_KEY as SETTINGS_KEY,
  GENSHIN_TARGETS as TARGETS,
  genshinTarget,
} from 'lib/games/genshin/optimizer/targets'
import { genshinPiecesTaken } from 'lib/games/genshin/state/genshinState'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import {
  genshinArtifactWeights,
  genshinBuildScore,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import {
  computeGenshinStats,
  hasStatData,
} from 'lib/games/genshin/stats/computeStats'
import type { BuffSetting } from 'lib/games/genshin/team/buffs'
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
import { formatNumber } from 'lib/games/shared/format'
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
import {
  FormCard,
  FormRow,
  FormRows,
} from 'lib/games/shared/ui/OptimizerForm'
import { OptimizerSidebar } from 'lib/games/shared/ui/OptimizerSidebar'
import {
  useMemo,
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

const RESULT_LIMIT = 10

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
  minStats: Partial<Record<GenshinStatKey, number>>,
  maxStats: Partial<Record<GenshinStatKey, number>>,
  // The team (team/teamBuffs.ts): teammate ids, whether this character is on the field, buff toggles
  teammates: string[],
  onField: boolean,
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
    minStats: {},
    maxStats: {},
    teammates: [],
    onField: true,
    teamSettings: {},
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

export function GenshinOptimizerPage({ onImport }: { onImport: () => void }) {
  useState(migrateSaves)
  const artifacts = useGenshinStore((s) => s.artifacts)
  const characters = useGenshinStore((s) => s.characters)
  const images = useGenshinImages()
  const saveCharacter = useGenshinStore((s) => s.saveCharacter)
  const usable = useMemo(() => characters.filter(hasStatData), [characters])
  const [characterId, setCharacterId] = useState<string | null>(() => readOptimizerSettings(SETTINGS_KEY).last ?? null)
  const character = usable.find((c) => c.id === characterId) ?? usable[0]

  // Saved per character, see shared/optimizerSettings.ts
  const [settings, updateSettings] = useCharacterSettings(SETTINGS_KEY, character?.id ?? '', () => defaultSettings(character?.id ?? ''))
  const {
    targetValue,
    mainStats,
    fourPieceSet,
    twoPieceSets,
    excludeEquippedByOthers,
    minStats,
    maxStats,
    teammates,
    onField,
    teamSettings,
    enemy,
    rotation,
    combatSettings,
  } = settings
  const setTargetValue = fieldSetter(updateSettings, 'targetValue')
  const setMainStats = fieldSetter(updateSettings, 'mainStats')
  const setFourPieceSet = fieldSetter(updateSettings, 'fourPieceSet')
  const setTwoPieceSets = fieldSetter(updateSettings, 'twoPieceSets')
  const setExcludeEquippedByOthers = fieldSetter(updateSettings, 'excludeEquippedByOthers')
  const setMinStats = fieldSetter(updateSettings, 'minStats')
  const setMaxStats = fieldSetter(updateSettings, 'maxStats')
  const setTeammates = fieldSetter(updateSettings, 'teammates')
  const setOnField = fieldSetter(updateSettings, 'onField')
  const setTeamSettings = fieldSetter(updateSettings, 'teamSettings')
  const setEnemy = fieldSetter(updateSettings, 'enemy')
  const setRotation = fieldSetter(updateSettings, 'rotation')
  const setCombatSettings = fieldSetter(updateSettings, 'combatSettings')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SearchProgress | undefined>()
  const [result, setResult] = useState<{ outcome: OptimizerOutcome, ms: number, target: OptimizerTarget } | undefined>()
  const [selected, setSelected] = useState(0)

  const ownerNames = useMemo(() => new Map(characters.map((c) => [c.id, c.name])), [characters])
  const equip = useGenshinStore((s) => s.equip)
  const filters = useMemo(
    () => ({ mainStats, fourPieceSet: fourPieceSet ?? undefined, twoPieceSets, excludeEquippedByOthers }),
    [mainStats, fourPieceSet, twoPieceSets, excludeEquippedByOthers],
  )
  // Artifacts per slot after the filters, live as the filters change
  const poolSizes = useMemo(
    () => (character ? filterPools({ character, artifacts, filters }).map((pool) => pool.length) : []),
    [character, artifacts, filters],
  )
  const setOptions = useMemo(() => {
    const names = new Map(artifacts.map((a) => [a.setId, a.setName]))
    return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [artifacts])

  if (!character) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Optimizer' />
        <Panel>
          <EmptyState icon={<IconTrendingUp size={24} />} title='Import your artifacts first' action={<Button onClick={onImport}>Import</Button>}>
            A GOOD file from an artifact scanner brings in your whole inventory, which the optimizer searches for the best 5-piece builds.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  // What the team gives this character, the same for every build
  const team = { teammates, onField, settings: teamSettings }
  const teamResult = teamBuffsFor(character, team, { characters, artifacts })
  const teamBuffs = { premod: teamResult.premod, total: teamResult.total }
  const talents = rotationTalents(character, rotation)
  // The Lunar and Stellar kinds this team can trigger; the page only offers those
  const reactionsInTeam = teamReactions([character.id, ...teammates])
  // The character's own combat effects: their kit, and the 4-piece filter's set (every build has it)
  const combat: CombatSetup = { sets: fourPieceSet ? [fourPieceSet] : [], settings: combatSettings }
  const resolvedCombat = resolveCombat(character, combat, setCountsOf(fourPieceSet ? Array(4).fill(fourPieceSet) : []))
  const debuffs = {
    defShred: teamResult.debuffs.defShred + resolvedCombat.debuffs.defShred,
    resShred: { ...teamResult.debuffs.resShred },
  }
  for (const [element, value] of Object.entries(resolvedCombat.debuffs.resShred) as [keyof typeof debuffs.resShred, number][]) {
    debuffs.resShred[element] = (debuffs.resShred[element] ?? 0) + value
  }
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
    specialFlat: teamResult.specialFlat,
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

  async function run() {
    setRunning(true)
    setProgress(undefined)
    const response = await runOptimizer({
      character,
      artifacts,
      filters,
      minStats,
      maxStats,
      target,
      limit: RESULT_LIMIT,
      teamBuffs,
      // Combat effects only count for rotation damage; the stat targets stay on the stat screen
      combat: byDamage ? combat : undefined,
    }, setProgress)
    // undefined: cancelled, or replaced by a newer search that is still running
    if (response) {
      setResult({ ...response, target })
      setSelected(0)
      setRunning(false)
    }
  }

  function cancel() {
    cancelOptimizer()
    setRunning(false)
  }

  const outcome = result?.outcome
  const build = outcome?.ok ? outcome.builds[selected] : undefined
  const current = outcome?.ok ? outcome.current : undefined
  const shown = statsToShow(character)
  const resultValues = (score: number, stats: Partial<Record<GenshinStatKey, number>>) => ({
    score,
    ...Object.fromEntries(shown.map((stat) => [stat, stats[stat] ?? 0])),
  })
  const setName = (id: string) => setOptions.find((o) => o.value === id)?.label ?? id
  const mainFilters = MAIN_STAT_SLOTS.filter((slot) => mainStats[slot]?.length).length
  const filterSummary = [
    fourPieceSet ? `4pc ${setName(fourPieceSet)}` : twoPieceSets.length ? twoPieceSets.map((id) => `2pc ${setName(id)}`).join(' + ') : 'Any sets',
    mainFilters ? `${mainFilters} main stat filter${mainFilters === 1 ? '' : 's'}` : 'any main stats',
    limitsSummary(minStats, maxStats),
  ].join(' · ')
  const isWorn = build?.artifacts.every((a) => character.artifactIds[a.slot] === a.id) ?? false

  function equipBuild() {
    if (!build || !result) return
    const losing = genshinPiecesTaken({ artifacts, characters }, character.id, build.artifacts).map((id) => ownerNames.get(id) ?? id)
    const swap = losing.length > 0
      ? `

${losing.join(', ')} will get ${character.name}'s current pieces in exchange.`
      : ''
    if (!window.confirm(`Equip build #${selected + 1} on ${character.name} in this browser's save?${swap}`)) return
    equip(character.id, build.artifacts)
    // The "Now" row is this build from here on
    if (result.outcome.ok) setResult({ ...result, outcome: { ...result.outcome, current: build } })
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
                <Select
                  aria-label='Character'
                  searchable
                  allowDeselect={false}
                  value={character.id}
                  onChange={(value) => {
                    if (!value) return
                    setCharacterId(value)
                    rememberCharacter(SETTINGS_KEY, value)
                    setResult(undefined)
                  }}
                  data={usable.map((c) => ({ value: c.id, label: c.name }))}
                />
                <Text size='xs' c='dimmed'>
                  {`Level ${character.level} · ${character.weapon ? `${character.weapon.name}, level ${character.weapon.level}` : 'No weapon'}`}
                </Text>
                {/* Like HSR's light cone, Eidolon and Superimposition pickers, these change the saved character */}
                <Select
                  label='Weapon'
                  searchable
                  allowDeselect={false}
                  placeholder='No weapon'
                  value={character.weapon?.id ?? null}
                  onChange={(id) => {
                    if (!id || id === character.weapon?.id) return
                    const weapon = {
                      id,
                      name: images.weaponInfo[id]?.name ?? nameFromGoodKey(id),
                      rarity: WEAPON_RARITY[id] ?? 5,
                      level: character.weapon?.level ?? 90,
                      refinement: character.weapon?.refinement ?? 1,
                    }
                    saveCharacter({ ...character, weapon })
                    setResult(undefined)
                  }}
                  data={weaponOptions(images.weaponInfo, images.characterInfo[character.id.startsWith('Traveler') ? 'Traveler' : character.id]?.weaponType)}
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
              </FormCard>
              <FormCard title='Options' size='narrow'>
                <Switch
                  label='Leave out artifacts other characters are wearing'
                  checked={excludeEquippedByOthers}
                  onChange={(event) => setExcludeEquippedByOthers(event.currentTarget.checked)}
                />
              </FormCard>
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
            </FormRow>

            <FormRow id='genshin-team' title='Team' summary={teamSummary(team, teamResult, characters)}>
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
            </FormRow>

            <FormRow id='genshin-filters' title='Artifact filters' summary={filterSummary}>
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
          </FormRows>

          {!outcome && (
            <Panel>
              <EmptyState icon={<IconTrendingUp size={24} />} title={`Find the best artifacts for ${character.name}`}>
                {`Pick what to rank by and any filters, then search. The best ${RESULT_LIMIT} builds show up here next to ${character.name}'s current artifacts.`}
              </EmptyState>
            </Panel>
          )}

          {outcome && !outcome.ok && <Notices messages={[outcome.reason]} />}

          {outcome?.ok && result && (
            <Panel
              title='Results'
              description={`${(result.ms / 1000).toFixed(1)}s · ${formatNumber(outcome.visited)} partial and full builds checked · artifacts per slot ${
                outcome.poolSizes.join('/')
              }, ${outcome.prunedSizes.join('/')} after dropping ones that can't make the top ${RESULT_LIMIT}`}
            >
              <Stack gap='sm'>
                {outcome.truncated && (
                  <Text size='xs' c='yellow'>
                    The search stopped at its limit, so these are the best builds it found, not necessarily the best there are. A 4-piece set or main stat
                    filters make the search finish.
                  </Text>
                )}
                {outcome.builds.length === 0
                  ? <Text size='sm' c='dimmed'>Nothing matched. Loosen the minimum stats or filters and search again.</Text>
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
                        values: resultValues(b.score, b.stats),
                        sets: describeSets(b.artifacts),
                      }))}
                      current={current
                        ? { id: 'now', rank: 'Now', values: resultValues(current.score, current.stats), sets: describeSets(current.artifacts) }
                        : undefined}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  )}
              </Stack>
            </Panel>
          )}

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
              rating={genshinBuildScore(character, build.artifacts)}
              ratingLabel='Artifact score'
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
              rows={[
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
              ]}
              upgrades={genshinSubstatUpgrades(character, build.artifacts, result.target, teamBuffs, result.target.kind === 'damage' ? combat : undefined)}
              scoreLabel={targetLabel(result.target)}
              formatRoll={(upgrade) => formatStatValue(upgrade.stat as GenshinStatKey, upgrade.roll)}
            />
          )}
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
        />
      </div>
    </Stack>
  )
}
