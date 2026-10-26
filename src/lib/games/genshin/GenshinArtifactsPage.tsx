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
  genshinArtifactWeights,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import {
  type Artifact,
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

// Cards drawn at a time: a full GOOD inventory has well over a thousand
const PAGE_SIZE = 60

export function GenshinArtifactsPage({ onImport }: { onImport: () => void }) {
  const artifacts = useGenshinStore((s) => s.artifacts)
  const characters = useGenshinStore((s) => s.characters)
  const [slot, setSlot] = useState('all')
  const [setId, setSetId] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const ownerNames = useMemo(() => new Map(characters.map((c) => [c.id, c.name])), [characters])
  // Each artifact is scored for the character wearing it; their weights are worked out once, when first needed
  const scoreFor = useMemo(() => {
    const byCharacter = new Map(characters.map((c) => [c.id, c]))
    const byId = new Map(artifacts.map((a) => [a.id, a]))
    const cache = new Map<string, Record<string, number>>()
    return (artifact: Artifact) => {
      const wearer = artifact.equippedBy ? byCharacter.get(artifact.equippedBy) : undefined
      if (!wearer) return undefined
      let weights = cache.get(wearer.id)
      if (!weights) {
        weights = genshinArtifactWeights(wearer, ARTIFACT_SLOTS.flatMap((slot) => byId.get(wearer.artifactIds[slot] ?? '') ?? []))
        cache.set(wearer.id, weights)
      }
      return scoreArtifact(artifact, weights)
    }
  }, [characters, artifacts])
  const setOptions = useMemo(() => {
    const names = new Map(artifacts.map((a) => [a.setId, a.setName]))
    return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [artifacts])
  const shown = useMemo(
    () =>
      artifacts
        .filter((a) => (slot === 'all' || a.slot === slot) && (!setId || a.setId === setId))
        .sort((a, b) => ARTIFACT_SLOTS.indexOf(a.slot) - ARTIFACT_SLOTS.indexOf(b.slot) || a.setName.localeCompare(b.setName) || b.level - a.level),
    [artifacts, slot, setId],
  )

  if (artifacts.length === 0) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Artifacts' />
        <Panel>
          <EmptyState icon={<IconCards size={24} />} title='No artifacts yet' action={<Button onClick={onImport}>Import</Button>}>
            Import a GOOD file for your whole inventory, or your Enka.Network showcase for the artifacts your characters wear.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Artifacts'
        description={`${artifacts.length} artifacts. Dots show how many times each substat rolled (the fewest rolls that reach its value, for GOOD imports).`}
      />

      <Group gap='sm' align='flex-end'>
        <SegmentedControl
          value={slot}
          onChange={(value) => {
            setSlot(value)
            setLimit(PAGE_SIZE)
          }}
          data={[{ value: 'all', label: 'All slots' }, ...ARTIFACT_SLOTS.map((value) => ({ value, label: SLOT_LABELS[value] }))]}
        />
        <Select
          w={240}
          placeholder='Any set'
          clearable
          value={setId}
          onChange={(value) => {
            setSetId(value)
            setLimit(PAGE_SIZE)
          }}
          data={setOptions}
        />
        <Text size='xs' c='dimmed'>{`Showing ${Math.min(limit, shown.length)} of ${shown.length}`}</Text>
      </Group>

      <div className={gear.grid}>
        {shown.slice(0, limit).map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            owner={artifact.equippedBy ? ownerNames.get(artifact.equippedBy) : undefined}
            score={scoreFor(artifact)}
          />
        ))}
      </div>
      {shown.length > limit && (
        <Group justify='center'>
          <Button variant='light' onClick={() => setLimit(limit + PAGE_SIZE * 2)}>{`Show more (${shown.length - limit} left)`}</Button>
        </Group>
      )}
    </Stack>
  )
}
