import {
  ActionIcon,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import {
  newSimulation,
  type StatSimulation,
} from 'lib/games/shared/statSimulation'
import { CommittedNumberInput } from 'lib/games/shared/ui/CommittedNumberInput'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'

// HSR's stat simulation (lib/tabs/tabOptimizer/optimizerForm/components/StatSimulationDisplay.tsx, substat roll count
// mode) as a card: each simulated build keeps a real build's sets and main stats, with the substat rolls typed here
// (shared/statSimulation.ts). The page works out each one's score and puts it in the results grid under Now

export function StatSimulationCard({ simulations, onChange, substats, picked, describe, scoreOf }: {
  simulations: StatSimulation[],
  onChange: (next: StatSimulation[]) => void,
  substats: { key: string, label: string }[],
  // The picked result, to start a simulation from: its pieces and their substats as rolls
  picked?: { label: string, pieceIds: string[], rolls: Record<string, number> },
  // The sets and main stats the simulation keeps, or undefined when some of its pieces are no longer in the save
  describe: (simulation: StatSimulation) => string | undefined,
  // Its score as the page ranks builds
  scoreOf: (simulation: StatSimulation) => string | undefined,
}) {
  const change = (id: string, patch: Partial<StatSimulation>) => onChange(simulations.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  return (
    <FormCard
      title='Simulated builds'
      size='wide'
      description='A build with the sets and main stats of a real one, and the substat rolls you type in (average rolls). They show in the results under Now.'
    >
      <Stack gap='sm'>
        <Group gap='xs'>
          <Button
            size='xs'
            variant='light'
            disabled={!picked}
            onClick={() => picked && onChange([...simulations, newSimulation(`Sim ${simulations.length + 1}`, picked.pieceIds, picked.rolls)])}
          >
            {picked ? `Add ${picked.label}` : 'Add the picked build'}
          </Button>
          {!picked && <Text size='xs' c='dimmed'>Run a search and pick a build to start from</Text>}
        </Group>
        {simulations.map((simulation) => {
          const sets = describe(simulation)
          const score = sets ? scoreOf(simulation) : undefined
          const total = Object.values(simulation.rolls).reduce((sum, n) => sum + n, 0)
          return (
            <Paper key={simulation.id} withBorder p='xs' radius='sm'>
              <Stack gap={6}>
                <Group gap='xs' wrap='nowrap'>
                  <TextInput
                    size='xs'
                    aria-label='Simulation name'
                    value={simulation.name}
                    onChange={(e) => change(simulation.id, { name: e.currentTarget.value })}
                    style={{ flex: 1 }}
                  />
                  {score && <Text size='sm' fw={600}>{score}</Text>}
                  <ActionIcon
                    variant='subtle'
                    color='red'
                    aria-label={`Delete ${simulation.name}`}
                    onClick={() => onChange(simulations.filter((s) => s.id !== simulation.id))}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
                <Text size='xs' c={sets ? 'dimmed' : 'yellow'}>
                  {sets ? `${sets} · ${Math.round(total * 10) / 10} rolls` : 'Some of its pieces are no longer in the save'}
                </Text>
                <SimpleGrid cols={4} spacing={6} verticalSpacing={4}>
                  {substats.map((stat) => (
                    <CommittedNumberInput
                      key={stat.key}
                      size='xs'
                      label={stat.label}
                      hideControls
                      min={0}
                      max={60}
                      decimalScale={1}
                      placeholder='0'
                      value={simulation.rolls[stat.key] ?? ''}
                      onChange={(value) => {
                        const rolls = { ...simulation.rolls }
                        if (typeof value === 'number' && value > 0) rolls[stat.key] = value
                        else delete rolls[stat.key]
                        change(simulation.id, { rolls })
                      }}
                    />
                  ))}
                </SimpleGrid>
              </Stack>
            </Paper>
          )
        })}
      </Stack>
    </FormCard>
  )
}
