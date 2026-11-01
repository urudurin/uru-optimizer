import {
  Button,
  Group,
  Select,
  Text,
} from '@mantine/core'
import {
  IconEdit,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import type {
  ColDef,
  GridApi,
  IRowNode,
  RowDoubleClickedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import type {
  GearDraft,
  GearKind,
} from 'lib/games/shared/gear/gearKind'
import {
  readStorage,
  writeStorage,
} from 'lib/games/shared/storage'
import { confirmAction } from 'lib/games/shared/ui/confirm'
import {
  GearEditor,
  imageFromClipboard,
} from 'lib/games/shared/ui/gear/GearEditor'
import classes from 'lib/games/shared/ui/gear/GearInventory.module.css'
import { useGridLocale } from 'lib/hooks/useGridLocale'
import { Message } from 'lib/interactions/message'
import { Gradient } from 'lib/rendering/gradient'
import { defaultRelicsGridColDefs } from 'lib/tabs/tabRelics/columnDefs'
import { FilterPill } from 'lib/tabs/tabRelics/topBar/FilterPill'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

// The gear inventory shared by ZZZ discs, Genshin artifacts and WuWa echoes, after Fribbels' HSR relics tab
// (lib/tabs/tabRelics): filter pills on top (HSR's FilterPill), an ag-grid with one coloured column per substat, and a
// dock below with the selected piece and Add / Edit / Delete (shared/ui/gear/GearEditor.tsx). Each game describes its
// gear once (shared/gear/gearKind.ts).

type Row<T> = {
  id: string,
  item: T,
  owner: string,
  set: string,
  slot: string,
  rarity: string,
  level: number,
  mainStat: string,
  mainValue: string,
  subs: Partial<Record<string, number>>,
  critValue: number,
  score?: number,
  rating?: string,
  // The score once fully levelled (HSR's Avg / Max potential), for the picked character or the wearer
  avgPotential?: number,
  maxPotential?: number,
}

type Filters = {
  slot: string[],
  mainStat: string[],
  substat: string[],
  set: string[],
  rarity: string[],
  level: string[],
  equipped: string[],
}

const NO_FILTERS: Filters = { slot: [], mainStat: [], substat: [], set: [], rarity: [], level: [], equipped: [] }

export function GearInventory<T extends { id: string }>({ kind, items, onSave, onDelete }: {
  kind: GearKind<T>,
  items: T[],
  // owner from the editor's Equipped by: a character id, or null for nobody
  onSave: (item: T, owner: string | null) => void,
  onDelete: (ids: string[]) => void,
}) {
  const gridRef = useRef<AgGridReact<Row<T>>>(null)
  const { getLocaleText } = useGridLocale('relicsTab', 'RelicGrid')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selected, setSelected] = useState<T[]>([])
  const [editing, setEditing] = useState<{ item?: T, draft: GearDraft, screenshot?: Blob } | undefined>()

  // A screenshot pasted on the page opens the Add dialog filled in from it (the dialog handles pastes while open)
  useEffect(() => {
    if (!kind.screenshot || editing) return
    const onPaste = (event: ClipboardEvent) => {
      const screenshot = imageFromClipboard(event)
      if (!screenshot) return
      event.preventDefault()
      setEditing({ draft: kind.newDraft(), screenshot })
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [kind, editing])
  const [shownCount, setShownCount] = useState(items.length)
  // Score for (HSR's Relics tab "Relic recommendation character"): '' scores each piece for whoever wears it
  const owners = useMemo(() => kind.owners?.() ?? [], [kind])
  const [scoreFor, setScoreFor] = useState('')
  const scoredFor = owners.some((o) => o.value === scoreFor) ? scoreFor : ''
  // Recently updated (HSR's Recently updated relics): pieces saved in the editor, newest first, kept per gear kind
  const recentKey = `uru-recent-${kind.noun.toLowerCase()}`
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(readStorage(recentKey) ?? '[]')
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
    } catch {
      return []
    }
  })
  const noteRecent = (id: string) => {
    const next = [id, ...recentIds.filter((x) => x !== id)].slice(0, RECENT_SHOWN)
    setRecentIds(next)
    writeStorage(recentKey, JSON.stringify(next))
  }

  const rows = useMemo<Row<T>[]>(() =>
    items.map((item) => {
      const subs = kind.substatValues(item)
      const owner = kind.ownerOf(item)
      const score = scoredFor && kind.scoreFor ? kind.scoreFor(item, scoredFor) : kind.score(item)
      const scorer = scoredFor || owner
      const potential = scorer ? kind.potentialFor?.(item, scorer) : undefined
      return {
        id: item.id,
        item,
        owner: owner ? kind.ownerName(owner) : '',
        set: kind.setName(item),
        slot: kind.slotOf(item),
        rarity: kind.rarityOf(item),
        level: kind.levelOf(item),
        mainStat: kind.mainStatOf(item),
        mainValue: kind.mainValueText(item),
        subs,
        critValue: 2 * (subs.critRate ?? subs['CRIT Rate'] ?? 0) + (subs.critDmg ?? subs['CRIT DMG'] ?? 0),
        score: score?.percent,
        rating: score?.rating,
        avgPotential: potential?.avg,
        maxPotential: potential?.max,
      }
    }), [items, kind, scoredFor])

  const slotLabel = useCallback((value: string) => kind.slots.find((s) => s.value === value)?.label ?? value, [kind])

  const columnDefs = useMemo<ColDef<Row<T>>[]>(() => {
    const gradient = (top: number) => (params: { value: number | undefined }) => params.value ? Gradient.getRelicGradientStyle(params.value / top) : undefined
    return [
      { field: 'owner', headerName: 'Owner', width: 92 },
      {
        field: 'set',
        headerName: 'Set',
        width: 150,
        cellRenderer: (p: { data?: Row<T> }) => {
          const icon = p.data ? kind.setIcon?.(p.data.item) : undefined
          return (
            <span className={classes.setCell}>
              {icon && <img src={icon} alt='' />}
              <span>{p.data?.set}</span>
            </span>
          )
        },
      },
      { field: 'rarity', headerName: '★', width: 40 },
      { field: 'level', headerName: '+', width: 42 },
      { field: 'slot', headerName: 'Slot', width: 62, valueFormatter: (p) => slotLabel(String(p.value)) },
      { field: 'mainStat', headerName: 'Main Stat', width: 108, valueFormatter: (p) => kind.statLabel(String(p.value)) },
      { field: 'mainValue', headerName: 'Main Value', width: 64, sortable: false },
      ...kind.substats.map((stat): ColDef<Row<T>> => ({
        colId: `sub:${stat.value}`,
        headerName: stat.label,
        valueGetter: (p) => p.data?.subs[stat.value] ?? 0,
        valueFormatter: (p) => (p.value ? kind.formatValue(stat.value, p.value) : ''),
        cellStyle: gradient(kind.columnTop(stat.value)),
        width: 58,
      })),
      {
        field: 'critValue',
        headerName: 'Crit Value',
        width: 58,
        valueFormatter: (p) => (p.value ? (Math.round(p.value * 10) / 10).toFixed(1) : ''),
        cellStyle: gradient(40),
      },
      {
        field: 'score',
        headerName: 'Score',
        width: 72,
        valueFormatter: (p) => (p.value === undefined ? '' : `${p.value.toFixed(0)}% ${p.data?.rating ?? ''}`),
        cellStyle: gradient(85),
      },
      ...(kind.potentialFor
        ? [
          {
            field: 'avgPotential',
            headerName: 'Avg potential',
            width: 66,
            valueFormatter: (p: { value?: number }) => (p.value === undefined ? '' : `${p.value.toFixed(0)}%`),
            cellStyle: gradient(85),
          } as ColDef<Row<T>>,
          {
            field: 'maxPotential',
            headerName: 'Max potential',
            width: 66,
            valueFormatter: (p: { value?: number }) => (p.value === undefined ? '' : `${p.value.toFixed(0)}%`),
            cellStyle: gradient(85),
          } as ColDef<Row<T>>,
        ]
        : []),
    ]
  }, [kind, slotLabel])

  // Filters, like HSR's: every non-empty filter must match; substats must all be present
  const isExternalFilterPresent = useCallback(() => Object.values(filters).some((values) => values.length > 0), [filters])
  const doesExternalFilterPass = useCallback((node: IRowNode<Row<T>>) => {
    const row = node.data
    if (!row) return false
    if (filters.slot.length && !filters.slot.includes(row.slot)) return false
    if (filters.mainStat.length && !filters.mainStat.includes(row.mainStat)) return false
    if (filters.set.length && !filters.set.includes(kind.setOf(row.item))) return false
    if (filters.rarity.length && !filters.rarity.includes(row.rarity)) return false
    if (filters.level.length && !filters.level.some((bucket) => inLevelBucket(row.level, bucket))) return false
    if (filters.equipped.length && !filters.equipped.includes(row.owner ? 'yes' : 'no')) return false
    if (filters.substat.length && !filters.substat.every((stat) => (row.subs[stat] ?? 0) > 0)) return false
    return true
  }, [filters, kind])

  const onFilterChanged = () => setShownCount(gridRef.current?.api.getDisplayedRowCount() ?? 0)
  const setFilter = (key: keyof Filters) => (values: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: values }))
    // ag-grid reads the new filter on its next pass
    setTimeout(() => {
      gridRef.current?.api.onFilterChanged()
      onFilterChanged()
    })
  }

  const levelBuckets = useMemo(() => {
    const top = Math.max(...items.map((item) => kind.levelOf(item)), kind.maxLevel(kind.newDraft()))
    const step = top > 20 ? 5 : top > 15 ? 4 : 3
    const buckets: string[] = []
    for (let from = 0; from <= top; from += step) buckets.push(`${from}-${Math.min(from + step - 1, top)}`)
    return buckets
  }, [items, kind])

  const allMainStats = useMemo(() => {
    const stats = new Set(items.map((item) => kind.mainStatOf(item)))
    return [...stats].map((value) => ({ value, label: kind.statLabel(value) })).sort((a, b) => a.label.localeCompare(b.label))
  }, [items, kind])

  const preview = selected.length === 1 ? selected[0] : undefined

  // HSR's Top 10 insight: the characters this piece is among the 10 best of its slot for
  const topFor = useMemo(() => {
    if (!preview || !kind.scoreFor || owners.length === 0) return []
    const slot = kind.slotOf(preview)
    const sameSlot = items.filter((item) => kind.slotOf(item) === slot)
    return owners.flatMap((owner) => {
      const mine = kind.scoreFor!(preview, owner.value)?.percent
      if (mine === undefined) return []
      const better = sameSlot.filter((item) => (kind.scoreFor!(item, owner.value)?.percent ?? 0) > mine).length
      return better < 10 ? [{ name: owner.label, rank: better + 1, score: mine }] : []
    }).sort((a, b) => a.rank - b.rank || b.score - a.score)
  }, [preview, items, kind, owners])

  // Who a piece scores best for, among everyone who can wear it
  const bestFor = (item: T) => {
    if (!kind.scoreFor) return undefined
    let best: { name: string, score: number } | undefined
    for (const owner of owners) {
      const score = kind.scoreFor(item, owner.value)?.percent
      if (score !== undefined && (!best || score > best.score)) best = { name: owner.label, score }
    }
    return best
  }
  const recent = recentIds.flatMap((id) => rows.find((row) => row.id === id) ?? [])

  return (
    <div className={classes.inventory}>
      <div className={classes.filters}>
        <FilterPill label='Slot' options={kind.slots} selected={filters.slot} onChange={setFilter('slot')} />
        <FilterPill label='Main stats' options={allMainStats} selected={filters.mainStat} onChange={setFilter('mainStat')} />
        <FilterPill label='Substats' options={kind.substats} selected={filters.substat} onChange={setFilter('substat')} />
        <FilterPill label='Sets' options={kind.sets()} selected={filters.set} onChange={setFilter('set')} searchable />
        <FilterPill
          label='Level'
          options={levelBuckets.map((value) => ({ value, label: `+${value}` }))}
          selected={filters.level}
          onChange={setFilter('level')}
        />
        {kind.rarities.length > 1 && <FilterPill label='Rarity' options={kind.rarities} selected={filters.rarity} onChange={setFilter('rarity')} />}
        <FilterPill
          label='Equipped'
          options={[{ value: 'yes', label: 'Equipped' }, { value: 'no', label: 'Not equipped' }]}
          selected={filters.equipped}
          onChange={setFilter('equipped')}
        />
        <Button size='xs' variant='subtle' onClick={() => Object.keys(NO_FILTERS).forEach((key) => setFilter(key as keyof Filters)([]))}>Clear</Button>
        {kind.scoreFor && owners.length > 0 && (
          <Select
            size='xs'
            ml='auto'
            w={200}
            searchable
            allowDeselect={false}
            aria-label='Score for'
            value={scoredFor}
            onChange={(value) => setScoreFor(value ?? '')}
            data={[{ value: '', label: 'Score for: whoever wears it' }, ...owners.map((o) => ({ value: o.value, label: `Score for: ${o.label}` }))]}
          />
        )}
      </div>

      {recent.length > 0 && (
        <div className={classes.recent}>
          <Text size='xs' fw={600} c='dimmed' tt='uppercase'>Recently updated</Text>
          <div className={classes.recentList}>
            {recent.map((row) => {
              const best = bestFor(row.item)
              return (
                <button
                  key={row.id}
                  type='button'
                  className={classes.recentItem}
                  onClick={() => gridRef.current?.api.getRowNode(row.id)?.setSelected(true, true)}
                >
                  <Text size='xs' fw={600} truncate>{`${row.set} · ${slotLabel(row.slot)}`}</Text>
                  <Text size='xs' c='dimmed' truncate>{`+${row.level} ${kind.statLabel(row.mainStat)}`}</Text>
                  <Text size='xs'>
                    {[
                      row.score !== undefined ? `Score ${row.score.toFixed(0)}%` : '',
                      row.avgPotential !== undefined ? `Avg ${row.avgPotential.toFixed(0)}%` : '',
                      row.maxPotential !== undefined ? `Max ${row.maxPotential.toFixed(0)}%` : '',
                    ].filter(Boolean).join(' · ')}
                  </Text>
                  {best && <Text size='xs' c='dimmed' truncate>{`Best for ${best.name}`}</Text>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className={`ag-theme-balham-dark ${classes.grid}`}>
        <AgGridReact<Row<T>>
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          // HSR's relics grid column defaults (lib/tabs/tabRelics/columnDefs.ts), header style included
          defaultColDef={defaultRelicsGridColDefs as unknown as ColDef<Row<T>>}
          getLocaleText={getLocaleText}
          getRowId={(p) => p.data.id}
          rowHeight={33}
          headerHeight={48}
          isExternalFilterPresent={isExternalFilterPresent}
          doesExternalFilterPass={doesExternalFilterPass}
          rowSelection={{ mode: 'multiRow', checkboxes: false, headerCheckbox: false, enableClickSelection: true }}
          onSelectionChanged={(e: SelectionChangedEvent<Row<T>>) => setSelected(e.api.getSelectedRows().map((row) => row.item))}
          onRowDoubleClicked={(e: RowDoubleClickedEvent<Row<T>>) => e.data && setEditing({ item: e.data.item, draft: kind.toDraft(e.data.item) })}
          onRowDataUpdated={(e: { api: GridApi<Row<T>> }) => setShownCount(e.api.getDisplayedRowCount())}
        />
      </div>

      <div className={classes.dock}>
        <div className={classes.preview}>
          {preview ? kind.preview(preview) : <Text size='sm' c='dimmed'>{`Select a ${kind.noun.toLowerCase()} to see it here`}</Text>}
          {preview && kind.scoreFor && (
            <Text size='xs' c='dimmed' mt={6}>
              {topFor.length > 0
                ? `Top 10 of its slot for: ${topFor.slice(0, 6).map((t) => `${t.name} #${t.rank}`).join(', ')}${
                  topFor.length > 6 ? ` and ${topFor.length - 6} more` : ''
                }`
                : 'Not in the top 10 of its slot for anyone'}
            </Text>
          )}
        </div>
        <Group gap='xs' align='flex-start'>
          <Button size='xs' leftSection={<IconPlus size={14} />} onClick={() => setEditing({ draft: kind.newDraft() })}>
            {`Add new ${kind.noun.toLowerCase()}`}
          </Button>
          <Button
            size='xs'
            variant='light'
            leftSection={<IconEdit size={14} />}
            disabled={!preview}
            onClick={() => preview && setEditing({ item: preview, draft: kind.toDraft(preview) })}
          >
            {`Edit ${kind.noun.toLowerCase()}`}
          </Button>
          <Button
            size='xs'
            variant='light'
            color='red'
            leftSection={<IconTrash size={14} />}
            disabled={selected.length === 0}
            onClick={async () => {
              const noun = selected.length === 1 ? kind.noun.toLowerCase() : `${kind.noun.toLowerCase()}s`
              const ok = await confirmAction(
                `Delete ${noun}`,
                `Delete ${
                  selected.length === 1 ? 'the selected' : `the ${selected.length} selected`
                } ${noun} from this browser's save? Whoever wears them loses them.`,
                { danger: true, confirmLabel: 'Delete' },
              )
              if (!ok) return
              onDelete(selected.map((item) => item.id))
              setSelected([])
              Message.success(`Deleted ${selected.length} ${noun}`)
            }}
          >
            {selected.length > 1 ? `Delete ${selected.length}` : 'Delete'}
          </Button>
          <Text size='xs' c='dimmed' ml='auto'>
            {`${shownCount} of ${items.length} shown · double-click a row to edit${kind.screenshot ? ' · paste a screenshot (Ctrl+V) to add one' : ''}`}
          </Text>
        </Group>
      </div>

      {editing && (
        <GearEditor
          kind={kind}
          existing={editing.item}
          initial={editing.draft}
          screenshot={editing.screenshot}
          onClose={() => setEditing(undefined)}
          onSave={(item, owner) => {
            onSave(item, owner)
            noteRecent(item.id)
            Message.success(editing.item ? `Saved the ${kind.noun.toLowerCase()}` : `Added the ${kind.noun.toLowerCase()}`)
            setEditing(undefined)
          }}
        />
      )}
    </div>
  )
}

// Recently updated pieces shown above the grid
const RECENT_SHOWN = 6

function inLevelBucket(level: number, bucket: string): boolean {
  const [from, to] = bucket.split('-').map(Number)
  return level >= from && level <= to
}
