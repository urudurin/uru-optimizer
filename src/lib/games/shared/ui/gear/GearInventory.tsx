import {
  Button,
  Group,
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
import { GearEditor } from 'lib/games/shared/ui/gear/GearEditor'
import classes from 'lib/games/shared/ui/gear/GearInventory.module.css'
import { Gradient } from 'lib/rendering/gradient'
import { FilterPill } from 'lib/tabs/tabRelics/topBar/FilterPill'
import {
  useCallback,
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
  onSave: (item: T) => void,
  onDelete: (ids: string[]) => void,
}) {
  const gridRef = useRef<AgGridReact<Row<T>>>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selected, setSelected] = useState<T[]>([])
  const [editing, setEditing] = useState<{ item?: T, draft: GearDraft } | undefined>()
  const [shownCount, setShownCount] = useState(items.length)

  const rows = useMemo<Row<T>[]>(() =>
    items.map((item) => {
      const subs = kind.substatValues(item)
      const owner = kind.ownerOf(item)
      const score = kind.score(item)
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
      }
    }), [items, kind])

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
      </div>

      <div className={`ag-theme-balham-dark ${classes.grid}`}>
        <AgGridReact<Row<T>>
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, wrapHeaderText: true, autoHeaderHeight: true, suppressHeaderMenuButton: true, sortingOrder: ['desc', 'asc'] }}
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
            onClick={() => {
              const noun = selected.length === 1 ? kind.noun.toLowerCase() : `${kind.noun.toLowerCase()}s`
              if (window.confirm(`Delete ${selected.length} ${noun} from this browser's save? Whoever wears them loses them.`)) {
                onDelete(selected.map((item) => item.id))
                setSelected([])
              }
            }}
          >
            {selected.length > 1 ? `Delete ${selected.length}` : 'Delete'}
          </Button>
          <Text size='xs' c='dimmed' ml='auto'>{`${shownCount} of ${items.length} shown · double-click a row to edit`}</Text>
        </Group>
      </div>

      {editing && (
        <GearEditor
          kind={kind}
          existing={editing.item}
          initial={editing.draft}
          onClose={() => setEditing(undefined)}
          onSave={(item) => {
            onSave(item)
            setEditing(undefined)
          }}
        />
      )}
    </div>
  )
}

function inLevelBucket(level: number, bucket: string): boolean {
  const [from, to] = bucket.split('-').map(Number)
  return level >= from && level <= to
}
