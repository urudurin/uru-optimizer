import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { IconUsers } from '@tabler/icons-react'
import { formatNumber } from 'lib/games/shared/format'
import {
  EmptyState,
  Notices,
  PageHeader,
  Panel,
  PickList,
  SideLayout,
  StatGrid,
} from 'lib/games/shared/ui/GameLayout'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import { CHARACTER_INFO } from 'lib/games/wuwa/data/characters'
import {
  characterName,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import { validateLoadout } from 'lib/games/wuwa/echoRules'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import {
  computeWuwaStats,
  toDisplayStats,
} from 'lib/games/wuwa/stats/computeStats'
import {
  MAX_LOADOUT_COST,
  statLabel,
} from 'lib/games/wuwa/types'
import {
  EchoCard,
  elementColor,
  elementName,
} from 'lib/games/wuwa/ui/EchoCard'
import {
  useMemo,
  useState,
} from 'react'

export function WuwaCharactersPage({ onImport }: { onImport: () => void }) {
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const [picked, setPicked] = useState<string | null>(null)

  const echoById = useMemo(() => new Map(echoes.map((echo) => [echo.id, echo])), [echoes])
  const character = characters.find((c) => c.charId === picked) ?? characters[0]

  if (!character) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Characters' />
        <Panel>
          <EmptyState icon={<IconUsers size={24} />} title='Import your characters to get started' action={<Button onClick={onImport}>Import data</Button>}>
            See the stats your in-game overview screen shows for each character, with the echoes they wear.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  const loadout = character.echoIds.flatMap((id) => {
    const echo = id ? echoById.get(id) : undefined
    return echo ? [echo] : []
  })
  const { stats, warnings } = computeWuwaStats(character, loadout)
  const shown = toDisplayStats(stats)
  const element = CHARACTER_INFO[character.charId]?.element
  const weapon = character.weaponId ? WEAPONS[character.weaponId] : undefined
  const cost = loadout.reduce((sum, echo) => sum + echo.cost, 0)

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Characters'
        description='What the in-game overview screen shows, worked out from base stats, weapon, minor fortes and echoes. Matches the game to within 0.2%.'
      />

      <SideLayout
        side={
          <Panel title='Your characters' description={`${characters.length} imported`}>
            <PickList
              active={character.charId}
              onPick={setPicked}
              items={characters.map((c) => {
                const info = CHARACTER_INFO[c.charId]
                const w = c.weaponId ? WEAPONS[c.weaponId] : undefined
                return {
                  key: c.charId,
                  title: characterName(c.charId),
                  meta: `Lv ${c.level} · S${c.sequence} · ${w ? `${w.name} R${c.refinement}` : 'No weapon'}`,
                  badge: info ? <Badge size='xs' variant='light' color={elementColor(info.element)}>{elementName(info.element)}</Badge> : undefined,
                }
              })}
            />
          </Panel>
        }
      >
        <Panel
          title={
            <Group gap={8}>
              <span>{characterName(character.charId)}</span>
              {element && <Badge size='sm' variant='light' color={elementColor(element)}>{elementName(element)}</Badge>}
            </Group>
          }
          description={`Level ${character.level} · Sequence ${character.sequence} · ${weapon ? `${weapon.name} R${character.refinement}` : 'No weapon'}`}
        >
          <Stack gap='md'>
            <StatGrid
              stats={[
                { key: 'hp', label: 'HP', value: formatNumber(shown.hp) },
                { key: 'atk', label: 'ATK', value: formatNumber(shown.atk), highlight: true },
                { key: 'def', label: 'DEF', value: formatNumber(shown.def) },
                { key: 'er', label: 'Energy Regen', value: `${shown.energyRegen}%` },
                { key: 'cr', label: 'Crit Rate', value: `${shown.critRate}%`, highlight: true },
                { key: 'cd', label: 'Crit DMG', value: `${shown.critDmg}%`, highlight: true },
                ...(element ? [{ key: 'element', label: statLabel(element), value: `${shown.elementDmg}%` }] : []),
                { key: 'skill', label: 'Resonance Skill DMG', value: `${shown.skillDmg}%` },
                { key: 'lib', label: 'Liberation DMG', value: `${shown.libDmg}%` },
                { key: 'basic', label: 'Basic Attack DMG', value: `${shown.basicDmg}%` },
                ...(shown.healingBonus > 0 ? [{ key: 'heal', label: 'Healing Bonus', value: `${shown.healingBonus}%` }] : []),
              ]}
            />
            <Notices messages={[...warnings, ...validateLoadout(loadout)]} />
          </Stack>
        </Panel>

        <Panel
          title='Echoes'
          description='Main echo first'
          actions={<Text size='sm' c={cost > MAX_LOADOUT_COST ? 'red' : 'dimmed'}>{`Cost ${cost} / ${MAX_LOADOUT_COST}`}</Text>}
        >
          <div className={gear.grid}>
            {loadout.map((echo) => <EchoCard key={echo.id} echo={echo} />)}
          </div>
        </Panel>
      </SideLayout>
    </Stack>
  )
}
