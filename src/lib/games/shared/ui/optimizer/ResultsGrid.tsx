import type {
  CellClassParams,
  ColDef,
  RowClickedEvent,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import chroma from 'chroma-js'
import classes from 'lib/games/shared/ui/optimizer/OptimizerResults.module.css'
import { useMemo } from 'react'

// The optimizer results of all three games, after Fribbels' HSR optimizer grid (lib/tabs/tabOptimizer/optimizerForm/
// grid/OptimizerGrid.tsx): an ag-grid with one column per stat, each coloured from its worst to its best value among the
// results (HSR's red-to-green scale), the build the character wears now pinned on top, and a click picks a build.

export type ResultColumn = {
  key: string,
  label: string,
  format: (value: number) => string,
  // The stat the results are ranked by: drawn in the accent colour
  primary?: boolean,
  width?: number,
}

export type ResultRow = {
  id: string,
  // '1', '2' ... for results, 'Now' for the current build
  rank: string,
  values: Record<string, number>,
  sets: string,
}

// HSR's optimizer grid gradient (lib/rendering/gradient.ts optimizerGridGradient): worst, middle, best
const NEUTRAL = 0.35
const gradient = chroma.scale(['#5A1A06', '#343127', '#38821F']).domain([0, NEUTRAL, 1])

export function ResultsGrid({ columns, rows, current, selected, onSelect }: {
  columns: ResultColumn[],
  rows: ResultRow[],
  current?: ResultRow,
  selected: number,
  onSelect: (index: number) => void,
}) {
  // Each column's range among the results, for its colours
  const ranges = useMemo(() => {
    const out: Record<string, { min: number, max: number }> = {}
    for (const column of columns) {
      const values = rows.map((row) => row.values[column.key]).filter((v) => Number.isFinite(v))
      if (values.length) out[column.key] = { min: Math.min(...values), max: Math.max(...values) }
    }
    return out
  }, [columns, rows])

  const columnDefs = useMemo<ColDef<ResultRow>[]>(() => [
    { field: 'rank', headerName: '#', width: 52, sortable: false, pinned: 'left' },
    ...columns.map((column): ColDef<ResultRow> => ({
      colId: column.key,
      headerName: column.label,
      valueGetter: (p) => p.data?.values[column.key],
      valueFormatter: (p) => (p.value === undefined ? '' : column.format(p.value)),
      width: column.width ?? 92,
      headerClass: column.primary ? classes.primaryHeader : undefined,
      cellClass: column.primary ? classes.primaryCell : undefined,
      cellStyle: (p: CellClassParams<ResultRow>) => {
        const range = ranges[column.key]
        if (!range || p.value === undefined || p.node.rowPinned) return undefined
        // A column where every result is the same stays the neutral middle colour
        const fraction = range.max === range.min ? NEUTRAL : (p.value - range.min) / (range.max - range.min)
        return { '--cell-bg': gradient(fraction).hex() }
      },
    })),
    { field: 'sets', headerName: 'Sets', flex: 1, minWidth: 220, sortable: false },
  ], [columns, ranges])

  return (
    <div className={`ag-theme-balham-dark ${classes.grid}`}>
      <AgGridReact<ResultRow>
        rowData={rows}
        pinnedTopRowData={current ? [current] : undefined}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, suppressHeaderMenuButton: true, sortingOrder: ['desc', 'asc', null], wrapHeaderText: true, autoHeaderHeight: true }}
        getRowId={(p) => p.data.id}
        rowHeight={30}
        headerHeight={44}
        rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
        onFirstDataRendered={(e) => e.api.getDisplayedRowAtIndex(selected)?.setSelected(true)}
        onRowClicked={(e: RowClickedEvent<ResultRow>) => {
          if (e.node.rowPinned || !e.data) return
          onSelect(rows.indexOf(e.data))
        }}
      />
    </div>
  )
}
