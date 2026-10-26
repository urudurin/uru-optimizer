import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { IconUsers } from '@tabler/icons-react'
import { formatNumber } from 'lib/games/shared/format'
import { scoreBuild } from 'lib/games/shared/gearScore'
import { BuildRating } from 'lib/games/shared/ui/BuildRating'
import {
  EmptyState,
  Notices,
  PageHeader,
  Panel,
} from 'lib/games/shared/ui/GameLayout'
import {
  Roster,
  RosterLayout,
  ShowcaseCard,
  StatList,
  type StatListRow,
} from 'lib/games/shared/ui/Showcase'
import { statIcon } from 'lib/games/shared/ui/statIcons'
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
  scoreEcho,
  wuwaEchoWeights,
} from 'lib/games/wuwa/stats/echoScore'
import {
  type ElementDmgKey,
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

// The Resonators page, after HSR's Characters page like ZZZ's Agents page: a roster of banners and one showcase card
// (shared/ui/Showcase.tsx). There's no image source for WuWa yet (Enka doesn't cover it, the datamine is text only), so
// banners and the card show initials on the element's color.

// The datamine's weapon types
const WEAPON_TYPES: Record<number, string> = { 1: 'Broadblade', 2: 'Sword', 3: 'Pistols', 4: 'Gauntlets', 5: 'Rectifier' }

const accentOf = (element: ElementDmgKey | undefined) => element && `var(--mantine-color-${elementColor(element)}-6)`

export function WuwaCharactersPage({ onImport }: { onImport: () => void }) {
  const echoes = useWuwaStore((s) => s.echoes)
  const characters = useWuwaStore((s) => s.characters)
  const [picked, setPicked] = useState<string | null>(null)

  const echoById = useMemo(() => new Map(echoes.map((echo) => [echo.id, echo])), [echoes])
  const character = characters.find((c) => c.charId === picked) ?? characters[0]
  // Roster groups are element names; this finds their colors again
  const elementByName = useMemo(
    () => new Map(Object.values(CHARACTER_INFO).map((info) => [elementName(info.element), info.element])),
    [],
  )

  if (!character) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Resonators' />
        <Panel>
          <EmptyState icon={<IconUsers size={24} />} title='Import your Resonators to get started' action={<Button onClick={onImport}>Import data</Button>}>
            See the stats your in-game overview screen shows for each Resonator, with the echoes they wear.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  const loadout = character.echoIds.flatMap((id) => {
    const echo = id ? echoById.get(id) : undefined
    return echo ? [echo] : []
  })
  // Scored for this Resonator, see stats/echoScore.ts
  const echoWeights = wuwaEchoWeights(character, loadout)
  const { stats, warnings } = computeWuwaStats(character, loadout)
  const shown = toDisplayStats(stats)
  const element = CHARACTER_INFO[character.charId]?.element
  const weapon = character.weaponId ? WEAPONS[character.weaponId] : undefined
  const cost = loadout.reduce((sum, echo) => sum + echo.cost, 0)
  const name = characterName(character.charId)

  const rows: StatListRow[] = [
    { key: 'hp', icon: statIcon('hp'), label: 'HP', value: formatNumber(shown.hp) },
    { key: 'atk', icon: statIcon('atk'), label: 'ATK', value: formatNumber(shown.atk), highlight: true },
    { key: 'def', icon: statIcon('def'), label: 'DEF', value: formatNumber(shown.def) },
    { key: 'er', icon: statIcon('energy'), label: 'Energy Regen', value: `${shown.energyRegen}%` },
    { key: 'cr', icon: statIcon('critRate'), label: 'Crit Rate', value: `${shown.critRate}%`, highlight: true },
    { key: 'cd', icon: statIcon('critDmg'), label: 'Crit DMG', value: `${shown.critDmg}%`, highlight: true },
    ...(element ? [{ key: 'element', icon: statIcon('elementDmg'), label: statLabel(element), value: `${shown.elementDmg}%`, highlight: true }] : []),
    { key: 'skill', icon: statIcon('dmgBonus'), label: 'Resonance Skill DMG', value: `${shown.skillDmg}%` },
    { key: 'lib', icon: statIcon('dmgBonus'), label: 'Liberation DMG', value: `${shown.libDmg}%` },
    { key: 'basic', icon: statIcon('dmgBonus'), label: 'Basic Attack DMG', value: `${shown.basicDmg}%` },
    ...(shown.healingBonus > 0 ? [{ key: 'heal', icon: statIcon('heal'), label: 'Healing Bonus', value: `${shown.healingBonus}%` }] : []),
  ]

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Resonators'
        description='What the in-game overview screen shows, worked out from base stats, weapon, minor fortes and echoes. Matches the game to within 0.2%.'
      />

      <RosterLayout
        roster={
          <Roster
            active={character.charId}
            onPick={setPicked}
            groupColor={(group) => elementColor(elementByName.get(group))}
            entries={characters.map((c) => {
              const info = CHARACTER_INFO[c.charId]
              const w = c.weaponId ? WEAPONS[c.weaponId] : undefined
              return {
                key: c.charId,
                name: characterName(c.charId),
                meta: `Lv ${c.level} · S${c.sequence} · ${w ? `${w.name} R${c.refinement}` : 'No weapon'}`,
                group: info ? elementName(info.element) : 'Unknown',
                subgroup: w ? WEAPON_TYPES[w.weaponType] : undefined,
              }
            })}
          />
        }
      >
        <ShowcaseCard
          name={name}
          accent={accentOf(element)}
          weapon={weapon
            && { name: weapon.name, meta: `${WEAPON_TYPES[weapon.weaponType] ?? 'Weapon'} · Lv ${character.weaponLevel} · R${character.refinement}` }}
          info={
            <>
              <div>
                <Text size='xl' fw={700}>{name}</Text>
                <Group gap={6} mt={4}>
                  {element && <Badge size='sm' variant='light' color={elementColor(element)}>{elementName(element)}</Badge>}
                  <Text size='xs' c='dimmed'>{`Lv ${character.level} · S${character.sequence}`}</Text>
                </Group>
              </div>
              <StatList rows={rows} />
              <BuildRating score={scoreBuild(loadout.map((echo) => scoreEcho(echo, echoWeights)), 5)} label='Echo score' />
              <Text size='xs' c={cost > MAX_LOADOUT_COST ? 'red' : 'dimmed'}>{`Echo cost ${cost} / ${MAX_LOADOUT_COST} · main echo first`}</Text>
              <Notices messages={[...warnings, ...validateLoadout(loadout)]} />
            </>
          }
          gear={loadout.length > 0
            ? loadout.map((echo) => <EchoCard key={echo.id} echo={echo} score={scoreEcho(echo, echoWeights)} />)
            : <Text size='sm' c='dimmed'>No echoes equipped.</Text>}
        />
      </RosterLayout>
    </Stack>
  )
}
