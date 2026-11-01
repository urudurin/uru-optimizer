import {
  ActionIcon,
  Button,
  Chip,
  ColorInput,
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
  newLcHeight,
  newLcMargin,
  parentH,
  parentW,
  relicCardH,
  relicCardW,
} from 'lib/constants/constantsUi'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import classes from 'lib/games/shared/ui/Showcase.module.css'
import { useScreenshotAction } from 'lib/hooks/useScreenshotAction'
import { Assets } from 'lib/rendering/assets'
import { ScreenshotAction } from 'lib/utils/screenshotUtils'
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

// The card colour a user picked per character, after HSR's showcase colour modes (Auto from the art, Custom, Standard):
// localStorage uru-showcase-colors { [game:character]: { mode, color? } }
type ColorMode = 'auto' | 'custom' | 'standard'
type ColorChoice = { mode: ColorMode, color?: string }
const COLORS_KEY = 'uru-showcase-colors'
// HSR's Standard colour (lib/characterPreview/color/showcaseColorService.ts)
const STANDARD_COLOR = '#647bb0'

function readColorChoice(key: string | undefined): ColorChoice {
  if (!key) return { mode: 'auto' }
  try {
    const all = JSON.parse(readStorage(COLORS_KEY) ?? '{}') as Record<string, ColorChoice | undefined>
    const choice = all[key]
    return choice && ['auto', 'custom', 'standard'].includes(choice.mode) ? choice : { mode: 'auto' }
  } catch {
    return { mode: 'auto' }
  }
}

function writeColorChoice(key: string, choice: ColorChoice) {
  let all: Record<string, ColorChoice> = {}
  try {
    all = JSON.parse(readStorage(COLORS_KEY) ?? '{}') as Record<string, ColorChoice>
  } catch {
    // start over
  }
  writeStorage(COLORS_KEY, JSON.stringify({ ...all, [key]: choice }))
}

let cardCounter = 0

export function ShowcaseCard({ name, accent, portrait, portraitFit = 'cover', weapon, heading, info, gear, sidePanel = false, colorKey, breakdown }: {
  name: string,
  // The card's colour until one is taken from the art, a CSS color
  accent?: string,
  portrait?: string,
  // 'contain' for splash art that shouldn't be cropped
  portraitFit?: 'cover' | 'contain',
  weapon?: { image?: string, name: string, meta: string },
  // HSR's header row above the name: rarity stars (Genshin) or rank (ZZZ S / A)
  heading?: { stars?: number, rank?: string },
  // The middle column: name, badges, stats, rating (its first block is centered under the heading, like HSR's)
  info: ReactNode,
  // Up to six gear cards, laid out 2 x 3
  gear: ReactNode,
  // HSR's side panel with screenshot buttons (the Characters pages; the optimizer's preview has none)
  sidePanel?: boolean,
  // Remembers the side panel's colour choice for this character, e.g. 'genshin:Xiangling'
  colorKey?: string,
  // The tabs under the card (with the side panel): gear scores and substat rolls
  breakdown?: ShowcaseBreakdown,
}) {
  const [cardId] = useState(() => `uru-showcase-${++cardCounter}`)
  const auto = useShowcaseColor(portrait, accent)
  const [choice, setChoice] = useState(() => readColorChoice(colorKey))
  const [choiceKey, setChoiceKey] = useState(colorKey)
  if (choiceKey !== colorKey) {
    setChoiceKey(colorKey)
    setChoice(readColorChoice(colorKey))
  }
  const choose = (next: ColorChoice) => {
    setChoice(next)
    if (colorKey) writeColorChoice(colorKey, next)
  }
  const seed = choice.mode === 'standard' ? STANDARD_COLOR : choice.mode === 'custom' && choice.color ? choice.color : auto
  const theme = resolveShowcaseTheme(seed, true)
  // HSR's screenshot hook: paints the spinner first, one action at a time, safe if the card unmounts
  const { activeAction: shooting, trigger: shoot } = useScreenshotAction(cardId)

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
      {
        /* HSR's left column (characterPreviewController.ts): the portrait shrinks to make room for the weapon in its own box
          below, newLcHeight tall with newLcMargin between, so the weapon never covers the art */
      }
      <div className={classes.portraitColumn} style={{ width: parentW, height: parentH, gap: newLcMargin }}>
        <div className={classes.portrait} style={{ height: weapon ? parentH - newLcHeight - newLcMargin : parentH }}>
          {portrait
            ? <img src={portrait} alt={name} style={{ objectFit: portraitFit }} draggable={false} />
            : <div className={classes.portraitFallback}>{initials(name)}</div>}
        </div>
        {weapon && (
          <div className={classes.weapon} style={{ height: newLcHeight }}>
            {weapon.image && (
              <div className={classes.weaponBlur} aria-hidden>
                <img src={weapon.image} alt='' draggable={false} />
              </div>
            )}
            {weapon.image && <img className={classes.weaponIcon} src={weapon.image} alt='' loading='lazy' draggable={false} />}
            <div className={classes.weaponText}>
              <Text size='md' fw={600} truncate>{weapon.name}</Text>
              <Text size='sm' c='dimmed'>{weapon.meta}</Text>
            </div>
          </div>
        )}
      </div>
      <div className={classes.statsColumn} style={{ width: middleColumnWidth, height: parentH }}>
        {heading && (heading.stars || heading.rank) && (
          <header className={classes.heading}>
            {heading.stars
              ? Array.from({ length: heading.stars }, (_, i) => <img key={i} src={Assets.getStar()} alt='' />)
              : <span className={classes.rank}>{`${heading.rank}-rank`}</span>}
          </header>
        )}
        {info}
      </div>
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
    <div className={classes.cardWithTabs}>
      <div className={classes.cardRow}>
        {card}
        <Stack className={classes.sidePanel} gap={6}>
          <Text size='xs' fw={600} c='dimmed' ta='center'>Screenshot</Text>
          <Button.Group>
            <Tooltip label='Copy to clipboard'>
              <ActionIcon size='lg' variant='filled' loading={shooting === ScreenshotAction.Clipboard} onClick={() => shoot(ScreenshotAction.Clipboard, name)}>
                <IconCamera size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label='Download'>
              <ActionIcon size='lg' variant='filled' loading={shooting === ScreenshotAction.Download} onClick={() => shoot(ScreenshotAction.Download, name)}>
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
          </Button.Group>
          <Text size='xs' fw={600} c='dimmed' ta='center' mt={6}>Colour</Text>
          <SegmentedControl
            size='xs'
            orientation='vertical'
            fullWidth
            value={choice.mode}
            onChange={(mode) => choose({ mode: mode as ColorMode, color: mode === 'custom' ? choice.color ?? auto : choice.color })}
            data={[{ value: 'auto', label: 'Auto' }, { value: 'custom', label: 'Custom' }, { value: 'standard', label: 'Standard' }]}
          />
          {choice.mode === 'custom' && (
            <ColorInput
              size='xs'
              format='hex'
              withEyeDropper={false}
              value={choice.color ?? auto}
              onChange={(color) => choose({ mode: 'custom', color })}
            />
          )}
        </Stack>
      </div>
      {breakdown && <ShowcaseTabs breakdown={breakdown} />}
    </div>
  )
}

// What the tabs under the card show, after HSR's DPS Benchmark / Substat Rolls / None tabs: each piece's score, and the
// substat rolls of the whole build (rolls in the game's own unit) with how much the character wants each stat
export type ShowcaseBreakdown = {
  pieces: { key: string, label: string, score?: { percent: number, rating: string } }[],
  rolls: { stat: string, label: string, rolls: number, weight: number }[],
  // e.g. 'rolls' (Genshin, ZZZ) or 'max rolls' (WuWa, whose substats roll once)
  rollUnit: string,
}

type BreakdownTab = 'scores' | 'rolls' | 'none'

function ShowcaseTabs({ breakdown }: { breakdown: ShowcaseBreakdown }) {
  const [tab, setTab] = useState<BreakdownTab>('scores')
  const rolls = [...breakdown.rolls].filter((r) => r.rolls > 0).sort((a, b) => b.weight - a.weight || b.rolls - a.rolls)
  const most = Math.max(1, ...rolls.map((r) => r.rolls))
  const useful = rolls.reduce((sum, r) => sum + r.rolls * r.weight, 0)
  const total = rolls.reduce((sum, r) => sum + r.rolls, 0)
  const scored = breakdown.pieces.flatMap((p) => (p.score ? [p.score.percent] : []))
  return (
    <div className={classes.tabs}>
      <SegmentedControl
        w={420}
        value={tab}
        onChange={(value) => setTab(value as BreakdownTab)}
        data={[{ value: 'scores', label: 'Gear scores' }, { value: 'rolls', label: 'Substat rolls' }, { value: 'none', label: 'None' }]}
      />
      {tab === 'scores' && (
        <div className={classes.tabPanel}>
          {breakdown.pieces.map((piece) => (
            <div key={piece.key} className={classes.breakdownRow}>
              <span>{piece.label}</span>
              <div className={classes.bar}>
                <div style={{ width: `${Math.min(100, piece.score?.percent ?? 0)}%` }} />
              </div>
              <span className={classes.breakdownValue}>{piece.score ? `${piece.score.percent.toFixed(1)} (${piece.score.rating})` : '-'}</span>
            </div>
          ))}
          {scored.length > 0 && (
            <Text size='xs' c='dimmed'>
              {`Average ${(scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1)}% of a perfect piece for this character, each grade 5%.`}
            </Text>
          )}
        </div>
      )}
      {tab === 'rolls' && (
        <div className={classes.tabPanel}>
          {rolls.map((roll) => (
            <div key={roll.stat} className={classes.breakdownRow} data-unwanted={roll.weight <= 0 || undefined}>
              <span>{roll.label}</span>
              <div className={classes.bar}>
                <div style={{ width: `${(roll.rolls / most) * 100}%` }} />
              </div>
              <span className={classes.breakdownValue}>{`${roll.rolls.toFixed(roll.rolls % 1 ? 1 : 0)} · weight ${roll.weight}`}</span>
            </div>
          ))}
          <Text size='xs' c='dimmed'>
            {`${total.toFixed(total % 1 ? 1 : 0)} ${breakdown.rollUnit} in all, ${
              useful.toFixed(1)
            } of them weighted toward stats this character wants (faded stats count for nothing).`}
          </Text>
        </div>
      )}
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

// Substat rolls added up per stat over the gear, for the Substat rolls tab
export function sumRolls(
  substats: { stat: string, rolls: number }[],
  label: (stat: string) => string,
  weights: Record<string, number>,
): ShowcaseBreakdown['rolls'] {
  const totals = new Map<string, number>()
  for (const sub of substats) totals.set(sub.stat, (totals.get(sub.stat) ?? 0) + sub.rolls)
  return [...totals].map(([stat, rolls]) => ({ stat, label: label(stat), rolls: Math.round(rolls * 10) / 10, weight: weights[stat] ?? 0 }))
}
