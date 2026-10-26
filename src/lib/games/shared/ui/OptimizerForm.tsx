import {
  Collapse,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { IconChevronDown } from '@tabler/icons-react'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import classes from 'lib/games/shared/ui/Optimizer.module.css'
import {
  type ReactNode,
  useState,
} from 'react'

// Optimizer settings laid out like HSR's optimizer form: collapsible rows of cards side by side. Rows remember whether
// they're open in this browser; a closed row shows a one-line summary instead. Shared by the ZZZ, Genshin and WuWa pages.

const OPEN_ROWS_KEY = 'uru-optimizer-rows'

function readClosedRows(): Set<string> {
  try {
    const saved: unknown = JSON.parse(readStorage(OPEN_ROWS_KEY) ?? '[]')
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

export function FormRows({ children }: { children: ReactNode }) {
  return <div className={classes.formRows}>{children}</div>
}

// id is unique across games ('zzz-agent', 'genshin-filters'...), it keys the open/closed state
export function FormRow({ id, title, summary, children }: { id: string, title: string, summary?: string, children: ReactNode }) {
  const [open, setOpen] = useState(() => !readClosedRows().has(id))

  function toggle() {
    const closed = readClosedRows()
    if (open) closed.add(id)
    else closed.delete(id)
    writeStorage(OPEN_ROWS_KEY, JSON.stringify([...closed]))
    setOpen(!open)
  }

  return (
    <div className={classes.formRow}>
      <UnstyledButton className={classes.formRowHeader} onClick={toggle} aria-expanded={open}>
        <Text fw={600} size='md'>{title}</Text>
        {!open && summary && <Text size='xs' c='dimmed' lineClamp={1} className={classes.formRowSummary}>{summary}</Text>}
        <IconChevronDown size={18} className={classes.formRowChevron} data-open={open || undefined} />
      </UnstyledButton>
      <Collapse expanded={open} transitionDuration={150}>
        <div className={classes.formCards}>{children}</div>
      </Collapse>
    </div>
  )
}

export type FormCardSize = 'narrow' | 'normal' | 'wide'

export function FormCard({ title, description, size = 'normal', children }: {
  title: string,
  description?: string,
  size?: FormCardSize,
  children: ReactNode,
}) {
  return (
    <section className={classes.formCard} data-size={size}>
      <Text size='sm' fw={600}>{title}</Text>
      {description && <Text size='xs' c='dimmed' mt={2}>{description}</Text>}
      <div className={classes.formCardBody}>{children}</div>
    </section>
  )
}
