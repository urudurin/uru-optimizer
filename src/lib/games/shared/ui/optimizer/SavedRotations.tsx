import {
  ActionIcon,
  Button,
  Group,
  Popover,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import {
  deleteRotation,
  savedRotations,
  saveRotation,
} from 'lib/games/shared/savedRotations'
import {
  useEffect,
  useState,
} from 'react'

// "Saved" next to the Rotation card's Default and Clear buttons: save the rotation under a name, load or delete saved
// ones (shared/savedRotations.ts). Shared by the ZZZ, Genshin and WuWa Rotation cards
export function SavedRotations<R>({ game, characterId, rotation, onLoad }: {
  game: string,
  characterId: string,
  rotation: R,
  onLoad: (rotation: R) => void,
}) {
  const [opened, setOpened] = useState(false)
  const [list, setList] = useState(() => savedRotations<R>(game, characterId))
  const [name, setName] = useState('')
  useEffect(() => setList(savedRotations<R>(game, characterId)), [game, characterId])

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setList(saveRotation(game, characterId, trimmed, rotation))
    setName('')
  }

  return (
    <Popover opened={opened} onChange={setOpened} position='bottom-start' width={260} shadow='md'>
      <Popover.Target>
        <Button size='xs' variant='subtle' onClick={() => setOpened((o) => !o)}>
          {list.length > 0 ? `Saved (${list.length})` : 'Saved'}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap='xs'>
          {list.length === 0
            ? <Text size='xs' c='dimmed'>No saved rotations for this character yet.</Text>
            : list.map((entry) => (
              <Group key={entry.name} gap={4} wrap='nowrap' justify='space-between'>
                <UnstyledButton
                  onClick={() => {
                    onLoad(entry.rotation)
                    setOpened(false)
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                  title='Load this rotation'
                >
                  <Text size='xs' truncate>{entry.name}</Text>
                </UnstyledButton>
                <ActionIcon
                  size='sm'
                  variant='subtle'
                  color='gray'
                  aria-label={`Delete ${entry.name}`}
                  onClick={() => setList(deleteRotation(game, characterId, entry.name))}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ))}
          <Group gap={4} wrap='nowrap' align='flex-end'>
            <TextInput
              size='xs'
              style={{ flex: 1 }}
              label='Save this rotation as'
              placeholder='e.g. Full cycle'
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') save()
              }}
            />
            <Button size='xs' onClick={save} disabled={!name.trim()}>Save</Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
