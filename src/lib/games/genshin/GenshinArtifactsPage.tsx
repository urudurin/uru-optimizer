import {
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { IconCards } from '@tabler/icons-react'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import {
  ARTIFACT_SLOTS,
  SLOT_LABELS,
} from 'lib/games/genshin/types'
import { ArtifactCard } from 'lib/games/genshin/ui/ArtifactCard'
import {
  EmptyState,
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import {
  useMemo,
  useState,
} from 'react'

export function GenshinArtifactsPage({ onImport }: { onImport: () => void }) {
  const artifacts = useGenshinStore((s) => s.artifacts)
  const characters = useGenshinStore((s) => s.characters)
  const [slot, setSlot] = useState('all')
  const [setId, setSetId] = useState<string | null>(null)

  const ownerNames = useMemo(() => new Map(characters.map((c) => [c.id, c.name])), [characters])
  const setOptions = useMemo(() => {
    const names = new Map(artifacts.map((a) => [a.setId, a.setName]))
    return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [artifacts])
  const shown = useMemo(
    () =>
      artifacts
        .filter((a) => (slot === 'all' || a.slot === slot) && (!setId || a.setId === setId))
        .sort((a, b) => ARTIFACT_SLOTS.indexOf(a.slot) - ARTIFACT_SLOTS.indexOf(b.slot) || a.setName.localeCompare(b.setName)),
    [artifacts, slot, setId],
  )

  if (artifacts.length === 0) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Artifacts' />
        <Panel>
          <EmptyState icon={<IconCards size={24} />} title='No artifacts yet' action={<Button onClick={onImport}>Import from Enka</Button>}>
            Import your showcase to see the artifacts your characters wear, with their sets, main stats and substat rolls.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  return (
    <Stack gap='lg'>
      <PageHeader title='Artifacts' description={`${artifacts.length} artifacts. Dots show how many times each substat rolled.`} />

      <Group gap='sm' align='flex-end'>
        <SegmentedControl
          value={slot}
          onChange={setSlot}
          data={[{ value: 'all', label: 'All slots' }, ...ARTIFACT_SLOTS.map((value) => ({ value, label: SLOT_LABELS[value] }))]}
        />
        <Select w={240} placeholder='Any set' clearable value={setId} onChange={setSetId} data={setOptions} />
        <Text size='xs' c='dimmed'>{`Showing ${shown.length}`}</Text>
      </Group>

      <div className={gear.grid}>
        {shown.map((artifact) => (
          <ArtifactCard key={artifact.id} artifact={artifact} owner={artifact.equippedBy ? ownerNames.get(artifact.equippedBy) : undefined} />
        ))}
      </div>
    </Stack>
  )
}
