import {
  Drawer,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import {
  type AnalysisPosition,
  type EquipBehavior,
  useGameSettings,
  writeGameSettings,
} from 'lib/games/shared/gameSettings'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation('games', { keyPrefix: 'Settings' })
  const { t: tGear } = useTranslation('games', { keyPrefix: 'Gear' })
  const gear = tGear(gearNoun as never)
  return (
    <Drawer opened={opened} onClose={onClose} position='right' title={t('Title')} size='md'>
      <Stack gap='lg'>
        <Select
          label={t('EquipBehavior.Label', { gear })}
          allowDeselect={false}
          value={settings.equipBehavior}
          onChange={(value) => value && writeGameSettings(game, { equipBehavior: value as EquipBehavior })}
          data={[
            { value: 'replace', label: t('EquipBehavior.Replace', { gear }) },
            { value: 'swap', label: t('EquipBehavior.Swap', { gear }) },
          ]}
        />
        <Text size='xs' c='dimmed'>{game === 'wuwa' ? t('EquipBehavior.HelpWuwa') : t('EquipBehavior.Help')}</Text>
        <Select
          label={t('AnalysisPosition.Label')}
          allowDeselect={false}
          value={settings.analysisPosition}
          onChange={(value) => value && writeGameSettings(game, { analysisPosition: value as AnalysisPosition })}
          data={[
            { value: 'below', label: t('AnalysisPosition.Below') },
            { value: 'above', label: t('AnalysisPosition.Above') },
          ]}
        />
        <Text size='xs' c='dimmed'>{t('Kept')}</Text>
      </Stack>
    </Drawer>
  )
}
