import {
  Button,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
} from '@mantine/core'
import {
  IconArrowBarToUp,
  IconArrowsExchange,
  IconChevronDown,
  IconDeviceFloppy,
  IconEdit,
  IconFolderOpen,
  IconPlugConnectedX,
  IconScale,
  IconSortDescending,
  IconTrash,
  IconUser,
} from '@tabler/icons-react'
import type { GearOption } from 'lib/games/shared/gear/gearKind'
import { confirmAction } from 'lib/games/shared/ui/confirm'
import {
  type SwitchGearModalConfig,
  useSwitchGearModalStore,
} from 'lib/games/shared/ui/gameModalStores'
import { CharacterMenuSlot } from 'lib/games/shared/ui/Showcase'
import { Message } from 'lib/interactions/message'
import { useState } from 'react'

// The Characters page's Character menu, after HSR's (lib/tabs/tabCharacters/CharacterMenu.tsx): Character (edit,
// switch gear with, unequip, delete), Builds (save the current build, view saved ones) and Scoring. Each game passes
// what its save can do; confirmations and messages follow HSR's wording.
export function CharacterMenu(
  { name, gearNoun, others, onEdit, onSwitch, onUnequip, onDelete, onSaveBuild, onViewBuilds, savedCount, onScoring, onMoveToTop, onSortByScore }: {
    name: string,
    // 'discs', 'artifacts', 'echoes'
    gearNoun: string,
    // Who this character can switch gear with
    others: GearOption[],
    onEdit: () => void,
    onSwitch: (otherId: string) => void,
    onUnequip: () => void,
    onDelete: () => void,
    // Undefined when nothing is worn
    onSaveBuild?: () => void,
    onViewBuilds: () => void,
    savedCount: number,
    onScoring?: () => void,
    // HSR's Priority group (shared/characterPriority.ts)
    onMoveToTop?: () => void,
    onSortByScore?: () => void,
  },
) {
  return (
    // At the top of the roster column, like HSR's (shared/ui/Showcase.tsx CharacterMenuSlot)
    <CharacterMenuSlot>
      <Menu position='bottom-start' withinPortal width={260}>
        <Menu.Target>
          <Button fullWidth variant='default' leftSection={<IconUser size={16} />} rightSection={<IconChevronDown size={14} />}>Character menu</Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Character</Menu.Label>
          <Menu.Item leftSection={<IconEdit size={14} />} onClick={onEdit}>Edit character</Menu.Item>
          <Menu.Item
            leftSection={<IconArrowsExchange size={14} />}
            disabled={others.length === 0}
            onClick={() => openSwitchModal({ name, gearNoun, others, onSwitch })}
          >
            {`Switch ${gearNoun} with`}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconPlugConnectedX size={14} />}
            onClick={async () => {
              if (
                !await confirmAction('Unequip character', `Are you sure you want to unequip ${name}? Their ${gearNoun} stay in the save, unequipped.`, {
                  confirmLabel: 'Unequip',
                })
              ) return
              onUnequip()
              Message.success(`Unequipped ${name}`)
            }}
          >
            Unequip character
          </Menu.Item>
          <Menu.Item
            color='red'
            leftSection={<IconTrash size={14} />}
            onClick={async () => {
              if (
                !await confirmAction('Delete character', `Are you sure you want to delete ${name}? Their ${gearNoun} stay in the save, unequipped.`, {
                  danger: true,
                  confirmLabel: 'Delete',
                })
              ) return
              onDelete()
              Message.success(`Deleted ${name}`)
            }}
          >
            Delete character
          </Menu.Item>

          <Menu.Label>Builds</Menu.Label>
          <Menu.Item leftSection={<IconDeviceFloppy size={14} />} disabled={!onSaveBuild} onClick={onSaveBuild}>Save current build</Menu.Item>
          <Menu.Item leftSection={<IconFolderOpen size={14} />} onClick={onViewBuilds}>
            {savedCount ? `View saved builds (${savedCount})` : 'View saved builds'}
          </Menu.Item>

          {onScoring && (
            <>
              <Menu.Label>Scoring</Menu.Label>
              <Menu.Item leftSection={<IconScale size={14} />} onClick={onScoring}>Scoring weights</Menu.Item>
            </>
          )}

          {(onMoveToTop || onSortByScore) && (
            <>
              <Menu.Label>Priority</Menu.Label>
              {onSortByScore && (
                <Menu.Item
                  leftSection={<IconSortDescending size={14} />}
                  onClick={async () => {
                    const ok = await confirmAction(
                      'Sort by effective substats',
                      'Rank every saved character by their gear score, best first? The optimizer\'s priority filter follows this order.',
                      { confirmLabel: 'Sort' },
                    )
                    if (!ok) return
                    onSortByScore()
                    Message.success('Sorted by effective substats')
                  }}
                >
                  Sort by effective substats
                </Menu.Item>
              )}
              {onMoveToTop && (
                <Menu.Item
                  leftSection={<IconArrowBarToUp size={14} />}
                  onClick={() => {
                    onMoveToTop()
                    Message.success(`Moved ${name} to the top`)
                  }}
                >
                  Move character to top
                </Menu.Item>
              )}
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </CharacterMenuSlot>
  )
}

function openSwitchModal(config: SwitchGearModalConfig) {
  useSwitchGearModalStore.getState().openOverlay(config)
}

// Mounted once by GameModals
export function SwitchGearModal() {
  const open = useSwitchGearModalStore((s) => s.open)
  const config = useSwitchGearModalStore((s) => s.config)
  const close = useSwitchGearModalStore((s) => s.closeOverlay)
  return (
    <Modal opened={open} onClose={close} title={config ? `Switch ${config.gearNoun} with` : ''} centered>
      {open && config && (
        <SwitchForm
          name={config.name}
          others={config.others}
          onSwitch={(otherId) => {
            close()
            config.onSwitch(otherId)
            Message.success(`Switched ${config.gearNoun} with ${config.others.find((o) => o.value === otherId)?.label ?? otherId}`)
          }}
          onCancel={close}
        />
      )}
    </Modal>
  )
}

function SwitchForm({ name, others, onSwitch, onCancel }: { name: string, others: GearOption[], onSwitch: (otherId: string) => void, onCancel: () => void }) {
  const [other, setOther] = useState<string | null>(null)
  return (
    <Stack gap='sm'>
      <Select
        label={`Swap all of ${name}'s gear with`}
        searchable
        placeholder='Pick a character'
        value={other}
        onChange={setOther}
        data={others}
        data-autofocus
      />
      <Group justify='flex-end' gap='xs'>
        <Button variant='default' onClick={onCancel}>Cancel</Button>
        <Button disabled={!other} onClick={() => other && onSwitch(other)}>Switch</Button>
      </Group>
    </Stack>
  )
}
