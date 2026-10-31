import {
  Drawer,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import {
  type EquipBehavior,
  useGameSettings,
  writeGameSettings,
} from 'lib/games/shared/gameSettings'

// A game's Settings, after HSR's Settings drawer (lib/overlays/drawers/SettingsDrawer.tsx): a right-side drawer opened
// from the sidebar's Settings entry, each setting a labelled select with the default marked "Default:"
export function GameSettingsDrawer({ game, gearNoun, opened, onClose }: {
  game: string,
  // 'discs', 'artifacts', 'echoes'
  gearNoun: string,
  opened: boolean,
  onClose: () => void,
}) {
  const settings = useGameSettings(game)
  return (
    <Drawer opened={opened} onClose={onClose} position='right' title='Settings' size='md'>
      <Stack gap='lg'>
        <Select
          label={`Equipping ${gearNoun} from another character`}
          allowDeselect={false}
          value={settings.equipBehavior}
          onChange={(value) => value && writeGameSettings(game, { equipBehavior: value as EquipBehavior })}
          data={[
            { value: 'replace', label: `Default: Replace ${gearNoun} without swapping` },
            { value: 'swap', label: `Swap ${gearNoun} with the previous owner` },
          ]}
        />
        <Text size='xs' c='dimmed'>
          {`Used by the optimizer's Equip, saved builds and the editor's Equipped by. Replace leaves the other character's slot empty; swap gives them this character's old piece${
            game === 'wuwa' ? ' (an echo of the same cost, when there is one)' : ''
          }. Settings are kept in this browser and in backups.`}
        </Text>
      </Stack>
    </Drawer>
  )
}
