import {
  Drawer,
  Flex,
  Select,
  type SelectProps,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  DefaultSettingOptions,
  SettingOptions,
} from 'lib/constants/settingsConstants'
import {
  OpenCloseIDs,
  useOpenClose,
} from 'lib/hooks/useOpenClose'
import { SaveState } from 'lib/state/saveState'
import { useGlobalStore } from 'lib/stores/app/appStore'
import {
  clone,
  mergeDefinedValues,
} from 'lib/utils/objectUtils'
import {
  type ReactNode,
  useEffect,
} from 'react'
import { useTranslation } from 'react-i18next'
import { type UserSettings } from 'types/store'

const SelectOptionWordWrap = (props: React.ComponentPropsWithoutRef<'span'>) => <span style={{ whiteSpace: 'wrap', wordBreak: 'break-word' }} {...props} />

// One setting: its label and a select with word-wrapped options (also used by the games' Settings drawer)
export function SettingRow({ label, ...selectProps }: { label: ReactNode } & SelectProps) {
  return (
    <Flex justify='space-between' align='center'>
      <div>{label}</div>
      <Select
        style={{ width: 500 }}
        renderOption={({ option }) => <SelectOptionWordWrap>{option.label}</SelectOptionWordWrap>}
        {...selectProps}
      />
    </Flex>
  )
}

export function SettingsDrawer() {
  const { close: closeSettingsDrawer, isOpen: isOpenSettingsDrawer } = useOpenClose(OpenCloseIDs.SETTINGS_DRAWER)
  const { t } = useTranslation('settings')

  return (
    <Drawer
      title={t('Title')} /* 'Settings' */
      position='right'
      onClose={closeSettingsDrawer}
      opened={isOpenSettingsDrawer}
      size={900}
    >
      {isOpenSettingsDrawer && <SettingsDrawerContent />}
    </Drawer>
  )
}

function SettingsDrawerContent() {
  const setSettingsRef = useGlobalStore((s) => s.setSettings)
  const settings = useGlobalStore((s) => s.settings)
  const { t } = useTranslation('settings')

  const settingsForm = useForm<UserSettings>({
    onValuesChange: (values) => {
      setSettingsRef(values)
      SaveState.delayedSave()
    },
  })

  const optionsMap: Partial<Record<keyof UserSettings, { value: string, label: string }[]>> = {}
  for (const key of Object.keys(SettingOptions) as (keyof typeof SettingOptions)[]) {
    const group = SettingOptions[key]
    optionsMap[key] = Object.entries(group)
      .map(([optionKey, value]) => ({ value, label: t(`${key}.${optionKey}` as any) as string }))
  }

  useEffect(() => {
    const initialSettings: UserSettings = clone(DefaultSettingOptions)
    const newSettings: UserSettings = mergeDefinedValues(initialSettings, settings)
    setSettingsRef(newSettings)
    settingsForm.setValues(newSettings)
  }, [])

  return (
    <Flex direction='column' gap={10}>
      {(Object.keys(SettingOptions) as (keyof typeof SettingOptions)[])
        .map((option) => (
          <SettingRow
            key={option}
            label={t(`${option}.Label`)}
            data={optionsMap[option]}
            {...settingsForm.getInputProps(option)}
          />
        ))}
    </Flex>
  )
}
