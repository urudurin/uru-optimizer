import {
  Button,
  Group,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import {
  activeExtraBuffs,
  type ExtraBuffDef,
  type ExtraBuffs,
  setExtraBuff,
} from 'lib/games/shared/extraBuffs'
import { CommittedNumberInput } from 'lib/games/shared/ui/CommittedNumberInput'
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'
import { useTranslation } from 'react-i18next'

// HSR's Extra combat buffs drawer as a card in the Damage row (shared/extraBuffs.ts): one number per buff, all added
// to every build; Clear empties them

export function ExtraBuffsCard({ defs, buffs, onChange }: { defs: ExtraBuffDef[], buffs: ExtraBuffs, onChange: (buffs: ExtraBuffs) => void }) {
  const active = activeExtraBuffs(defs, buffs)
  const { t } = useTranslation('games', { keyPrefix: 'ExtraBuffs' })
  return (
    <FormCard title={t('Title')} size='normal' description={t('Description')}>
      <Stack gap='xs'>
        <SimpleGrid cols={2} spacing='xs' verticalSpacing={6}>
          {defs.map((def) => (
            <CommittedNumberInput
              key={def.key}
              size='xs'
              label={def.label}
              hideControls
              decimalScale={2}
              placeholder='0'
              value={buffs[def.key] ?? ''}
              onChange={(value) => onChange(setExtraBuff(buffs, def.key, typeof value === 'number' ? value : undefined))}
            />
          ))}
        </SimpleGrid>
        <Group justify='space-between'>
          <Text size='xs' c='dimmed'>{active.length === 0 ? t('NoneSet') : t('CountSet', { count: active.length })}</Text>
          <Button size='xs' variant='default' disabled={active.length === 0} onClick={() => onChange({})}>{t('Clear')}</Button>
        </Group>
      </Stack>
    </FormCard>
  )
}
