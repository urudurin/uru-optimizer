import {
  ActionIcon,
  Button,
  Chip,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconCamera,
  IconDownload,
  IconSearch,
} from '@tabler/icons-react'
import { extractPaletteInWorker } from 'lib/characterPreview/color/colorExtractionService'
import {
  DEFAULT_SHOWCASE_COLOR,
  resolveShowcaseTheme,
} from 'lib/characterPreview/color/showcaseColorService'
import {
  cardTotalW,
  defaultGap,
  middleColumnWidth,
  parentH,
  parentW,
  relicCardH,
  relicCardW,
} from 'lib/constants/constantsUi'
import classes from 'lib/games/shared/ui/Showcase.module.css'
import {
  ScreenshotAction,
  screenshotElementById,
} from 'lib/utils/screenshotUtils'
import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

// The character page layout shared by ZZZ Agents, Genshin Characters and WuWa Resonators, rebuilt on HSR's Characters
// tab (lib/tabs/tabCharacters/CharactersPanelContent.tsx) and character preview (lib/characterPreview/CharacterPreview.tsx):
// on the left the Character menu, the roster and Default / Compact; on the right a filter bar over one showcase card of
// HSR's fixed size (lib/constants/constantsUi.ts: a portrait two gear cards wide, a 240px stats column and a 2 x 3 grid of
// 207 x 288 gear cards, 1100 x 880 in all) on the character's art, blurred, in a colour taken from it, with a side panel
// to copy or download a screenshot. Without images everything falls back to initials.

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
  // Shown faded, e.g. a character the user hasn't added yet
  dimmed?: boolean,
}

// Where the Character menu goes: the top of the left column, like HSR's. The card renders the menu (it knows the
// character) and CharacterMenuSlot moves it there
const MenuSlotContext = createContext<HTMLElement | null>(null)

export function CharacterMenuSlot({ children }: { children: ReactNode }) {
  const slot = useContext(MenuSlotContext)
  return slot ? createPortal(children, slot) : children
}

const ROSTER_WIDTH = 300
const SIDE_PANEL_WIDTH = 104

export function RosterLayout({ entries, active, onPick, groupColor, children }: {
  entries: RosterEntry[],
  active?: string,
  onPick: (key: string) => void,
  // Mantine color for a group chip
  groupColor?: (group: string) => string,
  // The showcase card for the picked entry
  children: ReactNode,
}) {
  const [search, setSearch] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const [subgroups, setSubgroups] = useState<string[]>([])
  const [compact, setCompact] = useState(false)
  const [menuSlot, setMenuSlot] = useState<HTMLElement | null>(null)

  const allGroups = [...new Set(entries.map((e) => e.group))]
  const allSubgroups = [...new Set(entries.flatMap((e) => (e.subgroup ? [e.subgroup] : [])))]
  const shown = entries.filter((e) =>
    e.name.toLowerCase().includes(search.trim().toLowerCase())
    && (groups.length === 0 || groups.includes(e.group))
    && (subgroups.length === 0 || (e.subgroup !== undefined && subgroups.includes(e.subgroup)))
  )
  // Saved characters are numbered like HSR's priority list
  const savedIndex = new Map(entries.filter((e) => !e.dimmed).map((e, i) => [e.key, i + 1]))

  return (
    <MenuSlotContext.Provider value={menuSlot}>
      <div
        className={classes.layout}
        data-wide-page
        style={{
          '--roster-width': `${ROSTER_WIDTH}px`,
          '--card-width': `${cardTotalW}px`,
          '--side-width': `${SIDE_PANEL_WIDTH}px`,
          '--gap': `${defaultGap}px`,
        } as CSSProperties}
      >
        <div className={classes.rosterColumn}>
          <div ref={setMenuSlot} className={classes.menuSlot} />
          <div className={classes.rosterList} style={{ height: parentH }}>
            {shown.map((entry) => (
              <button
                key={entry.key}
                type='button'
                className={classes.banner}
                data-active={entry.key === active || undefined}
                data-compact={compact || undefined}
                data-dimmed={entry.dimmed || undefined}
                style={entry.portrait ? { backgroundImage: `url(${entry.portrait})` } : undefined}
                onClick={() => onPick(entry.key)}
              >
                <span className={classes.rank}>{savedIndex.get(entry.key) ?? ''}</span>
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
            fullWidth
            value={compact ? 'compact' : 'default'}
            onChange={(value) => setCompact(value === 'compact')}
            data={[{ value: 'default', label: 'Default' }, { value: 'compact', label: 'Compact' }]}
          />
        </div>

        <div className={classes.cardColumn}>
          {/* HSR's filter bar above the card: search, then the two filter rows */}
          <div className={classes.filterBar}>
            <TextInput
              size='xs'
              w={180}
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
          </div>
          {children}
        </div>
      </div>
    </MenuSlotContext.Provider>
  )
}

// The card's colour, like HSR's AUTO showcase colour: taken from the art by HSR's palette worker, the given accent
// until then or when the art can't be read (another site's image without CORS)
function useShowcaseColor(portrait: string | undefined, accent: string | undefined): string {
  // HSR's colour maths needs a plain colour; a CSS variable accent (WuWa's elements) falls back to HSR's default blue
  const fallback = accent && /^(#|rgb|hsl)/.test(accent) ? accent : DEFAULT_SHOWCASE_COLOR
  const [picked, setPicked] = useState<{ url: string, color: string } | undefined>()
  useEffect(() => {
    if (!portrait) return
    let live = true
    extractPaletteInWorker(portrait)
      .then((palette) => {
        const color = palette?.Vibrant ?? palette?.DarkVibrant
        if (live && color) setPicked({ url: portrait, color })
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [portrait])
  return picked && picked.url === portrait ? picked.color : fallback
}

let cardCounter = 0

export function ShowcaseCard({ name, accent, portrait, portraitFit = 'cover', weapon, info, gear, sidePanel = false }: {
  name: string,
  // The card's colour until one is taken from the art, a CSS color
  accent?: string,
  portrait?: string,
  // 'contain' for splash art that shouldn't be cropped
  portraitFit?: 'cover' | 'contain',
  weapon?: { image?: string, name: string, meta: string },
  // The middle column: name, badges, stats, rating
  info: ReactNode,
  // Up to six gear cards, laid out 2 x 3
  gear: ReactNode,
  // HSR's side panel with screenshot buttons (the Characters pages; the optimizer's preview has none)
  sidePanel?: boolean,
}) {
  const [cardId] = useState(() => `uru-showcase-${++cardCounter}`)
  const seed = useShowcaseColor(portrait, accent)
  const theme = resolveShowcaseTheme(seed, true)
  const [shooting, setShooting] = useState<ScreenshotAction | undefined>()
  const shoot = async (action: ScreenshotAction) => {
    setShooting(action)
    try {
      await screenshotElementById(cardId, action, name)
    } finally {
      setShooting(undefined)
    }
  }

  const card = (
    <div
      id={cardId}
      className={classes.showcase}
      data-wide-page
      style={{
        '--showcase-seed': seed,
        '--showcase-bg': theme.cardBackgroundColor,
        '--showcase-edge': theme.cardBorderColor,
        'width': cardTotalW,
        'height': parentH,
        'gap': defaultGap,
      } as CSSProperties}
    >
      {portrait && (
        <div className={classes.blur} aria-hidden>
          <img src={portrait} alt='' draggable={false} />
        </div>
      )}
      <div className={classes.portrait} style={{ width: parentW, height: parentH }}>
        {portrait
          ? <img src={portrait} alt={name} style={{ objectFit: portraitFit }} draggable={false} />
          : <div className={classes.portraitFallback}>{initials(name)}</div>}
        {weapon && (
          <div className={classes.weapon}>
            {weapon.image && <img src={weapon.image} alt='' loading='lazy' />}
            <div style={{ minWidth: 0 }}>
              <Text size='sm' fw={600} truncate>{weapon.name}</Text>
              <Text size='xs' c='dimmed'>{weapon.meta}</Text>
            </div>
          </div>
        )}
      </div>
      <div className={classes.statsColumn} style={{ width: middleColumnWidth, height: parentH }}>{info}</div>
      <div
        className={classes.gear}
        style={{ width: parentW, gridTemplateColumns: `repeat(2, ${relicCardW}px)`, gridAutoRows: relicCardH, gap: defaultGap }}
      >
        {gear}
      </div>
    </div>
  )

  if (!sidePanel) return card
  return (
    <div className={classes.cardRow}>
      {card}
      <Stack className={classes.sidePanel} gap={6}>
        <Text size='xs' fw={600} c='dimmed' ta='center'>Screenshot</Text>
        <Button.Group>
          <Tooltip label='Copy to clipboard'>
            <ActionIcon size='lg' variant='filled' loading={shooting === ScreenshotAction.Clipboard} onClick={() => void shoot(ScreenshotAction.Clipboard)}>
              <IconCamera size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label='Download'>
            <ActionIcon size='lg' variant='filled' loading={shooting === ScreenshotAction.Download} onClick={() => void shoot(ScreenshotAction.Download)}>
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
        </Button.Group>
      </Stack>
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
