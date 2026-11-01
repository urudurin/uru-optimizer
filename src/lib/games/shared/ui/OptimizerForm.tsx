import { Text } from '@mantine/core'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import classes from 'lib/games/shared/ui/Optimizer.module.css'
import { FormRow as HsrFormRow } from 'lib/tabs/tabOptimizer/optimizerForm/layout/FormRow'
import type { ReactNode } from 'react'

// Optimizer settings laid out like HSR's optimizer form: rows of HSR's own FormRow accordion with cards side by side.
// Rows remember whether they're open in this browser; a closed row shows a one-line summary instead. Shared by the ZZZ,
// Genshin and WuWa pages.

const OPEN_ROWS_KEY = 'uru-optimizer-rows'

function readClosedRows(): Set<string> {
  try {
    const saved: unknown = JSON.parse(readStorage(OPEN_ROWS_KEY) ?? '[]')
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

function saveRowOpen(id: string, open: boolean) {
  const closed = readClosedRows()
  if (open) closed.delete(id)
  else closed.add(id)
  writeStorage(OPEN_ROWS_KEY, JSON.stringify([...closed]))
}

// The rows' frame, as HSR's FilterContainer but full width instead of its fixed 1302px
export function FormRows({ children }: { children: ReactNode }) {
  return <div className={classes.formRows}>{children}</div>
}

// id is unique across games ('zzz-agent', 'genshin-filters'...), it keys the open/closed state
export function FormRow({ id, title, summary, children }: { id: string, title: string, summary?: string, children: ReactNode }) {
  return (
    <HsrFormRow
      id={id}
      label={title}
      summary={summary}
      openState={{ initial: !readClosedRows().has(id), save: (open) => saveRowOpen(id, open) }}
    >
      <div className={classes.formCards}>{children}</div>
    </HsrFormRow>
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
