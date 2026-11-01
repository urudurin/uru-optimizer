import {
  Accordion,
  Flex,
  Text,
} from '@mantine/core'
import { useOptimizerDisplayStore } from 'lib/stores/optimizerUI/useOptimizerDisplayStore'
import {
  type ReactNode,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

// Optional for other callers (the ZZZ / Genshin / WuWa optimizers): summary is shown beside the label while the row is
// closed, and openState replaces the optimizer display store as where the open / closed state is read and saved
export type FormRowOpenState = { initial: boolean, save: (open: boolean) => void }

export function FormRow({ id, label, summary, openState, children }: {
  id: string,
  label?: string,
  summary?: string,
  openState?: FormRowOpenState,
  children: ReactNode,
}) {
  const { t } = useTranslation('optimizerTab', { keyPrefix: 'FormRowLabels' })
  const storeOpen = useOptimizerDisplayStore((s) => s.menuState[id])
  const [isOpen, setIsOpen] = useState(() => openState ? openState.initial : storeOpen)

  function onChange(value: string[]) {
    const open = value.length > 0
    setIsOpen(open)
    if (openState) return openState.save(open)
    const { menuState, setMenuState } = useOptimizerDisplayStore.getState()
    setMenuState({ ...menuState, [id]: open })
  }

  const title = label ?? t(`${id}` as never)

  return (
    <Flex
      direction='column'
      style={{
        minWidth: '100%',
      }}
    >
      <Accordion
        multiple
        defaultValue={isOpen ? [id] : []}
        onChange={onChange}
        chevronPosition='right'
        variant='default'
        transitionDuration={200}
        styles={{
          control: { fontSize: 20, alignItems: 'baseline' },
          content: { paddingBlock: 0, paddingBottom: 10 },
          chevron: { paddingInlineStart: 12 },
        }}
      >
        <Accordion.Item value={id}>
          <Accordion.Control>
            {summary === undefined
              ? title
              : (
                <Flex align='baseline' gap={14} miw={0}>
                  <span style={{ flexShrink: 0 }}>{title}</span>
                  {!isOpen && <Text size='sm' c='dimmed' lineClamp={1}>{summary}</Text>}
                </Flex>
              )}
          </Accordion.Control>
          <Accordion.Panel>
            <Flex gap={10}>
              {children}
            </Flex>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Flex>
  )
}

export function TeammateFormRow({ id, children }: { id: string, children: ReactNode }) {
  const { t } = useTranslation('optimizerTab', { keyPrefix: 'TeammateRow' })

  return (
    <FormRow id={id} label={t('Header')}>
      {children}
    </FormRow>
  )
}
