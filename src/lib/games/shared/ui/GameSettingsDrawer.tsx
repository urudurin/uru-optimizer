import {
  Drawer,
  Flex,
  Text,
} from '@mantine/core'
import {
  type GameSettings,
  useGameSettings,
  writeGameSettings,
} from 'lib/games/shared/gameSettings'
import { SettingRow } from 'lib/overlays/drawers/SettingsDrawer'
import { useTranslation } from 'react-i18next'

type SettingOption = {
  key: keyof GameSettings,
  label: string,
  help?: string,
  options: { value: string, label: string }[],
}

// A game's Settings, after HSR's Settings drawer (lib/overlays/drawers/SettingsDrawer.tsx): a right-side drawer opened
// from the sidebar's Settings entry, every setting one of HSR's SettingRows from the options list below
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
  const options: SettingOption[] = [
    {
      key: 'equipBehavior',
      label: t('EquipBehavior.Label', { gear }),
      help: game === 'wuwa' ? t('EquipBehavior.HelpWuwa') : t('EquipBehavior.Help'),
      options: [
        { value: 'replace', label: t('EquipBehavior.Replace', { gear }) },
        { value: 'swap', label: t('EquipBehavior.Swap', { gear }) },
      ],
    },
    {
      key: 'analysisPosition',
      label: t('AnalysisPosition.Label'),
      options: [
        { value: 'below', label: t('AnalysisPosition.Below') },
        { value: 'above', label: t('AnalysisPosition.Above') },
      ],
    },
  ]
  return (
    <Drawer opened={opened} onClose={onClose} position='right' title={t('Title')} size={900}>
      <Flex direction='column' gap={10}>
        {options.map((option) => (
          <div key={option.key}>
            <SettingRow
              label={option.label}
              data={option.options}
              allowDeselect={false}
              value={settings[option.key]}
              onChange={(value) => value && writeGameSettings(game, { [option.key]: value } as Partial<GameSettings>)}
            />
            {option.help && <Text size='xs' c='dimmed' mt={4}>{option.help}</Text>}
          </div>
        ))}
        <Text size='xs' c='dimmed' mt='sm'>{t('Kept')}</Text>
      </Flex>
    </Drawer>
  )
}
