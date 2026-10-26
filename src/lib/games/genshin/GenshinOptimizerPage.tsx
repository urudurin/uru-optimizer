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
import { genshinPiecesTaken } from 'lib/games/genshin/state/genshinState'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import { hasStatData } from 'lib/games/genshin/stats/computeStats'
import {
  type Artifact,
  ARTIFACT_SLOTS,
  ELEMENT_DMG_STAT,
  formatStatValue,
  type GenshinCharacter,
  type GenshinStatKey,
  SLOT_LABELS,
  statLabel,
} from 'lib/games/genshin/types'
import { ArtifactCard } from 'lib/games/genshin/ui/ArtifactCard'
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

// Targets as Select values
const TARGETS: { value: string, target: OptimizerTarget }[] = [
  { value: 'avg:atk', target: { kind: 'averageHit', stat: 'atk' } },
  { value: 'avg:hp', target: { kind: 'averageHit', stat: 'hp' } },
  { value: 'avg:def', target: { kind: 'averageHit', stat: 'def' } },
  { value: 'avg:elementalMastery', target: { kind: 'averageHit', stat: 'elementalMastery' } },
  { value: 'cv', target: { kind: 'critValue' } },
  ...SHOWN_STATS.map((stat) => ({ value: `stat:${stat}`, target: { kind: 'stat', stat } as OptimizerTarget })),
  ...(['pyroDmg', 'hydroDmg', 'anemoDmg', 'electroDmg', 'dendroDmg', 'cryoDmg', 'geoDmg', 'physicalDmg', 'healingBonus'] as GenshinStatKey[])
    .map((stat) => ({ value: `stat:${stat}`, target: { kind: 'stat', stat } as OptimizerTarget })),
]

const RESULT_LIMIT = 10

function formatScore(target: OptimizerTarget, score: number): string {
  if (target.kind === 'stat') return formatStatValue(target.stat, score)
  return target.kind === 'critValue' ? score.toFixed(1) : formatNumber(Math.round(score))
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

export function GenshinOptimizerPage({ onImport }: { onImport: () => void }) {
  const artifacts = useGenshinStore((s) => s.artifacts)
  const characters = useGenshinStore((s) => s.characters)
  const usable = useMemo(() => characters.filter(hasStatData), [characters])
  const [characterId, setCharacterId] = useState<string | null>(null)
  const character = usable.find((c) => c.id === characterId) ?? usable[0]

  const [targetValue, setTargetValue] = useState('avg:atk')
  const [mainStats, setMainStats] = useState<Partial<Record<MainStatSlot, GenshinStatKey[]>>>({})
  const [fourPieceSet, setFourPieceSet] = useState<string | null>(null)
  const [twoPieceSets, setTwoPieceSets] = useState<string[]>([])
  const [excludeEquippedByOthers, setExcludeEquippedByOthers] = useState(true)
  const [minStats, setMinStats] = useState<Partial<Record<GenshinStatKey, number>>>({})
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

  const target = TARGETS.find((t) => t.value === targetValue)?.target ?? TARGETS[0].target

  async function run() {
    setRunning(true)
    setProgress(undefined)
    const response = await runOptimizer({ character, artifacts, filters, minStats, target, limit: RESULT_LIMIT }, setProgress)
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
  const setName = (id: string) => setOptions.find((o) => o.value === id)?.label ?? id
  const mainFilters = MAIN_STAT_SLOTS.filter((slot) => mainStats[slot]?.length).length
  const minCount = Object.values(minStats).filter((v) => v !== undefined).length
  const filterSummary = [
    fourPieceSet ? `4pc ${setName(fourPieceSet)}` : twoPieceSets.length ? twoPieceSets.map((id) => `2pc ${setName(id)}`).join(' + ') : 'Any sets',
    mainFilters ? `${mainFilters} main stat filter${mainFilters === 1 ? '' : 's'}` : 'any main stats',
    minCount ? `${minCount} minimum${minCount === 1 ? '' : 's'}` : 'no minimums',
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
        description='Searches your artifacts for the 5-piece builds that score highest, with stats worked out like the Characters page. There is no full damage calculation: the average hit is the scaling stat times the crit multiplier, so set minimums (such as Energy Recharge) for anything else the character needs.'
      />

      <div className={classes.optimizerLayout}>
        <Stack gap='md'>
          <FormRows>
            <FormRow id='genshin-character' title='Character' summary={`${character.name} · ${targetLabel(target)}`}>
              <FormCard title='Character'>
                <Select
                  aria-label='Character'
                  searchable
                  allowDeselect={false}
                  value={character.id}
                  onChange={(value) => {
                    setCharacterId(value)
                    setResult(undefined)
                  }}
                  data={usable.map((c) => ({ value: c.id, label: c.name }))}
                />
                <Text size='xs' c='dimmed'>
                  {`Level ${character.level} · C${character.constellation} · ${
                    character.weapon ? `${character.weapon.name} R${character.weapon.refinement}, level ${character.weapon.level}` : 'No weapon'
                  }`}
                </Text>
              </FormCard>
              <FormCard title='Rank by' description='The average hit is the scaling stat times the crit multiplier, there is no full damage calculation.'>
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
                  label='Leave out artifacts other characters are wearing'
                  checked={excludeEquippedByOthers}
                  onChange={(event) => setExcludeEquippedByOthers(event.currentTarget.checked)}
                />
              </FormCard>
            </FormRow>

            <FormRow id='genshin-filters' title='Artifact filters' summary={filterSummary}>
              <FormCard
                title='Sets'
                description='Only 2-piece bonuses the character screen shows are counted, not 4-piece effects, so pick the set you want to run here.'
              >
                <Select
                  label='4-piece set'
                  placeholder='Any'
                  searchable
                  clearable
                  value={fourPieceSet}
                  onChange={(value) => {
                    setFourPieceSet(value)
                    if (value) setTwoPieceSets([])
                  }}
                  data={setOptions}
                />
                <MultiSelect
                  label='2-piece sets'
                  placeholder={fourPieceSet ? 'Not with a 4-piece set' : twoPieceSets.length ? undefined : 'Any'}
                  searchable
                  disabled={!!fourPieceSet}
                  maxValues={2}
                  value={twoPieceSets}
                  onChange={setTwoPieceSets}
                  data={setOptions}
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
              <FormCard title='Minimum stats' size='wide' description='Builds below any of these are left out, e.g. Energy Recharge 200.'>
                <SimpleGrid cols={2} spacing='sm'>
                  {MIN_STATS.map((stat) => (
                    <NumberInput
                      key={stat}
                      label={statLabel(stat)}
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
                    <Table.ScrollContainer minWidth={640} mah={420}>
                      <Table highlightOnHover verticalSpacing={6} stickyHeader>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>#</Table.Th>
                            <Table.Th ta='right' c='var(--primary-light)'>{targetLabel(result.target)}</Table.Th>
                            {shown.map((stat) => <Table.Th key={stat} ta='right'>{statLabel(stat)}</Table.Th>)}
                            <Table.Th>Sets</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {current && (
                            <Table.Tr>
                              <Table.Td c='dimmed'>Now</Table.Td>
                              <Table.Td ta='right' c='dimmed'>{formatScore(result.target, current.score)}</Table.Td>
                              {shown.map((stat) => <Table.Td key={stat} ta='right' c='dimmed'>{formatStatValue(stat, current.stats[stat] ?? 0)}</Table.Td>)}
                              <Table.Td c='dimmed'>
                                <Text size='xs' lineClamp={1}>{describeSets(current.artifacts)}</Text>
                              </Table.Td>
                            </Table.Tr>
                          )}
                          {outcome.builds.map((b, i) => (
                            <Table.Tr
                              key={b.artifacts.map((a) => a.id).join()}
                              className={classes.resultRow}
                              data-active={i === selected || undefined}
                              onClick={() => setSelected(i)}
                            >
                              <Table.Td c='dimmed'>{i + 1}</Table.Td>
                              <Table.Td ta='right' fw={600}>{formatScore(result.target, b.score)}</Table.Td>
                              {shown.map((stat) => <Table.Td key={stat} ta='right'>{formatStatValue(stat, b.stats[stat] ?? 0)}</Table.Td>)}
                              <Table.Td>
                                <Text size='xs' lineClamp={1}>{describeSets(b.artifacts)}</Text>
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
              title={`Build #${selected + 1}`}
              description={`${describeSets(build.artifacts)}${
                current ? ` · ${build.score >= current.score ? '+' : ''}${(((build.score / current.score) - 1) * 100).toFixed(1)}% vs current` : ''
              }`}
            >
              <Stack gap='md'>
                <StatGrid
                  stats={shown.map((stat) => {
                    const diff = current ? (build.stats[stat] ?? 0) - (current.stats[stat] ?? 0) : 0
                    const change = current && Math.abs(diff) >= 0.05 ? ` (${diff > 0 ? '+' : '-'}${formatStatValue(stat, Math.abs(diff))})` : ''
                    return { key: stat, label: statLabel(stat), value: `${formatStatValue(stat, build.stats[stat] ?? 0)}${change}` }
                  })}
                />
                <div className={gear.grid}>
                  {build.artifacts.map((artifact) => (
                    <ArtifactCard
                      key={artifact.id}
                      artifact={artifact}
                      owner={artifact.equippedBy ? (ownerNames.get(artifact.equippedBy) ?? artifact.equippedBy) : undefined}
                    />
                  ))}
                </div>
              </Stack>
            </Panel>
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
