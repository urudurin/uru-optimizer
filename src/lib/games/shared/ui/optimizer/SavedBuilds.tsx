import {
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import type { SavedBuild } from 'lib/games/shared/savedBuilds'
import { useState } from 'react'

// The dialogs behind the sidebar's Builds group, after HSR's SaveBuildModal (name the picked build) and BuildsModal
// (the character's saved builds, to equip or delete). Opened imperatively through Mantine modals, like HSR's.

export function openSaveBuildModal({ defaultName, onSave }: { defaultName: string, onSave: (name: string) => void }) {
  const id = modals.open({
    title: 'Save build',
    centered: true,
    children: (
      <SaveBuildForm
        defaultName={defaultName}
        onSave={(name) => {
          onSave(name)
          modals.close(id)
        }}
        onCancel={() => modals.close(id)}
      />
    ),
  })
}

function SaveBuildForm({ defaultName, onSave, onCancel }: { defaultName: string, onSave: (name: string) => void, onCancel: () => void }) {
  const [name, setName] = useState(defaultName)
  const trimmed = name.trim()
  return (
    <Stack gap='sm'>
      <TextInput
        label='Build name'
        description='A build with the same name is replaced.'
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && trimmed) onSave(trimmed)
        }}
        data-autofocus
      />
      <Group justify='flex-end' gap='xs'>
        <Button variant='default' onClick={onCancel}>Cancel</Button>
        <Button disabled={!trimmed} onClick={() => onSave(trimmed)}>Save</Button>
      </Group>
    </Stack>
  )
}

export function openSavedBuildsModal({ name, builds, describe, onEquip, onDelete }: {
  // Whose builds, for the title
  name: string,
  builds: SavedBuild[],
  // A line about a build: its sets, and pieces no longer in the save
  describe: (build: SavedBuild) => string,
  onEquip: (build: SavedBuild) => void,
  // Deletes it and returns the builds left
  onDelete: (build: SavedBuild) => SavedBuild[],
}) {
  const id = modals.open({
    title: `${name}'s saved builds`,
    centered: true,
    size: 'lg',
    children: (
      <SavedBuildsList
        initial={builds}
        describe={describe}
        onEquip={(build) => {
          modals.close(id)
          onEquip(build)
        }}
        onDelete={onDelete}
      />
    ),
  })
}

function SavedBuildsList({ initial, describe, onEquip, onDelete }: {
  initial: SavedBuild[],
  describe: (build: SavedBuild) => string,
  onEquip: (build: SavedBuild) => void,
  onDelete: (build: SavedBuild) => SavedBuild[],
}) {
  const [builds, setBuilds] = useState(initial)
  if (builds.length === 0) return <Text size='sm' c='dimmed'>No saved builds yet. Pick a result and press Save in the sidebar's Builds group.</Text>
  return (
    <Stack gap='sm'>
      {builds.map((build) => (
        <Group key={build.name} justify='space-between' wrap='nowrap' gap='sm'>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text size='sm' fw={600}>{build.name}</Text>
            <Text size='xs' c='dimmed'>{`${describe(build)} · saved ${build.savedAt}`}</Text>
          </Stack>
          <Group gap='xs' wrap='nowrap'>
            <Button size='xs' onClick={() => onEquip(build)}>Equip</Button>
            <Button size='xs' variant='light' color='red' onClick={() => setBuilds(onDelete(build))}>Delete</Button>
          </Group>
        </Group>
      ))}
    </Stack>
  )
}
