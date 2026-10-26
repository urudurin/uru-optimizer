import {
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { IconCards } from '@tabler/icons-react'
import {
  EmptyState,
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import { characterName } from 'lib/games/wuwa/data/gameData'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import {
  scoreEcho,
  wuwaEchoWeights,
} from 'lib/games/wuwa/stats/echoScore'
import type { Echo } from 'lib/games/wuwa/types'
import {
  EchoCard,
  setName,
} from 'lib/games/wuwa/ui/EchoCard'
import {
  useMemo,
  useState,
} from 'react'

const COST_FILTERS = ['all', '4', '3', '1']

export function WuwaEchoesPage({ onImport }: { onImport: () => void }) {
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const [cost, setCost] = useState('all')
  const [setId, setSetId] = useState<string | null>(null)

  const wearer = useMemo(() => {
    const byEcho = new Map<string, string>()
    for (const character of characters) {
      for (const id of character.echoIds) if (id) byEcho.set(id, characterName(character.charId))
    }
    return byEcho
  }, [characters])
  // Each echo is scored for the Resonator wearing it; their weights are worked out once, when first needed
  const scoreFor = useMemo(() => {
    const byId = new Map(echoes.map((e) => [e.id, e]))
    const owner = new Map<string, (typeof characters)[number]>()
    for (const character of characters) for (const id of character.echoIds) if (id) owner.set(id, character)
    const cache = new Map<string, Record<string, number>>()
    return (echo: Echo) => {
      const character = owner.get(echo.id)
      if (!character) return undefined
      let weights = cache.get(character.charId)
      if (!weights) {
        weights = wuwaEchoWeights(character, character.echoIds.flatMap((id) => (id ? byId.get(id) ?? [] : [])))
        cache.set(character.charId, weights)
      }
      return scoreEcho(echo, weights)
    }
  }, [characters, echoes])
  const setOptions = useMemo(
    () => [...new Set(echoes.map((e) => e.setId))].map((id) => ({ value: id, label: setName(id) })).sort((a, b) => a.label.localeCompare(b.label)),
    [echoes],
  )
  const shown = useMemo(
    () =>
      echoes
        .filter((e) => (cost === 'all' || e.cost === Number(cost)) && (!setId || e.setId === setId))
        .sort((a, b) => b.cost - a.cost || setName(a.setId).localeCompare(setName(b.setId))),
    [echoes, cost, setId],
  )

  if (echoes.length === 0) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Echoes' />
        <Panel>
          <EmptyState icon={<IconCards size={24} />} title='No echoes yet' action={<Button onClick={onImport}>Import echoes</Button>}>
            Import your WuwaEchoScorer data to see every echo you own, with its sonata set, main stats and substat rolls.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  return (
    <Stack gap='lg'>
      <PageHeader title='Echoes' description={`${echoes.length} echoes. Dots show how high each substat rolled among its possible values.`} />

      <Group gap='sm' align='flex-end'>
        <SegmentedControl
          value={cost}
          onChange={setCost}
          data={COST_FILTERS.map((value) => ({ value, label: value === 'all' ? 'All costs' : `Cost ${value}` }))}
        />
        <Select w={240} placeholder='Any sonata set' clearable value={setId} onChange={setSetId} data={setOptions} />
        <Text size='xs' c='dimmed'>{`Showing ${shown.length}`}</Text>
      </Group>

      <div className={gear.grid}>
        {shown.map((echo) => <EchoCard key={echo.id} echo={echo} owner={wearer.get(echo.id)} score={scoreFor(echo)} />)}
      </div>
    </Stack>
  )
}
