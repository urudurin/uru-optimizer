import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { todayString } from 'lib/games/shared/importedPresets'
import {
  deleteSavedBuild,
  saveBuild,
  type SavedBuild,
  savedBuilds,
} from 'lib/games/shared/savedBuilds'
import { confirmAction } from 'lib/games/shared/ui/confirm'
import {
  type SaveBuildModalConfig,
  type SavedBuildsModalConfig,
  useSaveBuildModalStore,
  useSavedBuildsModalStore,
} from 'lib/games/shared/ui/gameModalStores'
import { Message } from 'lib/interactions/message'
import {
  useMemo,
  useReducer,
  useState,
} from 'react'

// The dialogs behind the sidebar's Builds group, after HSR's SaveBuildModal (name the picked build) and BuildsModal
// (the character's saved builds, to equip or delete). Each has an overlay store (gameModalStores.ts) and is mounted once
// by GameModals, like HSR's.

export function openSaveBuildModal(config: SaveBuildModalConfig) {
  useSaveBuildModalStore.getState().openOverlay(config)
}

export function SaveBuildModal() {
  const open = useSaveBuildModalStore((s) => s.open)
  const config = useSaveBuildModalStore((s) => s.config)
  const close = useSaveBuildModalStore((s) => s.closeOverlay)
  return (
    <Modal opened={open} onClose={close} title='Save build' centered>
      {open && config && (
        <SaveBuildForm
          defaultName={config.defaultName}
          onSave={(name) => {
            config.onSave(name)
            close()
          }}
          onCancel={close}
        />
      )}
    </Modal>
  )
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

export function openSavedBuildsModal(config: SavedBuildsModalConfig) {
  useSavedBuildsModalStore.getState().openOverlay(config)
}

export function SavedBuildsModal() {
  const open = useSavedBuildsModalStore((s) => s.open)
  const config = useSavedBuildsModalStore((s) => s.config)
  const close = useSavedBuildsModalStore((s) => s.closeOverlay)
  return (
    <Modal opened={open} onClose={close} title={config ? `${config.name}'s saved builds` : ''} centered size='lg'>
      {open && config && (
        <SavedBuildsList
          initial={config.builds}
          describe={config.describe}
          onEquip={(build) => {
            close()
            config.onEquip(build)
          }}
          onDelete={config.onDelete}
        />
      )}
    </Modal>
  )
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

// A character's saved builds with Save and View wired up, for the Characters pages' Character menu
export function useSavedBuilds(game: string, characterId: string) {
  const [version, bump] = useReducer((n: number) => n + 1, 0)
  const saved = useMemo(() => (version >= 0 ? savedBuilds(game, characterId) : []), [game, characterId, version])
  return {
    saved,
    save: (pieceIds: string[]) =>
      openSaveBuildModal({
        defaultName: `Build ${saved.length + 1}`,
        onSave: (name) => {
          saveBuild(game, characterId, name, pieceIds, todayString(new Date()))
          bump()
          Message.success(`Saved build ${name}`)
        },
      }),
    view: ({ name, describe, equip }: { name: string, describe: (build: SavedBuild) => string, equip: (build: SavedBuild) => void }) =>
      openSavedBuildsModal({
        name,
        builds: saved,
        describe,
        onEquip: async (build) => {
          if (!await confirmAction('Equip saved build', `Equip ${build.name} on ${name} in this browser's save?`, { confirmLabel: 'Equip' })) return
          equip(build)
          Message.success('Equipped')
        },
        onDelete: (build) => {
          const left = deleteSavedBuild(game, characterId, build.name)
          bump()
          return left
        },
      }),
  }
}

// A saved build in a line: its pieces by set ('2 Gladiator's Finale + 2 …'), and how many are no longer in the save
export function describeSavedPieces(setNames: string[], saved: number): string {
  const counts = new Map<string, number>()
  for (const set of setNames) counts.set(set, (counts.get(set) ?? 0) + 1)
  const sets = [...counts].sort((a, b) => b[1] - a[1]).map(([set, n]) => `${n} ${set}`).join(' + ')
  const missing = saved - setNames.length
  return `${sets || 'No pieces'}${missing > 0 ? ` · ${missing} no longer in the save` : ''}`
}
