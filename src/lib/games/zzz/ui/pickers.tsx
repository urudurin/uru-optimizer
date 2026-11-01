import type { MantineSize } from '@mantine/core'
import {
  type CardOption,
  CardSelect,
  tagFilter,
} from 'lib/games/shared/ui/CardSelect'
import { AGENTS } from 'lib/games/zzz/data/agents'
import type { ZzzImages } from 'lib/games/zzz/data/images'
import { W_ENGINES } from 'lib/games/zzz/data/wEngines'
import { useMemo } from 'react'

// ZZZ agent and W-Engine pickers on HSR's card-grid window (shared/ui/CardSelect.tsx). Ranks S / A / B colour the cards
// like HSR's 5 / 4 / 3 stars

const RANK_RARITY: Record<string, number> = { S: 5, A: 4, B: 3 }
const RANK_ORDER = ['S', 'A', 'B']

export function ZzzAgentSelect({ images, value, onChange, label }: {
  images: ZzzImages,
  value: string,
  onChange: (agentId: string) => void,
  label?: string,
}) {
  const options = useMemo<CardOption[]>(() =>
    Object.values(AGENTS)
      .map((agent) => {
        const rank = images.agentInfo[agent.id]?.rank ?? ''
        return {
          id: agent.id,
          label: agent.name,
          rarity: RANK_RARITY[rank] ?? 0,
          image: images.agents[agent.id]?.circle,
          tags: { element: agent.element, specialty: agent.specialty, rank },
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label)), [images])
  const filters = useMemo(() => [tagFilter('element', options), tagFilter('specialty', options), tagFilter('rank', options, RANK_ORDER)], [options])
  return (
    <CardSelect
      wide
      label={label}
      title='Select an agent'
      value={value}
      options={options}
      filters={filters}
      onChange={(id) => id && onChange(id)}
    />
  )
}

// Every W-Engine (any agent can equip any of them; passives need the matching specialty); clearing it leaves none
export function ZzzWEngineSelect({ images, value, onChange, label = 'W-Engine', size }: {
  images: ZzzImages,
  value: string | null,
  onChange: (id: string | null) => void,
  label?: string,
  size?: MantineSize,
}) {
  const options = useMemo<CardOption[]>(() =>
    Object.values(W_ENGINES)
      .map((engine) => ({
        id: engine.id,
        label: engine.name,
        rarity: RANK_RARITY[engine.rarity] ?? 0,
        image: images.wEngines[engine.id],
        tags: { specialty: engine.specialty, rank: engine.rarity },
      }))
      .sort((a, b) => a.label.localeCompare(b.label)), [images])
  const filters = useMemo(() => [tagFilter('specialty', options), tagFilter('rank', options, RANK_ORDER)], [options])
  return (
    <CardSelect
      size={size}
      label={label}
      title='Select a W-Engine'
      placeholder='No W-Engine'
      clearable
      value={value}
      options={options}
      filters={filters}
      onChange={onChange}
    />
  )
}
