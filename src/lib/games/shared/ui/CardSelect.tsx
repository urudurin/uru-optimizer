import {
  CloseButton,
  Flex,
  type MantineSize,
  Modal,
  Text,
  TextInput,
} from '@mantine/core'
import classes from 'lib/games/shared/ui/CardSelect.module.css'
import {
  generateRarityTags,
  SegmentedFilterRow,
} from 'lib/ui/selectors/CardSelectModalComponents'
import { SelectCardGrid } from 'lib/ui/selectors/SelectCardGrid'
import gridClasses from 'lib/ui/selectors/SelectCardGrid.module.css'
import {
  CHARACTER_MODAL_STYLES,
  LC_CARD_IMAGE_HEIGHT,
  LC_CARD_IMAGE_WIDTH,
  LC_CARD_IMAGE_X_OFFSET,
  LC_CARD_IMAGE_Y_OFFSET,
  LC_MODAL_STYLES,
  OVERLAY_SCROLLBAR_OPTIONS,
  SEARCH_INPUT_STYLES,
} from 'lib/ui/selectors/selectConstants'
import { useSelectModal } from 'lib/ui/selectors/useSelectModal'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import {
  type ReactElement,
  useMemo,
} from 'react'

// A picker that opens HSR's card-grid window (lib/ui/selectors/CharacterSelect.tsx, LightConeSelect.tsx): a search box,
// segmented filter rows and a grid of cards coloured by rarity. Used for the games' characters, weapons and sets.

export type CardOption = {
  id: string,
  label: string,
  // 5, 4 or 3 colour the card like HSR's; anything else leaves it plain
  rarity: number,
  image?: string,
  // What each filter row matches against, by filter key ('rarity' is filled in from rarity)
  tags?: Record<string, string>,
}

export type CardFilter = {
  key: string,
  tags: { key: string, display: ReactElement }[],
  flexBasis?: string,
}

// Text tags for a filter row: element names, weapon types, specialties
export function textTags(values: string[]): CardFilter['tags'] {
  return values.map((value) => ({ key: value, display: <Text size='xs' fw={600} className={classes.tagText}>{value}</Text> }))
}

// A filter row of text tags with every value the options have for that key, in this order when given
export function tagFilter(key: string, options: CardOption[], order: string[] = []): CardFilter {
  const values = [...new Set(options.flatMap((o) => o.tags?.[key] || []))]
  const rank = (v: string) => (order.includes(v) ? order.indexOf(v) : order.length)
  return { key, tags: textTags(values.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) }
}

// HSR's star tags (5, 4, 3 stars) as a filter row
export function rarityFilter(rarities: number[] = [5, 4, 3]): CardFilter {
  return {
    key: 'rarity',
    tags: generateRarityTags().filter((tag) => rarities.includes(tag.key)).map((tag) => ({ key: String(tag.key), display: tag.display })),
  }
}

// A card with no art shows its name on a plain card instead of a broken image
const NO_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

type Filters = Record<string, string[]> & { name: string }

export function CardSelect({ label, value, options, onChange, filters = [], title, placeholder, clearable, wide, disabled, size }: {
  label?: string,
  value: string | null,
  options: CardOption[],
  onChange: (id: string | null) => void,
  filters?: CardFilter[],
  title: string,
  placeholder?: string,
  clearable?: boolean,
  // Character-sized window (HSR's CharacterSelect) instead of the light cone one
  wide?: boolean,
  disabled?: boolean,
  size?: MantineSize,
}) {
  const defaultFilters = useMemo(() => ({ name: '', ...Object.fromEntries(filters.map((f) => [f.key, []])) }) as Filters, [filters])
  const { isOpen, open, close, inputRef, filters: current, setNameFilter, updateFilter } = useSelectModal<Filters>({ defaultFilters })

  const shown = useMemo(() =>
    options.filter((option) => {
      if (!option.label.toLowerCase().includes(current.name)) return false
      return filters.every((filter) => {
        const picked = current[filter.key] ?? []
        const tag = filter.key === 'rarity' ? String(option.rarity) : option.tags?.[filter.key]
        return picked.length === 0 || (tag !== undefined && picked.includes(tag))
      })
    }), [options, filters, current])

  const selected = options.find((o) => o.id === value)
  const images = useMemo(() => new Map(options.map((o) => [o.id, o.image || NO_IMAGE])), [options])

  function pick(id: string) {
    onChange(id)
    close()
  }

  return (
    <>
      <TextInput
        readOnly
        size={size}
        label={label}
        disabled={disabled}
        value={selected?.label ?? ''}
        placeholder={placeholder}
        onClick={disabled ? undefined : open}
        leftSection={selected?.image ? <img src={selected.image} alt='' className={classes.icon} /> : null}
        rightSectionPointerEvents={clearable && value ? 'all' : 'none'}
        rightSection={clearable && value
          ? (
            <CloseButton
              size='xs'
              aria-label={`Clear ${label ?? title}`}
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
            />
          )
          : null}
        styles={{ input: { cursor: disabled ? undefined : 'pointer', textOverflow: 'ellipsis' } }}
      />

      <Modal opened={isOpen} onClose={close} centered size='90%' styles={wide ? CHARACTER_MODAL_STYLES : LC_MODAL_STYLES} title={title}>
        {isOpen && (
          <div className={gridClasses.modalContent}>
            <Flex gap={12} wrap='wrap'>
              <TextInput
                className={gridClasses.searchInput}
                styles={SEARCH_INPUT_STYLES}
                placeholder='Search'
                ref={inputRef}
                autoFocus
                onChange={setNameFilter}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && shown[0]) pick(shown[0].id)
                }}
              />
              {filters.map((filter) => (
                <Flex key={filter.key} wrap='wrap' className={gridClasses.filterWrapper}>
                  <SegmentedFilterRow
                    tags={filter.tags}
                    flexBasis={filter.flexBasis ?? `${100 / filter.tags.length}%`}
                    currentFilter={current[filter.key] ?? []}
                    setCurrentFilters={(next) => updateFilter(filter.key, next)}
                  />
                </Flex>
              ))}
            </Flex>

            <OverlayScrollbarsComponent className={gridClasses.scrollArea} defer options={OVERLAY_SCROLLBAR_OPTIONS}>
              {shown.length === 0
                ? <Text size='sm' c='dimmed'>Nothing matches.</Text>
                : (
                  <SelectCardGrid
                    options={shown}
                    onSelect={pick}
                    getImageSrc={(id) => images.get(id) ?? NO_IMAGE}
                    cardImageHeight={LC_CARD_IMAGE_HEIGHT}
                    imageWidth={LC_CARD_IMAGE_WIDTH}
                    imageXOffset={LC_CARD_IMAGE_X_OFFSET}
                    imageYOffset={LC_CARD_IMAGE_Y_OFFSET}
                    textRows={2}
                  />
                )}
            </OverlayScrollbarsComponent>
          </div>
        )}
      </Modal>
    </>
  )
}
