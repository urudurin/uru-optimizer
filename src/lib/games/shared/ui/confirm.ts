import { modals } from '@mantine/modals'
import {
  createElement,
  type ReactNode,
} from 'react'

// Asks before an action in HSR's confirm modal (Mantine modals, as lib/hooks/useConfirmAction.ts opens it), instead of
// the browser's window.confirm. Not a hook, so event handlers anywhere can await it. danger makes the button red, for
// deletes and clears
export function confirmAction(title: string, content: ReactNode, { danger = false, confirmLabel = 'Confirm' } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    modals.openConfirmModal({
      title,
      // Plain text keeps its line breaks
      children: typeof content === 'string' ? createElement('div', { style: { whiteSpace: 'pre-line', fontSize: 14 } }, content) : content,
      labels: { confirm: confirmLabel, cancel: 'Cancel' },
      centered: true,
      confirmProps: danger ? { color: 'red' } : undefined,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}
