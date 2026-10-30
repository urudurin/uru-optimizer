import {
  Alert,
  Badge,
  Button,
  Code,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconInfoCircle,
} from '@tabler/icons-react'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import classes from 'lib/games/shared/ui/GameLayout.module.css'
import {
  type ReactNode,
  useState,
} from 'react'
import {
  ErrorBoundary,
  type FallbackProps,
} from 'react-error-boundary'

// Page shell, page header and building blocks shared by the ZZZ and WuWa pages, styled after HSR's sidebar and panels

export type GameNavItem<K extends string> = {
  key: K,
  label: string,
  icon: ReactNode,
  // Small tag next to the label, e.g. "Soon"
  badge?: string,
}

export type GameNavGroup<K extends string> = {
  label: string,
  items: GameNavItem<K>[],
}

type GameLayoutProps<K extends string> = {
  gameName: string,
  tagline: string,
  groups: GameNavGroup<K>[],
  active: K,
  onNavigate: (key: K) => void,
  children: ReactNode,
}

export function GameLayout<K extends string>({ gameName, tagline, groups, active, onNavigate, children }: GameLayoutProps<K>) {
  const items = groups.flatMap((group) => group.items)

  return (
    <div className={classes.shell}>
      <aside className={classes.aside}>
        <div className={classes.asideInner}>
          <div className={classes.gameBlock}>
            <div className={classes.gameName}>{gameName}</div>
            <div className={classes.gameTagline}>{tagline}</div>
          </div>
          {groups.map((group) => (
            <div key={group.label} className={classes.group}>
              <div className={classes.groupLabel}>{group.label}</div>
              {group.items.map((item) => (
                <UnstyledButton
                  key={item.key}
                  className={classes.item}
                  data-active={item.key === active || undefined}
                  onClick={() => onNavigate(item.key)}
                >
                  <span className={classes.itemIcon}>{item.icon}</span>
                  {item.label}
                  {item.badge && <Badge className={classes.itemBadge} size='xs' variant='light'>{item.badge}</Badge>}
                </UnstyledButton>
              ))}
            </div>
          ))}
          <div className={classes.asideFooter}>Personal, non-commercial use. Not affiliated with the game's publisher.</div>
        </div>
      </aside>

      <nav className={classes.mobileNav}>
        {items.map((item) => (
          <UnstyledButton
            key={item.key}
            className={classes.mobileItem}
            data-active={item.key === active || undefined}
            onClick={() => onNavigate(item.key)}
          >
            {item.icon}
            {item.label}
          </UnstyledButton>
        ))}
      </nav>

      <main className={classes.main}>
        <div className={classes.mainInner}>
          {/* A page that breaks shows its error here, keeping the sidebar and game switcher; picking a page clears it */}
          <ErrorBoundary FallbackComponent={PageError} resetKeys={[active]}>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}

function PageError({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <Alert color='red' variant='light' icon={<IconAlertTriangle size={18} />} title='This page ran into a problem'>
      <Stack gap='sm' align='flex-start'>
        <Text size='sm'>
          Your saved data is untouched. Try again, or pick another page from the sidebar. If it keeps happening, the message below helps find the cause.
        </Text>
        <Code block>{error instanceof Error ? error.message : String(error)}</Code>
        <Button size='xs' variant='light' onClick={resetErrorBoundary}>Try again</Button>
      </Stack>
    </Alert>
  )
}

export function PageHeader({ title, description, actions }: { title: string, description?: ReactNode, actions?: ReactNode }) {
  return (
    <div className={classes.pageHeader}>
      <div>
        <div className={classes.pageTitle}>{title}</div>
        {description && <div className={classes.pageDescription}>{description}</div>}
      </div>
      {actions}
    </div>
  )
}

export function Panel({ title, description, actions, children }: {
  title?: ReactNode,
  description?: ReactNode,
  actions?: ReactNode,
  children: ReactNode,
}) {
  return (
    <section className={classes.panel}>
      {(title || actions) && (
        <div className={classes.panelHeader}>
          <div>
            {title && <div className={classes.panelTitle}>{title}</div>}
            {description && <div className={classes.panelDescription}>{description}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode, title: string, children?: ReactNode, action?: ReactNode }) {
  return (
    <div className={classes.empty}>
      <div className={classes.emptyIcon}>{icon}</div>
      <div className={classes.emptyTitle}>{title}</div>
      {children && <div className={classes.emptyText}>{children}</div>}
      {action}
    </div>
  )
}

export type StatTileData = { key: string, label: string, value: string, highlight?: boolean }

export function StatGrid({ stats }: { stats: StatTileData[] }) {
  return (
    <div className={classes.statGrid}>
      {stats.map((stat) => (
        <div key={stat.key} className={classes.statTile} data-highlight={stat.highlight || undefined}>
          <div className={classes.statLabel}>{stat.label}</div>
          <div className={classes.statValue}>{stat.value}</div>
        </div>
      ))}
    </div>
  )
}

export function SideLayout({ side, children }: { side: ReactNode, children: ReactNode }) {
  return (
    <div className={classes.sideLayout}>
      {side}
      <Stack gap='lg'>{children}</Stack>
    </div>
  )
}

export type PickItem = { key: string, title: string, meta: string, badge?: ReactNode }

// A list of selectable cards, e.g. the user's builds or characters
export function PickList({ items, active, onPick }: { items: PickItem[], active?: string, onPick: (key: string) => void }) {
  return (
    <div className={classes.pickList}>
      {items.map((item) => (
        <UnstyledButton
          key={item.key}
          className={classes.pickItem}
          data-active={item.key === active || undefined}
          onClick={() => onPick(item.key)}
        >
          <span className={classes.pickTop}>
            <span className={classes.pickTitle}>{item.title}</span>
            {item.badge}
          </span>
          <span className={classes.pickMeta}>{item.meta}</span>
        </UnstyledButton>
      ))}
    </div>
  )
}

// A quiet list of things the user should know, instead of a loud alert block
export function Notices({ title, messages, max = 6 }: { title?: string, messages: string[], max?: number }) {
  if (messages.length === 0) return null
  return (
    <div className={classes.notice}>
      <IconInfoCircle size={16} className={classes.noticeIcon} />
      <Stack gap={2}>
        {title && <Text size='xs' fw={600}>{title}</Text>}
        {messages.slice(0, max).map((message, i) => <Text key={i} size='xs' c='dimmed'>{message}</Text>)}
        {messages.length > max && <Text size='xs' c='dimmed'>{`...and ${messages.length - max} more`}</Text>}
      </Stack>
    </div>
  )
}

// The page the user last had open in a game, remembered in this browser only
export function useStoredPage<K extends string>(storageKey: string, pages: readonly K[], fallback: K): [K, (page: K) => void] {
  const [page, setPage] = useState<K>(() => {
    const stored = readStorage(storageKey)
    return pages.includes(stored as K) ? stored as K : fallback
  })
  return [page, (next) => {
    writeStorage(storageKey, next)
    setPage(next)
  }]
}
