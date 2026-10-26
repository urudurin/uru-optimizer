import {
  Chip,
  SegmentedControl,
  Text,
  TextInput,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import classes from 'lib/games/shared/ui/Showcase.module.css'
import {
  type CSSProperties,
  type ReactNode,
  useState,
} from 'react'

// The character page layout shared by ZZZ Agents, Genshin Characters and WuWa Resonators, after HSR's Characters page:
// a roster of art banners (search, two filter rows, Default/Compact) and one showcase card (art and weapon, a column
// of stats and controls, the gear). Pages pass their own data; without images everything falls back to initials.

export function initials(name: string): string {
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

export type RosterEntry = {
  key: string,
  name: string,
  meta: string,
  // Two filter rows, e.g. element and specialty (or weapon type)
  group: string,
  subgroup?: string,
  // Background art and the round icon
  portrait?: string,
  circle?: string,
}

export function Roster({ entries, active, onPick, groupColor, footer }: {
  entries: RosterEntry[],
  active?: string,
  onPick: (key: string) => void,
  // Mantine color for a group chip
  groupColor?: (group: string) => string,
  footer?: ReactNode,
}) {
  const [search, setSearch] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const [subgroups, setSubgroups] = useState<string[]>([])
  const [compact, setCompact] = useState(false)

  const allGroups = [...new Set(entries.map((e) => e.group))]
  const allSubgroups = [...new Set(entries.flatMap((e) => (e.subgroup ? [e.subgroup] : [])))]
  const shown = entries.filter((e) =>
    e.name.toLowerCase().includes(search.trim().toLowerCase())
    && (groups.length === 0 || groups.includes(e.group))
    && (subgroups.length === 0 || (e.subgroup !== undefined && subgroups.includes(e.subgroup)))
  )

  return (
    <div className={classes.roster}>
      <TextInput
        size='sm'
        placeholder='Search'
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />
      <Chip.Group multiple value={groups} onChange={setGroups}>
        <div className={classes.filters}>
          {allGroups.map((group) => <Chip key={group} value={group} size='xs' color={groupColor?.(group)} variant='light'>{group}</Chip>)}
        </div>
      </Chip.Group>
      {allSubgroups.length > 0 && (
        <Chip.Group multiple value={subgroups} onChange={setSubgroups}>
          <div className={classes.filters}>
            {allSubgroups.map((subgroup) => <Chip key={subgroup} value={subgroup} size='xs' variant='light'>{subgroup}</Chip>)}
          </div>
        </Chip.Group>
      )}

      <div className={classes.rosterList}>
        {shown.map((entry) => (
          <button
            key={entry.key}
            type='button'
            className={classes.banner}
            data-active={entry.key === active || undefined}
            data-compact={compact || undefined}
            style={entry.portrait ? { backgroundImage: `url(${entry.portrait})` } : undefined}
            onClick={() => onPick(entry.key)}
          >
            {entry.circle
              ? <img className={classes.circle} src={entry.circle} alt='' loading='lazy' />
              : <span className={`${classes.circle} ${classes.initials}`}>{initials(entry.name)}</span>}
            <span className={classes.bannerText}>
              <span className={classes.bannerName} style={{ display: 'block' }}>{entry.name}</span>
              <span className={classes.bannerMeta} style={{ display: 'block' }}>{entry.meta}</span>
            </span>
          </button>
        ))}
        {shown.length === 0 && <Text size='xs' c='dimmed'>Nobody matches.</Text>}
      </div>

      <SegmentedControl
        size='xs'
        value={compact ? 'compact' : 'default'}
        onChange={(value) => setCompact(value === 'compact')}
        data={[{ value: 'default', label: 'Default' }, { value: 'compact', label: 'Compact' }]}
      />
      {footer}
    </div>
  )
}

export function RosterLayout({ roster, children }: { roster: ReactNode, children: ReactNode }) {
  return (
    <div className={classes.layout}>
      {roster}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export function ShowcaseCard({ name, accent, portrait, portraitFit = 'cover', weapon, info, gear }: {
  name: string,
  // Theme color for the card's glow, a CSS color
  accent?: string,
  portrait?: string,
  // 'contain' for splash art that shouldn't be cropped
  portraitFit?: 'cover' | 'contain',
  weapon?: { image?: string, name: string, meta: string },
  // The stats column: name, badges, stats, controls
  info: ReactNode,
  gear: ReactNode,
}) {
  return (
    <div className={classes.showcase} style={{ '--accent': accent } as CSSProperties}>
      <div className={classes.artColumn}>
        <div className={classes.portrait}>
          {portrait
            ? <img src={portrait} alt={name} style={{ objectFit: portraitFit }} />
            : <div className={classes.portraitFallback}>{initials(name)}</div>}
        </div>
        {weapon && (
          <div className={classes.weapon}>
            {weapon.image && <img src={weapon.image} alt='' loading='lazy' />}
            <div>
              <Text size='sm' fw={600}>{weapon.name}</Text>
              <Text size='xs' c='dimmed'>{weapon.meta}</Text>
            </div>
          </div>
        )}
      </div>
      <div className={classes.statsColumn}>{info}</div>
      <div className={classes.gear}>{gear}</div>
    </div>
  )
}

export type StatListRow = { key: string, icon: ReactNode, label: string, value: string, highlight?: boolean }

export function StatList({ rows }: { rows: StatListRow[] }) {
  return (
    <div className={classes.statList}>
      {rows.map((row) => (
        <div key={row.key} className={classes.statRow} data-highlight={row.highlight || undefined}>
          {row.icon}
          <span>{row.label}</span>
          <span className={classes.statValue}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}
