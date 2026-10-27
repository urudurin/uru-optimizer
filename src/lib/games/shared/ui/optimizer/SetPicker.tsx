import {
  Button,
  Group,
  Modal,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import classes from 'lib/games/shared/ui/optimizer/SetPicker.module.css'
import { useState } from 'react'

// Picking sets for the optimizer, after HSR's relic set filter (lib/tabs/tabOptimizer/optimizerForm/components/
// RelicSetFilterModal): the choice shows as icons on a button, which opens a searchable grid of every set

export type SetOption = { value: string, label: string, icon?: string }

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
  const shown = options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))

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

      <Modal opened={open} onClose={() => setOpen(false)} title={label} size='xl' centered>
        <Group gap='sm' mb='sm'>
          <TextInput
            flex={1}
            placeholder='Search sets'
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Text size='xs' c='dimmed'>{max === 1 ? 'Pick one' : `Up to ${max}: ${value.length} picked`}</Text>
          <Button size='xs' variant='subtle' onClick={() => onChange([])} disabled={value.length === 0}>Clear</Button>
          {max > 1 && <Button size='xs' onClick={() => setOpen(false)}>Done</Button>}
        </Group>
        <div className={classes.grid}>
          {shown.map((set) => (
            <UnstyledButton
              key={set.value}
              className={classes.tile}
              data-picked={value.includes(set.value) || undefined}
              data-full={(!value.includes(set.value) && max > 1 && value.length >= max) || undefined}
              onClick={() => toggle(set.value)}
            >
              {set.icon ? <img src={set.icon} alt='' /> : <span className={classes.noIcon} />}
              <span>{set.label}</span>
            </UnstyledButton>
          ))}
          {shown.length === 0 && <Text size='sm' c='dimmed'>No set matches.</Text>}
        </div>
      </Modal>
    </div>
  )
}
