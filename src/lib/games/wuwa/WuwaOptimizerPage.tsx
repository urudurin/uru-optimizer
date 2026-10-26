import {
  Accordion,
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
} from '@mantine/core'
import {
  IconSearch,
  IconTrendingUp,
} from '@tabler/icons-react'
import { formatNumber } from 'lib/games/shared/format'
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
  characterName,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import { MAIN_STAT_MAX } from 'lib/games/wuwa/echoStats'
import {
  type EchoOutcome,
  type EchoTarget,
  targetLabel,
  wuwaStatLabel,
} from 'lib/games/wuwa/optimizer/echoOptimizer'
import {
  cancelEchoOptimizer,
  runEchoOptimizer,
} from 'lib/games/wuwa/optimizer/optimizerClient'
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

export function WuwaOptimizerPage({ onImport }: { onImport: () => void }) {
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const [characterId, setCharacterId] = useState<string | null>(null)
  const character = characters.find((c) => c.charId === characterId) ?? characters[0]

  const [targetValue, setTargetValue] = useState('avg:atk')
  const [mainStats, setMainStats] = useState<Partial<Record<Cost, StatKey[]>>>({})
  const [fullSet, setFullSet] = useState<string | null>(null)
  const [twoPieceSets, setTwoPieceSets] = useState<string[]>([])
  const [excludeEquippedByOthers, setExcludeEquippedByOthers] = useState(true)
  const [minStats, setMinStats] = useState<Partial<Record<keyof WuwaStats, number>>>({})
  const [running, setRunning] = useState(false)
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

  async function run() {
    setRunning(true)
    const response = await runEchoOptimizer({
      character,
      characters,
      echoes,
      filters: { mainStats, fullSet: fullSet ?? undefined, twoPieceSets: twoPieceSets.slice(0, maxTwoPiece), excludeEquippedByOthers },
      minStats,
      target,
      limit: RESULT_LIMIT,
    })
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

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Optimizer'
        description='Searches your echoes for the loadouts (up to 5 echoes, 12 cost) that score highest, with stats worked out like the Resonators page. There is no full damage calculation: the average hit is the scaling stat times the crit multiplier and DMG bonus, so set minimums (such as Energy Regen) for anything else the Resonator needs.'
      />

      <div className={classes.optimizerLayout}>
        <Stack gap='md'>
          <Panel title='Resonator'>
            <Stack gap='sm'>
              <Select
                label='Resonator'
                searchable
                allowDeselect={false}
                value={character.charId}
                onChange={(value) => {
                  setCharacterId(value)
                  setResult(undefined)
                }}
                data={characters.map((c) => ({ value: c.charId, label: characterName(c.charId) }))}
              />
              <Text size='xs' c='dimmed'>
                {`Level ${character.level} · S${character.sequence} · ${weapon ? `${weapon.name} R${character.refinement}` : 'No weapon'}`}
              </Text>
              <Select
                label='Rank by'
                allowDeselect={false}
                value={targetValue}
                onChange={(value) => value && setTargetValue(value)}
                data={TARGETS.map((t) => ({ value: t.value, label: targetLabel(t.target) }))}
              />
            </Stack>
          </Panel>

          <Panel
            title='Filters'
            description='Only set bonuses the overview screen shows are counted (2-pieces, not most 5-piece effects), so pick the set you want to run here. Sets count distinct echoes: two copies of one echo count once.'
          >
            <Stack gap='sm'>
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
              {COSTS.map((cost) => (
                <MultiSelect
                  key={cost}
                  label={`${cost}-cost main stat`}
                  placeholder={mainStats[cost]?.length ? undefined : 'Any'}
                  value={mainStats[cost] ?? []}
                  onChange={(value) => setMainStats((prev) => ({ ...prev, [cost]: value as StatKey[] }))}
                  data={(Object.keys(MAIN_STAT_MAX[cost]) as StatKey[]).map((stat) => ({ value: stat, label: statLabel(stat) }))}
                />
              ))}
              <Switch
                label='Leave out echoes other Resonators are wearing'
                checked={excludeEquippedByOthers}
                onChange={(event) => setExcludeEquippedByOthers(event.currentTarget.checked)}
              />
            </Stack>
          </Panel>

          <Accordion variant='separated' radius='md'>
            <Accordion.Item value='min'>
              <Accordion.Control>
                <Text size='sm' fw={600}>Minimum stats</Text>
                <Text size='xs' c='dimmed'>{`${Object.values(minStats).filter((v) => v !== undefined).length} set`}</Text>
              </Accordion.Control>
              <Accordion.Panel>
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
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          <div className={classes.stickyActions}>
            <Group gap='xs' grow>
              <Button size='sm' leftSection={<IconSearch size={16} />} onClick={run} loading={running}>Search</Button>
              {running && <Button size='sm' variant='default' onClick={cancel}>Cancel</Button>}
            </Group>
            <Text size='xs' c='dimmed' ta='center' mt={6}>{`${formatNumber(echoes.length)} echoes`}</Text>
          </div>
        </Stack>

        <Stack gap='md'>
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
      </div>
    </Stack>
  )
}
