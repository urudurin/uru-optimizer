import {
  Accordion,
  Button,
  FileInput,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
} from '@mantine/core'
import { IconTrendingUp } from '@tabler/icons-react'
import { formatNumber } from 'lib/games/shared/format'
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
import { AGENTS } from 'lib/games/zzz/data/agents'
import type {
  ActiveConditions,
  AgentData,
  Condition,
} from 'lib/games/zzz/data/dataTypes'
import { parseImportedZzzPresets } from 'lib/games/zzz/data/importedPresets'
import {
  daysSinceReview,
  getPreset,
  needsReview,
  REVIEW_INTERVAL_DAYS,
  type SetChoice,
} from 'lib/games/zzz/data/presets'
import { SETS } from 'lib/games/zzz/data/sets'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  countCombinations,
  filterPools,
  type MainStatSlot,
  MAX_COMBINATIONS,
  type OptimizerBuild,
  type OptimizerFilters,
  type OptimizerOutcome,
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
  CORE_SKILL_OPTIONS,
  formatStat,
  STAT_ROWS,
  type StatRow,
} from 'lib/games/zzz/statLabels'
import {
  type FinalStats,
  statScreenConditions,
} from 'lib/games/zzz/stats/computeStats'
import type {
  Disc,
  ZzzStatsValues,
} from 'lib/games/zzz/types'
import { DiscCard } from 'lib/games/zzz/ui/DiscCard'
import {
  useMemo,
  useState,
} from 'react'

const RESULT_LIMIT = 50
const MAX_IMPORT_WARNINGS = 6
const MAIN_STAT_SLOTS: MainStatSlot[] = [4, 5, 6]
const REFINEMENT_OPTIONS = [1, 2, 3, 4, 5].map((r) => ({ value: String(r), label: `R${r}` }))

type Loadout = { wEngineId: string, refinement: string }

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

export function ZzzOptimizerPanel({ onImport }: { onImport: () => void }) {
  const discs = useZzzStore((s) => s.discs)
  const builds = useZzzStore((s) => s.builds)

  const agents = Object.values(AGENTS)
  const [agentId, setAgentId] = useState(() => (agents.find((a) => builds.some((b) => b.agentId === a.id)) ?? agents[0]).id)
  const agent = AGENTS[agentId]
  const [loadout, setLoadout] = useState<Loadout>(() => defaultLoadout(agent, builds))
  const [coreSkill, setCoreSkill] = useState('6')
  const [conditions, setConditions] = useState<ActiveConditions>(statScreenConditions())
  const [sortBy, setSortBy] = useState<keyof FinalStats>('critDmg')
  const [thenBy, setThenBy] = useState<(keyof FinalStats)[]>([])
  const [presetChoice, setPresetChoice] = useState('0')
  const [fourPieceSet, setFourPieceSet] = useState<string | null>(null)
  const [twoPieceSet, setTwoPieceSet] = useState<string | null>(null)
  const [mainStats, setMainStats] = useState<Partial<Record<MainStatSlot, ZzzStatsValues[]>>>({})
  const [minStats, setMinStats] = useState<Partial<Record<keyof FinalStats, number>>>({})
  const [excludeEquippedByOthers, setExcludeEquippedByOthers] = useState(false)
  const [outcome, setOutcome] = useState<OptimizerOutcome | null>(null)
  const [selected, setSelected] = useState(0)
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
    setLoadout(defaultLoadout(AGENTS[id], builds))
    setPresetChoice('0')
    setOutcome(null)
  }

  // Fills the filters and ranking from the preset, minimum stats and conditions are left as they are
  function applyPreset() {
    const choice = preset.sets[Number(presetChoice)]
    setFourPieceSet(choice?.fourPiece ?? null)
    setTwoPieceSet(choice?.twoPiece ?? null)
    setMainStats({ ...preset.mainStats })
    setSortBy(preset.rankBy)
    setThenBy(preset.thenBy.filter((key) => statRows.some((row) => row.key === key)))
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
          <EmptyState icon={<IconTrendingUp size={24} />} title='Import your discs first' action={<Button onClick={onImport}>Import discs</Button>}>
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
  const rankLabel = statRows.find((row) => row.key === sortBy)?.label ?? sortBy
  const agentSummary = `${agent.name} · ${W_ENGINES[loadout.wEngineId]?.name ?? 'No W-Engine'} R${loadout.refinement} · ranked by ${rankLabel}`
  const mainFilters = MAIN_STAT_SLOTS.filter((slot) => mainStats[slot]?.length).length
  const minCount = Object.values(minStats).filter((v) => v !== undefined).length
  const conditionCount = Object.values(conditions).filter(Boolean).length
  const filterSummary = [
    [fourPieceSet ? `4pc ${setName(fourPieceSet)}` : '', twoPieceSet ? `2pc ${setName(twoPieceSet)}` : ''].filter(Boolean).join(' + ') || 'Any sets',
    mainFilters ? `${mainFilters} main stat filter${mainFilters === 1 ? '' : 's'}` : 'any main stats',
    conditionCount ? `${conditionCount} combat condition${conditionCount === 1 ? '' : 's'} on` : 'stat screen',
    minCount ? `${minCount} minimum${minCount === 1 ? '' : 's'}` : 'no minimums',
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
        description='Searches every combination of your discs and ranks them by the stat you pick. There is no damage calculation yet, so set minimums for the stats you also need.'
      />

      <div className={classes.optimizerLayout}>
        <Stack gap='md'>
          <FormRows>
            <FormRow id='zzz-agent' title='Agent' summary={agentSummary}>
              <FormCard title='Agent'>
                <Select
                  aria-label='Agent'
                  allowDeselect={false}
                  value={agentId}
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
                <SimpleGrid cols={2} spacing='sm'>
                  <Select
                    label='Refinement'
                    allowDeselect={false}
                    value={loadout.refinement}
                    onChange={(value) => value && setLoadout((prev) => ({ ...prev, refinement: value }))}
                    data={REFINEMENT_OPTIONS}
                  />
                  <Select
                    label='Core Skill'
                    allowDeselect={false}
                    value={coreSkill}
                    onChange={(value) => setCoreSkill(value ?? '6')}
                    data={CORE_SKILL_OPTIONS}
                  />
                </SimpleGrid>
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
                  onChange={(value) => value && setSortBy(value as keyof FinalStats)}
                  data={statRows.map((row) => ({ value: row.key, label: row.label }))}
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

            <FormRow id='zzz-filters' title='Disc filters' summary={filterSummary}>
              <FormCard title='Sets' size='narrow'>
                <Select label='4-piece set' placeholder='Any' clearable value={fourPieceSet} onChange={setFourPieceSet} data={setOptions} />
                <Select label='2-piece set' placeholder='Any' clearable value={twoPieceSet} onChange={setTwoPieceSet} data={setOptions} />
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
              <FormCard title='Minimum stats' size='wide' description='Builds below any of these are left out.'>
                <SimpleGrid cols={3} spacing='sm'>
                  {statRows.map((row) => (
                    <NumberInput
                      key={row.key}
                      label={row.label}
                      placeholder='None'
                      min={0}
                      value={minStats[row.key] ?? ''}
                      onChange={(value) => setMinStats((prev) => ({ ...prev, [row.key]: typeof value === 'number' ? value : undefined }))}
                    />
                  ))}
                </SimpleGrid>
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
                  <Table.ScrollContainer minWidth={640} mah={420}>
                    <Table highlightOnHover verticalSpacing={6} stickyHeader>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>#</Table.Th>
                          {resultColumns.map((row) => (
                            <Table.Th key={row.key} ta='right' c={row.key === sortBy ? 'var(--primary-light)' : undefined}>{row.label}</Table.Th>
                          ))}
                          <Table.Th>Sets</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {outcome.builds.map((build, i) => (
                          <Table.Tr
                            key={build.discs.map((d) => d.id).join()}
                            className={classes.resultRow}
                            data-active={i === selected || undefined}
                            onClick={() => setSelected(i)}
                          >
                            <Table.Td c='dimmed'>{i + 1}</Table.Td>
                            {resultColumns.map((row) => (
                              <Table.Td key={row.key} ta='right' fw={row.key === sortBy ? 600 : 400}>{formatStat(row, build.display[row.key])}</Table.Td>
                            ))}
                            <Table.Td>
                              <Text size='xs' lineClamp={1}>{describeSets(build.discs)}</Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
            </Panel>
          )}

          {best && (
            <Panel title={`Build #${selected + 1}`} description={describeSets(best.discs)}>
              <Stack gap='md'>
                <StatGrid
                  stats={statRows.map((row) => ({
                    key: row.key,
                    label: row.label,
                    value: formatStat(row, best.display[row.key]),
                    highlight: row.key === sortBy,
                  }))}
                />
                <Notices messages={best.warnings} />
                <div className={gear.grid}>
                  {best.discs.map((disc) => (
                    <DiscCard key={disc.id} disc={disc} owner={disc.equippedBy ? (ownerNames.get(disc.equippedBy) ?? `Agent ${disc.equippedBy}`) : undefined} />
                  ))}
                </div>
              </Stack>
            </Panel>
          )}
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
function resultColumnsFor(agent: AgentData, sortBy: keyof FinalStats, thenBy: (keyof FinalStats)[]): StatRow[] {
  const bySpecialty: Partial<Record<string, (keyof FinalStats)[]>> = {
    Anomaly: ['anomalyProficiency', 'anomalyMastery'],
    Stun: ['impact'],
    Rupture: ['sheerForce'],
  }
  const keys = [sortBy, ...thenBy, 'atk', 'critRate', 'critDmg', ...(bySpecialty[agent.specialty] ?? []), 'hp', 'def'] as (keyof FinalStats)[]
  return [...new Set(keys)].flatMap((key) => STAT_ROWS.filter((row) => row.key === key))
}
