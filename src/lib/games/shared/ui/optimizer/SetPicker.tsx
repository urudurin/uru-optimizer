import {
  Button,
  Group,
  Modal,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import classes from 'lib/games/shared/ui/optimizer/SetPicker.module.css'
import { SelectCardGrid } from 'lib/ui/selectors/SelectCardGrid'
import gridClasses from 'lib/ui/selectors/SelectCardGrid.module.css'
import {
  LC_CARD_IMAGE_HEIGHT,
  LC_CARD_IMAGE_WIDTH,
  LC_CARD_IMAGE_X_OFFSET,
  LC_CARD_IMAGE_Y_OFFSET,
  LC_MODAL_STYLES,
  OVERLAY_SCROLLBAR_OPTIONS,
  SEARCH_INPUT_STYLES,
} from 'lib/ui/selectors/selectConstants'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import {
  useMemo,
  useState,
} from 'react'

// Picking sets for the optimizer, after HSR's relic set filter (lib/tabs/tabOptimizer/optimizerForm/components/
// RelicSetFilterModal): the choice shows as icons on a button, which opens HSR's card grid (lib/ui/selectors/
// SelectCardGrid.tsx) of every set. While some are picked, the rest are dimmed

export type SetOption = { value: string, label: string, icon?: string }

// A set with no art shows its name on a plain card
const NO_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export function SetPicker({ label, options, value, max, disabled, placeholder = 'Any', onChange }: {
  label: string,
  options: SetOption[],
  value: string[],
  // How many sets can be picked; 1 replaces the pick
  max: number,
  disabled?: boolean,
  placeholder?: string,
  onChange: (value: string[]) => void,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const picked = value.map((id) => options.find((o) => o.value === id) ?? { value: id, label: id })
  const shown = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase())).map((o) => ({ id: o.value, label: o.label, rarity: 0 })),
    [options, search],
  )
  const icons = useMemo(() => new Map(options.map((o) => [o.value, o.icon || NO_IMAGE])), [options])
  const dimmed = useMemo(() => (value.length > 0 ? new Set(options.map((o) => o.value).filter((id) => !value.includes(id))) : undefined), [options, value])

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else if (max === 1) {
      onChange([id])
      setOpen(false)
    } else if (value.length < max) onChange([...value, id])
  }

  return (
    <div>
      <Text size='sm' fw={500} mb={4}>{label}</Text>
      <UnstyledButton className={classes.trigger} disabled={disabled} data-disabled={disabled || undefined} onClick={() => setOpen(true)}>
        {picked.length === 0
          ? <Text size='sm' c='dimmed'>{placeholder}</Text>
          : picked.map((set) => (
            <span key={set.value} className={classes.chip}>
              {set.icon && <img src={set.icon} alt='' />}
              <span>{set.label}</span>
            </span>
          ))}
      </UnstyledButton>

      <Modal opened={open} onClose={() => setOpen(false)} title={label} size='90%' centered styles={LC_MODAL_STYLES}>
        {open && (
          <div className={gridClasses.modalContent}>
            <Group gap='sm' wrap='nowrap'>
              <TextInput
                flex={1}
                styles={SEARCH_INPUT_STYLES}
                placeholder='Search sets'
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              <Text size='xs' c='dimmed'>{max === 1 ? 'Pick one' : `Up to ${max}: ${value.length} picked`}</Text>
              <Button size='xs' variant='subtle' onClick={() => onChange([])} disabled={value.length === 0}>Clear</Button>
              {max > 1 && <Button size='xs' onClick={() => setOpen(false)}>Done</Button>}
            </Group>
            <OverlayScrollbarsComponent className={gridClasses.scrollArea} defer options={OVERLAY_SCROLLBAR_OPTIONS}>
              {shown.length === 0
                ? <Text size='sm' c='dimmed'>No set matches.</Text>
                : (
                  <SelectCardGrid
                    options={shown}
                    onSelect={toggle}
                    getImageSrc={(id) => icons.get(id) ?? NO_IMAGE}
                    cardImageHeight={LC_CARD_IMAGE_HEIGHT}
                    imageWidth={LC_CARD_IMAGE_WIDTH}
                    imageXOffset={LC_CARD_IMAGE_X_OFFSET}
                    imageYOffset={LC_CARD_IMAGE_Y_OFFSET}
                    textRows={2}
                    excludedIds={dimmed}
                  />
                )}
            </OverlayScrollbarsComponent>
          </div>
        )}
      </Modal>
    </div>
  )
}
