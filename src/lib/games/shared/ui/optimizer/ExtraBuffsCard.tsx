import {
  Button,
  Group,
  NumberInput,
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
import { FormCard } from 'lib/games/shared/ui/OptimizerForm'

// HSR's Extra combat buffs drawer as a card in the Damage row (shared/extraBuffs.ts): one number per buff, all added
// to every build; Clear empties them

export function ExtraBuffsCard({ defs, buffs, onChange }: { defs: ExtraBuffDef[], buffs: ExtraBuffs, onChange: (buffs: ExtraBuffs) => void }) {
  const active = activeExtraBuffs(defs, buffs)
  return (
    <FormCard
      title='Extra combat buffs'
      size='normal'
      description='Buffs the optimizer doesn&apos;t know about (a teammate or weapon it doesn&apos;t cover, an event buff), added to every build. Percents as shown in game.'
    >
      <Stack gap='xs'>
        <SimpleGrid cols={2} spacing='xs' verticalSpacing={6}>
          {defs.map((def) => (
            <NumberInput
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
          <Text size='xs' c='dimmed'>{active.length === 0 ? 'None set' : `${active.length} set`}</Text>
          <Button size='xs' variant='default' disabled={active.length === 0} onClick={() => onChange({})}>Clear</Button>
        </Group>
      </Stack>
    </FormCard>
  )
}
