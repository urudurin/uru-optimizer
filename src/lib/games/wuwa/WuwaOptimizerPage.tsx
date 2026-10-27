import {
  Badge,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { IconTrendingUp } from '@tabler/icons-react'
import { formatNumber } from 'lib/games/shared/format'
import {
  fieldSetter,
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
  FormCard,
  FormRow,
  FormRows,
} from 'lib/games/shared/ui/OptimizerForm'
import { OptimizerSidebar } from 'lib/games/shared/ui/OptimizerSidebar'
import { CHARACTER_INFO } from 'lib/games/wuwa/data/characters'
import {
  characterName,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import { useUserArt } from 'lib/games/wuwa/data/userArt'
import { MAIN_STAT_MAX } from 'lib/games/wuwa/echoStats'
import { wuwaSubstatUpgrades } from 'lib/games/wuwa/optimizer/analysis'
import {
  countLoadouts,
  type EchoOutcome,
  type EchoTarget,
  filterPool,
  targetLabel,
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
  setPieceCounts,
  toDisplayStats,
  type WuwaStats,
} from 'lib/games/wuwa/stats/computeStats'
import {
  scoreEcho,
  wuwaBuildScore,
  wuwaEchoWeights,
} from 'lib/games/wuwa/stats/echoScore'
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
import { wuwaStatRows } from 'lib/games/wuwa/ui/resonatorStats'
import {
  useMemo,
  useState,
} from 'react'

const COSTS: Cost[] = [4, 3, 1]
const SHOWN_STATS: (keyof WuwaStats)[] = ['hp', 'atk', 'def', 'critRate', 'critDmg', 'energyRegen', 'elementDmg']
const MIN_STATS: (keyof WuwaStats)[] = ['energyRegen', 'critRate', 'critDmg', 'atk', 'hp', 'def', 'elementDmg']
const FLAT_STATS = new Set<keyof WuwaStats>(['hp', 'atk', 'def'])
const RESULT_LIMIT = 10

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
  return sets.length > 0 ? sets.map(([id, count]) => `${count}pc ${setName(id)}`).join(' + ') : 'No set bonus'
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
  minStats: Partial<Record<keyof WuwaStats, number>>,
}

// What a Resonator starts with before their settings are changed (and saved)
function defaultSettings(): WuwaOptimizerSettings {
  return { targetValue: 'avg:atk', mainStats: {}, fullSet: null, twoPieceSets: [], excludeEquippedByOthers: true, minStats: {} }
}

export function WuwaOptimizerPage({ onImport }: { onImport: () => void }) {
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
  const [settings, updateSettings] = useCharacterSettings(SETTINGS_KEY, character?.charId ?? '', defaultSettings)
  const { targetValue, mainStats, fullSet, twoPieceSets, excludeEquippedByOthers, minStats } = settings
  const setTargetValue = fieldSetter(updateSettings, 'targetValue')
  const setMainStats = fieldSetter(updateSettings, 'mainStats')
  const setFullSet = fieldSetter(updateSettings, 'fullSet')
  const setTwoPieceSets = fieldSetter(updateSettings, 'twoPieceSets')
  const setExcludeEquippedByOthers = fieldSetter(updateSettings, 'excludeEquippedByOthers')
  const setMinStats = fieldSetter(updateSettings, 'minStats')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SearchProgress | undefined>()
  const [result, setResult] = useState<{ outcome: EchoOutcome, ms: number, target: EchoTarget } | undefined>()
  const [selected, setSelected] = useState(0)

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
          <EmptyState icon={<IconTrendingUp size={24} />} title='Import your echoes first' action={<Button onClick={onImport}>Import data</Button>}>
            Import your WuwaEchoScorer save, then search your echoes for the best loadout under the 12-cost limit.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  const target = wuwaTarget(targetValue)
  // A complete 5-piece set leaves no room for a 2-piece set, a 3-piece set leaves room for one
  const fullSetPieces = fullSet ? (SONATA_SETS[fullSet]?.fullPieces ?? 5) : 0
  const maxTwoPiece = fullSet ? Math.floor((5 - fullSetPieces) / 2) : 2
  const twoPieceOptions = setOptions.filter((o) => o.value !== fullSet && (SONATA_SETS[o.value]?.fullPieces ?? 5) === 5)
  const weapon = character.weaponId ? WEAPONS[character.weaponId] : undefined
  const element = CHARACTER_INFO[character.charId]?.element
  const resultValues = (b: { echoes: Echo[], stats: WuwaStats, score: number }) => ({
    score: b.score,
    ...Object.fromEntries(SHOWN_STATS.map((stat) => [stat, toDisplayStats(b.stats)[stat]])),
    cost: costOf(b.echoes),
  })

  const filters = { mainStats, fullSet: fullSet ?? undefined, twoPieceSets: twoPieceSets.slice(0, maxTwoPiece), excludeEquippedByOthers }
  // Echoes per cost after the filters, and the loadouts they make, live as the filters change
  const pool = filterPool({ character, characters, echoes, filters })

  async function run() {
    setRunning(true)
    setProgress(undefined)
    const response = await runEchoOptimizer({ character, characters, echoes, filters, minStats, target, limit: RESULT_LIMIT }, setProgress)
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
  const mainFilters = COSTS.filter((cost) => mainStats[cost]?.length).length
  const minCount = Object.values(minStats).filter((v) => v !== undefined).length
  const filterSummary = [
    [fullSet ? `Full ${setName(fullSet)}` : '', ...twoPieceSets.slice(0, maxTwoPiece).map((id) => `2pc ${setName(id)}`)].filter(Boolean).join(' + ')
    || 'Any sets',
    mainFilters ? `${mainFilters} main stat filter${mainFilters === 1 ? '' : 's'}` : 'any main stats',
    minCount ? `${minCount} minimum${minCount === 1 ? '' : 's'}` : 'no minimums',
  ].join(' · ')
  const wornIds = new Set(character.echoIds.filter((id) => id !== null))
  const isWorn = !!build && build.echoes.length === wornIds.size && build.echoes.every((e) => wornIds.has(e.id))

  function equipBuild() {
    if (!build || !result) return
    const losing = wuwaPiecesTaken({ echoes, characters, teams, priority }, character.charId, build.echoes).map(characterName)
    const taken = losing.length > 0
      ? `

${losing.join(', ')} will lose the echoes this loadout takes.`
      : ''
    if (!window.confirm(`Equip loadout #${selected + 1} on ${characterName(character.charId)} in this browser's save?${taken}`)) return
    equip(character.charId, build.echoes)
    // The "Now" row is this loadout from here on
    if (result.outcome.ok) setResult({ ...result, outcome: { ...result.outcome, current: build } })
  }

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Optimizer'
        description='Searches your echoes for the loadouts (up to 5 echoes, 12 cost) that score highest, with stats worked out like the Resonators page. There is no full damage calculation: the average hit is the scaling stat times the crit multiplier and DMG bonus, so set minimums (such as Energy Regen) for anything else the Resonator needs.'
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
                {/* Like HSR's Eidolon and Superimposition buttons, these change the saved Resonator */}
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
                description='The average hit is the scaling stat times the crit multiplier and DMG bonus, there is no full damage calculation.'
              >
                <Select
                  aria-label='Rank by'
                  allowDeselect={false}
                  value={targetValue}
                  onChange={(value) => value && setTargetValue(value)}
                  data={TARGETS.map((t) => ({ value: t.value, label: targetLabel(t.target) }))}
                />
              </FormCard>
              <FormCard title='Options' size='narrow'>
                <Switch
                  label='Leave out echoes other Resonators are wearing'
                  checked={excludeEquippedByOthers}
                  onChange={(event) => setExcludeEquippedByOthers(event.currentTarget.checked)}
                />
              </FormCard>
            </FormRow>

            <FormRow id='wuwa-filters' title='Echo filters' summary={filterSummary}>
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
              <FormCard title='Minimum stats' size='wide' description='Loadouts below any of these are left out, e.g. Energy Regen 120.'>
                <SimpleGrid cols={2} spacing='sm'>
                  {MIN_STATS.map((stat) => (
                    <NumberInput
                      key={stat}
                      label={wuwaStatLabel(stat)}
                      placeholder='None'
                      min={0}
                      value={minStats[stat] ?? ''}
                      onChange={(value) => setMinStats((prev) => ({ ...prev, [stat]: typeof value === 'number' ? value : undefined }))}
                    />
                  ))}
                </SimpleGrid>
              </FormCard>
            </FormRow>
          </FormRows>

          {!outcome && (
            <Panel>
              <EmptyState icon={<IconTrendingUp size={24} />} title={`Find the best echoes for ${characterName(character.charId)}`}>
                {`Pick what to rank by and any filters, then search. The best ${RESULT_LIMIT} loadouts show up here next to the current one.`}
              </EmptyState>
            </Panel>
          )}

          {outcome && !outcome.ok && <Notices messages={[outcome.reason]} />}

          {outcome?.ok && result && (
            <Panel
              title='Results'
              description={`${(result.ms / 1000).toFixed(1)}s · ${
                formatNumber(outcome.visited)
              } partial and full loadouts checked · ${outcome.poolSize} echoes, ${outcome.prunedSize} after dropping ones that can't make the top ${RESULT_LIMIT}`}
            >
              <Stack gap='sm'>
                {outcome.truncated && (
                  <Text size='xs' c='yellow'>
                    The search stopped at its limit, so these are the best loadouts it found, not necessarily the best there are. A full set or main stat
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
              rating={wuwaBuildScore(character, build.echoes)}
              ratingLabel='Echo score'
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
              rows={[
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
              ]}
              upgrades={wuwaSubstatUpgrades(character, build.echoes, result.target)}
              scoreLabel={targetLabel(result.target)}
              formatRoll={(upgrade) => upgrade.stat.endsWith('Flat') ? String(Math.round(upgrade.roll)) : `${upgrade.roll.toFixed(1)}%`}
            />
          )}
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
        />
      </div>
    </Stack>
  )
}
