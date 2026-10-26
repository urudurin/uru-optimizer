import {
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { IconCards } from '@tabler/icons-react'
import {
  EmptyState,
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import { AGENTS } from 'lib/games/zzz/data/agents'
import { useZzzGameData } from 'lib/games/zzz/data/enkaGameData'
import { useZzzStore } from 'lib/games/zzz/state/zzzStore'
import {
  scoreDisc,
  zzzDiscWeights,
} from 'lib/games/zzz/stats/discScore'
import type { Disc } from 'lib/games/zzz/types'
import { DiscCard } from 'lib/games/zzz/ui/DiscCard'
import {
  useMemo,
  useState,
} from 'react'

const SLOT_FILTERS = ['all', '1', '2', '3', '4', '5', '6']

export function ZzzDiscsPage({ onImport }: { onImport: () => void }) {
  const discs = useZzzStore((s) => s.discs)
  const builds = useZzzStore((s) => s.builds)
  useZzzGameData()
  const [slot, setSlot] = useState('all')
  const [setId, setSetId] = useState<string | null>(null)

  const ownerNames = useMemo(() => new Map(builds.map((b) => [b.agentId, b.name])), [builds])
  // Each disc is scored for the agent wearing it
  const scoreFor = (disc: Disc) => {
    const agent = disc.equippedBy ? AGENTS[disc.equippedBy] : undefined
    return agent ? scoreDisc(disc, zzzDiscWeights(agent)) : undefined
  }
  const setOptions = useMemo(() => {
    const names = new Map(discs.map((d) => [d.setId, d.setName]))
    return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [discs])

  const shown = useMemo(
    () =>
      discs
        .filter((d) => (slot === 'all' || d.slot === Number(slot)) && (!setId || d.setId === setId))
        .sort((a, b) => a.slot - b.slot || a.setName.localeCompare(b.setName)),
    [discs, slot, setId],
  )

  if (discs.length === 0) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Discs' />
        <Panel>
          <EmptyState icon={<IconCards size={24} />} title='No discs yet' action={<Button onClick={onImport}>Import discs</Button>}>
            Import a builds export to see every disc you own, with its set, main stat and substat rolls.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  return (
    <Stack gap='lg'>
      <PageHeader title='Discs' description={`${discs.length} discs. Dots show how many times each substat rolled.`} />

      <Group gap='sm' align='flex-end'>
        <SegmentedControl
          value={slot}
          onChange={setSlot}
          data={SLOT_FILTERS.map((value) => ({ value, label: value === 'all' ? 'All slots' : `Slot ${value}` }))}
        />
        <Select w={220} placeholder='Any set' clearable value={setId} onChange={setSetId} data={setOptions} />
        <Text size='xs' c='dimmed'>{`Showing ${shown.length}`}</Text>
      </Group>

      <div className={gear.grid}>
        {shown.map((disc) => (
          <DiscCard
            key={disc.id}
            disc={disc}
            owner={disc.equippedBy ? ownerNames.get(disc.equippedBy) : undefined}
            score={scoreFor(disc)}
          />
        ))}
      </div>
    </Stack>
  )
}
