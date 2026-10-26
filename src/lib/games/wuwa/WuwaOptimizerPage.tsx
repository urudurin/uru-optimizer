import {
  Button,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
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
import {
  EmptyState,
  Notices,
  PageHeader,
  Panel,
  StatGrid,
} from 'lib/games/shared/ui/GameLayout'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import classes from 'lib/games/shared/ui/Optimizer.module.css'
import {
  FormCard,
  FormRow,
  FormRows,
} from 'lib/games/shared/ui/OptimizerForm'
import { OptimizerSidebar } from 'lib/games/shared/ui/OptimizerSidebar'
import {
  characterName,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import { MAIN_STAT_MAX } from 'lib/games/wuwa/echoStats'
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
import { wuwaPiecesTaken } from 'lib/games/wuwa/state/wuwaState'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import {
  setPieceCounts,
  toDisplayStats,
  type WuwaStats,
} from 'lib/games/wuwa/stats/computeStats'
import {
  type Cost,
  type Echo,
  MAX_LOADOUT_COST,
  type StatKey,
  statLabel,
} from 'lib/games/wuwa/types'
import {
  EchoCard,
  setName,
} from 'lib/games/wuwa/ui/EchoCard'
import {
  useMemo,
  useState,
} from 'react'

const COSTS: Cost[] = [4, 3, 1]
const SHOWN_STATS: (keyof WuwaStats)[] = ['hp', 'atk', 'def', 'critRate', 'critDmg', 'energyRegen', 'elementDmg']
const MIN_STATS: (keyof WuwaStats)[] = ['energyRegen', 'critRate', 'critDmg', 'atk', 'hp', 'def', 'elementDmg']
const FLAT_STATS = new Set<keyof WuwaStats>(['hp', 'atk', 'def'])
const RESULT_LIMIT = 10

// Targets as Select values
const TARGETS: { value: string, target: EchoTarget }[] = [
  { value: 'avg:atk', target: { kind: 'averageHit', stat: 'atk', bonus: 'none' } },
  { value: 'avg:atk:skillDmg', target: { kind: 'averageHit', stat: 'atk', bonus: 'skillDmg' } },
  { value: 'avg:atk:libDmg', target: { kind: 'averageHit', stat: 'atk', bonus: 'libDmg' } },
  { value: 'avg:atk:basicDmg', target: { kind: 'averageHit', stat: 'atk', bonus: 'basicDmg' } },
  { value: 'avg:atk:heavyDmg', target: { kind: 'averageHit', stat: 'atk', bonus: 'heavyDmg' } },
  { value: 'avg:hp', target: { kind: 'averageHit', stat: 'hp', bonus: 'none' } },
  { value: 'avg:def', target: { kind: 'averageHit', stat: 'def', bonus: 'none' } },
  { value: 'cv', target: { kind: 'critValue' } },
  ...(['atk', 'hp', 'def', 'critRate', 'critDmg', 'energyRegen', 'elementDmg', 'healingBonus'] as (keyof WuwaStats)[])
    .map((stat) => ({ value: `stat:${stat}`, target: { kind: 'stat', stat } as EchoTarget })),
]

// As the overview screen shows it: rounded down
function formatStat(stat: keyof WuwaStats, stats: WuwaStats): string {
  const shown = toDisplayStats(stats)[stat]
  return FLAT_STATS.has(stat) ? formatNumber(shown) : `${shown}%`
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

const SETTINGS_KEY = 'wuwa-optimizer-settings'

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

  const target = TARGETS.find((t) => t.value === targetValue)?.target ?? TARGETS[0].target
  // A complete 5-piece set leaves no room for a 2-piece set, a 3-piece set leaves room for one
  const fullSetPieces = fullSet ? (SONATA_SETS[fullSet]?.fullPieces ?? 5) : 0
  const maxTwoPiece = fullSet ? Math.floor((5 - fullSetPieces) / 2) : 2
  const twoPieceOptions = setOptions.filter((o) => o.value !== fullSet && (SONATA_SETS[o.value]?.fullPieces ?? 5) === 5)
  const weapon = character.weaponId ? WEAPONS[character.weaponId] : undefined

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
                  {`Level ${character.level} · S${character.sequence} · ${weapon ? `${weapon.name} R${character.refinement}` : 'No weapon'}`}
                </Text>
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
                <Select
                  label='Full set (5-piece, or 3 for three-piece sets)'
                  placeholder='Any'
                  searchable
                  clearable
                  value={fullSet}
                  onChange={(value) => {
                    setFullSet(value)
                    setTwoPieceSets([])
                  }}
                  data={setOptions}
                />
                <MultiSelect
                  label='2-piece sets'
                  placeholder={maxTwoPiece === 0 ? 'No room with a 5-piece set' : twoPieceSets.length ? undefined : 'Any'}
                  searchable
                  disabled={maxTwoPiece === 0}
                  maxValues={maxTwoPiece}
                  value={twoPieceSets}
                  onChange={setTwoPieceSets}
                  data={twoPieceOptions}
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
                    <Table.ScrollContainer minWidth={640} mah={420}>
                      <Table highlightOnHover verticalSpacing={6} stickyHeader>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>#</Table.Th>
                            <Table.Th ta='right' c='var(--primary-light)'>{targetLabel(result.target)}</Table.Th>
                            {SHOWN_STATS.map((stat) => <Table.Th key={stat} ta='right'>{wuwaStatLabel(stat)}</Table.Th>)}
                            <Table.Th ta='right'>Cost</Table.Th>
                            <Table.Th>Sets</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {current && (
                            <Table.Tr>
                              <Table.Td c='dimmed'>Now</Table.Td>
                              <Table.Td ta='right' c='dimmed'>{formatScore(result.target, current.score)}</Table.Td>
                              {SHOWN_STATS.map((stat) => <Table.Td key={stat} ta='right' c='dimmed'>{formatStat(stat, current.stats)}</Table.Td>)}
                              <Table.Td ta='right' c='dimmed'>{costOf(current.echoes)}</Table.Td>
                              <Table.Td c='dimmed'>
                                <Text size='xs' lineClamp={1}>{describeSets(current.echoes)}</Text>
                              </Table.Td>
                            </Table.Tr>
                          )}
                          {outcome.builds.map((b, i) => (
                            <Table.Tr
                              key={b.echoes.map((e) => e.id).join()}
                              className={classes.resultRow}
                              data-active={i === selected || undefined}
                              onClick={() => setSelected(i)}
                            >
                              <Table.Td c='dimmed'>{i + 1}</Table.Td>
                              <Table.Td ta='right' fw={600}>{formatScore(result.target, b.score)}</Table.Td>
                              {SHOWN_STATS.map((stat) => <Table.Td key={stat} ta='right'>{formatStat(stat, b.stats)}</Table.Td>)}
                              <Table.Td ta='right'>{costOf(b.echoes)}</Table.Td>
                              <Table.Td>
                                <Text size='xs' lineClamp={1}>{describeSets(b.echoes)}</Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
              </Stack>
            </Panel>
          )}

          {build && result && (
            <Panel
              title={`Loadout #${selected + 1}`}
              description={`${describeSets(build.echoes)} · Cost ${costOf(build.echoes)} / ${MAX_LOADOUT_COST}${
                current ? ` · ${build.score >= current.score ? '+' : ''}${(((build.score / current.score) - 1) * 100).toFixed(1)}% vs current` : ''
              }`}
            >
              <Stack gap='md'>
                <StatGrid stats={SHOWN_STATS.map((stat) => ({ key: stat, label: wuwaStatLabel(stat), value: formatStat(stat, build.stats) }))} />
                <Text size='xs' c='dimmed'>Pick the main echo (its skill) yourself: echo skills don't change the overview screen.</Text>
                <div className={gear.grid}>
                  {build.echoes.map((echo) => <EchoCard key={echo.id} echo={echo} owner={ownerOf.get(echo.id)} />)}
                </div>
              </Stack>
            </Panel>
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
