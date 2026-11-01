import { Text } from '@mantine/core'
import { RECHARTS_TOOLTIP_WRAPPER_STYLE } from 'lib/constants/constantsUi'
import {
  damageByGroup,
  type DamagePart,
} from 'lib/games/shared/damageBreakdown'
import { chartColor } from 'lib/tabs/tabOptimizer/analysis/damageSplitsExtractor'
import {
  localeNumberComma,
  renderThousandsK,
} from 'lib/utils/i18nUtils'
import {
  type CSSProperties,
  useMemo,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  type LabelProps,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// The build analysis's damage charts, after HSR's Combo Breakdown (lib/tabs/tabOptimizer/analysis/DamageSplitsChart.tsx)
// and Combo Distribution (DamageTagPieChart.tsx): a bar per rotation line coloured by its group, and a pie of the groups
// with their damage and share. Fed by shared/damageBreakdown.ts splitDamage, so all three games draw the same charts.

// HSR's damage tag colours (damageSplitsExtractor.ts), handed out to the groups in order of damage
const GROUP_COLORS = ['#609CC6', '#A686BA', '#78A8C4', '#50A290', '#D8B26C', '#56AA78', '#C88E64', '#B8685E', '#9C96BC', '#D28AA4', '#87CEEB']
const OTHER_COLOR = '#888888'

const SHOWN_LINES = 12
const BAR_HEIGHT = 40
const CHART_PADDING = 60
const LABEL_WIDTH = 210
const LABEL_CHARS = 30
const PIE_SIZE = 240

const TOOLTIP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--layer-3)',
  border: '1px solid var(--border-default)',
  padding: 8,
  borderRadius: 'var(--radius-sm)',
}

const CARD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  background: 'var(--layer-2)',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-card-flat)',
  borderRadius: 6,
  padding: '10px 12px',
  minWidth: 0,
}

type BarRow = { name: string, title: string, group: string, damage: number, color: string }
type Slice = { group: string, damage: number, share: number, color: string }

function groupColors(parts: DamagePart[]): Map<string, string> {
  return new Map(damageByGroup(parts).map((g, i) => [g.group, GROUP_COLORS[i % GROUP_COLORS.length]]))
}

function shortLabel(text: string) {
  return text.length > LABEL_CHARS ? `${text.slice(0, LABEL_CHARS - 1)}…` : text
}

function formatShare(share: number) {
  return `${(share * 100).toFixed(1)}%`
}

function ChartTitle({ children }: { children: string }) {
  return (
    <span style={{ fontSize: 15, color: chartColor, borderBottom: '1px solid var(--border-default)', paddingBottom: 4 }}>
      {children}
    </span>
  )
}

// Numbered like HSR's rows, with the number dimmed; long line names are cut short with the full name on hover
function LineTick({ x, y, payload, rows }: { x?: number | string, y?: number | string, payload?: { value: string }, rows: BarRow[] }) {
  const row = rows.find((r) => r.name === payload?.value)
  if (!row) return null
  const [num, ...rest] = row.name.split('. ')
  return (
    <text x={Number(x) - LABEL_WIDTH + 8} y={Number(y)} textAnchor='start' fontSize={12} fontWeight={300} dominantBaseline='central'>
      <title>{row.title}</title>
      <tspan fill='#667'>{`${num}. `}</tspan>
      <tspan fill={chartColor}>{shortLabel(rest.join('. '))}</tspan>
    </text>
  )
}

function BarTooltip({ active, payload }: { active?: boolean, payload?: { payload?: BarRow }[] }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className='pre-font' style={TOOLTIP_STYLE}>
      <span style={{ fontSize: 14, fontWeight: 'bold' }}>{row.title}</span>
      <span style={{ color: row.color }}>{row.group}</span>
      <span>{localeNumberComma(Math.floor(row.damage))}</span>
    </div>
  )
}

export function ComboBreakdown({ parts }: { parts: DamagePart[] }) {
  const { t } = useTranslation('games', { keyPrefix: 'DamageCharts' })
  const { rows, maxDamage } = useMemo(() => {
    const colors = groupColors(parts)
    const shown = parts.slice(0, SHOWN_LINES)
    const rest = parts.slice(SHOWN_LINES)
    const rows: BarRow[] = shown.map((part, i) => {
      const title = part.count > 1 ? `${part.label} ×${part.count}` : part.label
      return {
        name: `${i + 1}. ${title}`,
        title: part.group ? `${part.group}: ${title}` : title,
        group: part.group,
        damage: part.damage,
        color: colors.get(part.group) ?? OTHER_COLOR,
      }
    })
    if (rest.length > 0) {
      const title = t('MoreLines', { count: rest.length })
      rows.push({ name: `${rows.length + 1}. ${title}`, title, group: t('Other'), damage: rest.reduce((sum, p) => sum + p.damage, 0), color: OTHER_COLOR })
    }
    return { rows, maxDamage: Math.max(0, ...rows.map((r) => r.damage)) }
  }, [parts, t])

  if (rows.length === 0) return null

  const renderLabel = (props: LabelProps) => {
    const value = Number(props.value ?? 0)
    if (!value) return null
    return (
      <text
        x={Number(props.x ?? 0) + Number(props.width ?? 0) + 8}
        y={Number(props.y ?? 0) + Number(props.height ?? 0) / 2}
        fill={chartColor}
        dominantBaseline='central'
        fontWeight={300}
        fontSize={13}
      >
        {renderThousandsK(value)}
      </text>
    )
  }

  return (
    <div className='pre-font' style={{ ...CARD_STYLE, flex: 2 }}>
      <ChartTitle>{t('Breakdown')}</ChartTitle>
      <div style={{ width: '100%', height: rows.length * BAR_HEIGHT + CHART_PADDING }}>
        <ResponsiveContainer>
          <BarChart layout='vertical' data={rows} margin={{ top: 10, right: 60, bottom: 10, left: 10 }} barCategoryGap='15%'>
            <XAxis
              type='number'
              domain={[0, maxDamage]}
              tick={{ fill: chartColor, fontWeight: 300, fontSize: 12 }}
              tickFormatter={(v: number) => renderThousandsK(v)}
            />
            <YAxis dataKey='name' type='category' axisLine={false} tickLine={false} width={LABEL_WIDTH} tick={<LineTick rows={rows} />} />
            <Tooltip
              content={<BarTooltip />}
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              isAnimationActive={false}
              wrapperStyle={RECHARTS_TOOLTIP_WRAPPER_STYLE}
            />
            <Bar dataKey='damage' isAnimationActive={false} activeBar={false}>
              {rows.map((row) => <Cell key={row.name} fill={row.color} />)}
              <LabelList dataKey='damage' position='right' content={renderLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SliceTooltip({ active, payload }: { active?: boolean, payload?: { payload?: Slice }[] }) {
  const slice = payload?.[0]?.payload
  if (!active || !slice) return null
  return (
    <div className='pre-font' style={TOOLTIP_STYLE}>
      <span style={{ fontSize: 14, fontWeight: 'bold' }}>{slice.group}</span>
      <span>{localeNumberComma(Math.floor(slice.damage))}</span>
      <span>{formatShare(slice.share)}</span>
    </div>
  )
}

const HEADER_CELL: CSSProperties = { textAlign: 'right', fontWeight: 400, fontSize: 12, color: '#6b7d99', paddingBottom: 6, whiteSpace: 'nowrap' }
const CELL: CSSProperties = { textAlign: 'right', fontSize: 13, paddingTop: 4, paddingBottom: 4 }
const FOOT_CELL: CSSProperties = { ...CELL, paddingTop: 6, borderTop: '1px solid var(--border-default)' }

export function ComboDistribution({ parts }: { parts: DamagePart[] }) {
  const { t } = useTranslation('games', { keyPrefix: 'DamageCharts' })
  const slices = useMemo(() => {
    const colors = groupColors(parts)
    const total = parts.reduce((sum, part) => sum + part.damage, 0)
    return damageByGroup(parts).map((g): Slice => ({ ...g, share: total > 0 ? g.damage / total : 0, color: colors.get(g.group) ?? OTHER_COLOR }))
  }, [parts])
  const total = slices.reduce((sum, s) => sum + s.damage, 0)

  if (total <= 0) return null

  return (
    <div className='pre-font' style={{ ...CARD_STYLE, flex: 1, minWidth: 260 }}>
      <ChartTitle>{t('Distribution')}</ChartTitle>
      <PieChart width={PIE_SIZE} height={PIE_SIZE}>
        <Pie
          data={slices}
          dataKey='damage'
          nameKey='group'
          cx='50%'
          cy='50%'
          outerRadius={100}
          innerRadius={42}
          cornerRadius={2}
          startAngle={90}
          endAngle={-270}
          stroke='var(--layer-2)'
          strokeWidth={2}
          isAnimationActive={false}
        >
          {slices.map((slice) => <Cell key={slice.group} fill={slice.color} />)}
        </Pie>
        <Tooltip content={<SliceTooltip />} isAnimationActive={false} wrapperStyle={RECHARTS_TOOLTIP_WRAPPER_STYLE} />
      </PieChart>
      <table style={{ alignSelf: 'stretch', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ width: '100%' }} />
            <th style={HEADER_CELL}>#</th>
            <th style={{ ...HEADER_CELL, paddingLeft: 20 }}>%</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr key={slice.group}>
              <td style={{ paddingTop: 4, paddingBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: slice.color, flexShrink: 0 }} />
                  <Text span size='13px' c={chartColor}>{slice.group}</Text>
                </div>
              </td>
              <td style={{ ...CELL, color: chartColor }}>{localeNumberComma(Math.floor(slice.damage))}</td>
              <td style={{ ...CELL, color: '#8899aa', paddingLeft: 20 }}>{formatShare(slice.share)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...FOOT_CELL, textAlign: 'left', color: '#8899aa', paddingLeft: 18 }}>{t('Total')}</td>
            <td style={{ ...FOOT_CELL, color: chartColor }}>{localeNumberComma(Math.floor(total))}</td>
            <td style={{ ...FOOT_CELL, color: '#8899aa', paddingLeft: 20 }}>100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
