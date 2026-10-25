import {
  Alert,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type {
  ActiveConditions,
  AgentData,
  Condition,
  WEngineData,
} from 'lib/games/zzz/data/dataTypes'
import {
  daysSinceReview,
  getPreset,
  needsReview,
  REVIEW_INTERVAL_DAYS,
} from 'lib/games/zzz/data/presets'
import { SETS } from 'lib/games/zzz/data/sets'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import type { ImportedBuild } from 'lib/games/zzz/importer/zzzBuildsExportParser'
import {
  countCombinations,
  filterPools,
  type MainStatSlot,
  MAX_COMBINATIONS,
  optimizeDiscs,
  type OptimizerBuild,
  type OptimizerFilters,
  type OptimizerOutcome,
} from 'lib/games/zzz/optimizer/discOptimizer'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import {
  CONDITION_LABELS,
  CORE_SKILL_OPTIONS,
  formatStat,
  formatSubstat,
  STAT_ROWS,
} from 'lib/games/zzz/statLabels'
import {
  type FinalStats,
  statScreenConditions,
} from 'lib/games/zzz/stats/computeStats'
import type {
  Disc,
  ZzzStatsValues,
} from 'lib/games/zzz/types'
import {
  useMemo,
  useState,
} from 'react'

const RESULT_LIMIT = 50
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

function describeSets(discs: Disc[]): string {
  const counts = new Map<string, number>()
  for (const disc of discs) counts.set(disc.setName, (counts.get(disc.setName) ?? 0) + 1)
  return [...counts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${count >= 4 ? 4 : 2}pc ${name}`)
    .join(' + ') || 'No set bonus'
}

export function ZzzOptimizerPanel() {
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

  const statRows = STAT_ROWS.filter((row) => !row.ruptureOnly || agent.specialty === 'Rupture')
  const preset = getPreset(agent)
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
  const combinations = countCombinations(filterPools({ agent, discs, filters }))

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

  function run() {
    const wEngine = W_ENGINES[loadout.wEngineId]
    if (!wEngine) return
    setRunning(true)
    // Let the button show its loading state before the search blocks the page for a moment
    setTimeout(() => {
      try {
        runSearch(wEngine)
      } catch (e) {
        // optimizeDiscs isn't expected to throw, but a stuck loading button would hide the problem
        console.error('Disc optimizer failed', e)
        setOutcome({ ok: false, reason: `The search failed: ${e instanceof Error ? e.message : String(e)}` })
      } finally {
        setRunning(false)
      }
    }, 20)
  }

  function runSearch(wEngine: WEngineData) {
    setOutcome(optimizeDiscs({
      agent,
      wEngine,
      wEngineRefinement: Number(loadout.refinement),
      coreSkillLevel: Number(coreSkill),
      conditions,
      discs,
      filters,
      minStats,
      sortBy,
      thenBy,
      limit: RESULT_LIMIT,
    }))
    setSelected(0)
  }

  if (discs.length === 0) {
    return (
      <Stack gap='sm'>
        <Title order={4}>Disc optimizer</Title>
        <Text size='sm'>Import discs to search for the best combination.</Text>
      </Stack>
    )
  }

  const best: OptimizerBuild | undefined = outcome?.ok ? outcome.builds[selected] : undefined

  return (
    <Stack gap='sm'>
      <Title order={4}>Disc optimizer</Title>
      <Text size='xs' c='dimmed'>
        Ranks every combination of your discs by one stat. There is no damage calculation yet, so pick the stat that matters most and set minimums for the
        others.
      </Text>

      <Group align='flex-end' gap='md'>
        <Select
          label='Agent'
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
        <Select
          label='Refinement'
          w={90}
          allowDeselect={false}
          value={loadout.refinement}
          onChange={(value) => value && setLoadout((prev) => ({ ...prev, refinement: value }))}
          data={REFINEMENT_OPTIONS}
        />
        <Select
          label='Core Skill level'
          w={140}
          allowDeselect={false}
          value={coreSkill}
          onChange={(value) => setCoreSkill(value ?? '6')}
          data={CORE_SKILL_OPTIONS}
        />
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
          w={260}
          value={thenBy}
          onChange={(value) => setThenBy(value as (keyof FinalStats)[])}
          data={statRows.filter((row) => row.key !== sortBy).map((row) => ({ value: row.key, label: row.label }))}
        />
      </Group>

      <Stack gap={4} p='sm' style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
        <Group align='flex-end' gap='md'>
          <Text size='sm' fw={500}>{`Recommended for ${agent.name}`}</Text>
          {preset.sets.length > 1 && (
            <Select
              size='xs'
              allowDeselect={false}
              value={presetChoice}
              onChange={(value) => setPresetChoice(value ?? '0')}
              data={preset.sets.map((choice, i) => ({
                value: String(i),
                label: `4pc ${setName(choice.fourPiece)} + 2pc ${setName(choice.twoPiece)}`,
              }))}
            />
          )}
          <Button size='xs' variant='light' onClick={applyPreset}>Apply preset</Button>
        </Group>
        {preset.sets.map((choice, i) => (
          <Text key={i} size='xs'>
            {`${i === 0 ? 'Sets' : 'Or'}: 4pc ${setName(choice.fourPiece)} (you have it in ${slotsWithSet(discs, choice.fourPiece)}/6 slots) + 2pc ${
              setName(choice.twoPiece)
            } (${slotsWithSet(discs, choice.twoPiece)}/6 slots)`}
          </Text>
        ))}
        <Text size='xs'>
          {`Main stats: slot 4 ${preset.mainStats[4].join(' / ')}, slot 5 ${preset.mainStats[5].join(' / ')}, slot 6 ${preset.mainStats[6].join(' / ')}`}
        </Text>
        <Text size='xs'>{`Substats to look for: ${preset.substatPriority.join(' > ')}`}</Text>
        <Text size='xs'>{preset.notes}</Text>
        <Text size='xs' c='dimmed'>
          {`Source: ${preset.source}. Confidence: ${preset.confidence}. Last reviewed ${preset.reviewed}${
            reviewAge === undefined ? '' : ` (${reviewAge} day${reviewAge === 1 ? '' : 's'} ago)`
          }`}
        </Text>
        {needsReview(preset, new Date()) && (
          <Text size='xs' c='yellow'>
            {`Not reviewed in ${REVIEW_INTERVAL_DAYS} days or more: check it against the game and update data/presets.ts`}
          </Text>
        )}
      </Stack>

      <Group gap='lg'>
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
        <Switch
          label='Leave out discs other agents are wearing'
          checked={excludeEquippedByOthers}
          onChange={(event) => setExcludeEquippedByOthers(event.currentTarget.checked)}
        />
      </Group>

      <Group align='flex-end' gap='md'>
        <Select label='4-piece set' placeholder='Any' clearable value={fourPieceSet} onChange={setFourPieceSet} data={setOptions} />
        <Select label='2-piece set' placeholder='Any' clearable value={twoPieceSet} onChange={setTwoPieceSet} data={setOptions} />
        {MAIN_STAT_SLOTS.map((slot) => (
          <MultiSelect
            key={slot}
            label={`Slot ${slot} main stat`}
            placeholder={mainStats[slot]?.length ? undefined : 'Any'}
            w={200}
            value={mainStats[slot] ?? []}
            onChange={(value) => setMainStats((prev) => ({ ...prev, [slot]: value as ZzzStatsValues[] }))}
            data={mainStatOptions[slot]}
          />
        ))}
      </Group>

      <Text size='sm' fw={500}>Minimum stats</Text>
      <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }} spacing='xs'>
        {statRows.map((row) => (
          <NumberInput
            key={row.key}
            size='xs'
            label={row.label}
            placeholder='None'
            min={0}
            value={minStats[row.key] ?? ''}
            onChange={(value) => setMinStats((prev) => ({ ...prev, [row.key]: typeof value === 'number' ? value : undefined }))}
          />
        ))}
      </SimpleGrid>

      <Group gap='md'>
        <Button onClick={run} loading={running} disabled={combinations === 0 || combinations > MAX_COMBINATIONS}>
          Search
        </Button>
        <Text size='sm'>
          {combinations > MAX_COMBINATIONS
            ? `${combinations.toLocaleString('en-US')} combinations, narrow the main stats or sets first`
            : `Up to ${combinations.toLocaleString('en-US')} combinations`}
        </Text>
      </Group>

      {outcome && !outcome.ok && <Alert color='yellow'>{outcome.reason}</Alert>}

      {outcome?.ok && (
        <Text size='sm'>
          {`${outcome.matched.toLocaleString('en-US')} combinations meet the filters, showing the best ${outcome.builds.length}`}
        </Text>
      )}

      {outcome?.ok && outcome.builds.length > 0 && (
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                {statRows.map((row) => <Table.Th key={row.key} ta='right' fw={row.key === sortBy ? 700 : 400}>{row.label}</Table.Th>)}
                <Table.Th>Sets</Table.Th>
                <Table.Th>Slots 4 / 5 / 6</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {outcome.builds.map((build, i) => (
                <Table.Tr
                  key={build.discs.map((d) => d.id).join()}
                  onClick={() => setSelected(i)}
                  style={{ cursor: 'pointer' }}
                  bg={i === selected ? 'var(--mantine-color-blue-light)' : undefined}
                >
                  <Table.Td>{i + 1}</Table.Td>
                  {statRows.map((row) => (
                    <Table.Td key={row.key} ta='right' fw={row.key === sortBy ? 700 : 400}>{formatStat(row, build.display[row.key])}</Table.Td>
                  ))}
                  <Table.Td>{describeSets(build.discs)}</Table.Td>
                  <Table.Td>{build.discs.slice(3).map((d) => d.main.stat).join(' / ')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {best && (
        <Stack gap='xs'>
          <Text size='sm' fw={500}>{`Build #${selected + 1}: ${describeSets(best.discs)}`}</Text>
          {best.warnings.length > 0 && (
            <Alert color='yellow' title='Heads up'>
              <Stack gap={2}>
                {best.warnings.map((message, i) => <Text key={i} size='xs'>{message}</Text>)}
              </Stack>
            </Alert>
          )}
          <Table.ScrollContainer minWidth={640}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Slot</Table.Th>
                  <Table.Th>Set</Table.Th>
                  <Table.Th>Main stat</Table.Th>
                  <Table.Th>Substats</Table.Th>
                  <Table.Th>Worn by</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {best.discs.map((disc) => (
                  <Table.Tr key={disc.id}>
                    <Table.Td>{disc.slot}</Table.Td>
                    <Table.Td>{disc.setName}</Table.Td>
                    <Table.Td>{`${disc.main.stat} ${disc.main.value}`}</Table.Td>
                    <Table.Td>{disc.substats.map((substat) => formatSubstat(disc, substat)).join(', ')}</Table.Td>
                    <Table.Td>{disc.equippedBy ? (ownerNames.get(disc.equippedBy) ?? `Agent ${disc.equippedBy}`) : ''}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      )}
    </Stack>
  )
}
