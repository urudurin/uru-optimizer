import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { IconUser } from '@tabler/icons-react'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import {
  ARTIFACT_SLOTS,
  ELEMENT_DMG_STAT,
  formatStatValue,
  type GenshinCharacter,
  type GenshinStatKey,
  statLabel,
} from 'lib/games/genshin/types'
import {
  ArtifactCard,
  elementColor,
} from 'lib/games/genshin/ui/ArtifactCard'
import {
  EmptyState,
  PageHeader,
  Panel,
  PickList,
  SideLayout,
  StatGrid,
  type StatTileData,
} from 'lib/games/shared/ui/GameLayout'
import gear from 'lib/games/shared/ui/GearCard.module.css'
import {
  useMemo,
  useState,
} from 'react'

const MAIN_STATS: GenshinStatKey[] = ['hp', 'atk', 'def', 'elementalMastery', 'critRate', 'critDmg', 'energyRecharge']
const HIGHLIGHTED = new Set<GenshinStatKey>(['atk', 'critRate', 'critDmg'])

// The character screen's main stats, then the DMG bonuses the character actually has
function statTiles(character: GenshinCharacter): StatTileData[] {
  const tile = (stat: GenshinStatKey) => ({
    key: stat,
    label: statLabel(stat),
    value: formatStatValue(stat, character.stats[stat] ?? 0),
    highlight: HIGHLIGHTED.has(stat),
  })
  const elementStat = character.element ? ELEMENT_DMG_STAT[character.element] : undefined
  const bonuses = (Object.keys(character.stats) as GenshinStatKey[])
    .filter((stat) => !MAIN_STATS.includes(stat) && (stat === elementStat || (character.stats[stat] ?? 0) > 0))
  return [...MAIN_STATS, ...bonuses].map(tile)
}

export function GenshinCharactersPage({ onImport }: { onImport: () => void }) {
  const artifacts = useGenshinStore((s) => s.artifacts)
  const characters = useGenshinStore((s) => s.characters)
  const [picked, setPicked] = useState<string | null>(null)

  const artifactById = useMemo(() => new Map(artifacts.map((a) => [a.id, a])), [artifacts])
  const character = characters.find((c) => c.id === picked) ?? characters[0]

  if (!character) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Characters' />
        <Panel>
          <EmptyState icon={<IconUser size={24} />} title='Import your characters to get started' action={<Button onClick={onImport}>Import from Enka</Button>}>
            Bring in the characters from your in-game showcase with their stats, weapon and artifacts.
          </EmptyState>
        </Panel>
      </Stack>
    )
  }

  const worn = ARTIFACT_SLOTS.flatMap((slot) => {
    const id = character.artifactIds[slot]
    const artifact = id ? artifactById.get(id) : undefined
    return artifact ? [artifact] : []
  })
  const weapon = character.weapon

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Characters'
        description='Stats exactly as your in-game character screen shows them, taken from the game through Enka.Network.'
      />

      <SideLayout
        side={
          <Panel title='Your characters' description={`${characters.length} imported`}>
            <PickList
              active={character.id}
              onPick={setPicked}
              items={characters.map((c) => ({
                key: c.id,
                title: c.name,
                meta: `Lv ${c.level} · C${c.constellation} · ${c.weapon ? `${c.weapon.name} R${c.weapon.refinement}` : 'No weapon'}`,
                badge: c.element ? <Badge size='xs' variant='light' color={elementColor(c.element)}>{c.element}</Badge> : undefined,
              }))}
            />
          </Panel>
        }
      >
        <Panel
          title={
            <Group gap={8}>
              <span>{character.name}</span>
              {character.element && <Badge size='sm' variant='light' color={elementColor(character.element)}>{character.element}</Badge>}
            </Group>
          }
          description={`Level ${character.level} · Constellation ${character.constellation} · Imported ${character.statsDate}`}
        >
          <StatGrid stats={statTiles(character)} />
        </Panel>

        {weapon && (
          <Panel title='Weapon'>
            <Group gap='xl' wrap='wrap'>
              <Stack gap={2}>
                <Text fw={600}>{weapon.name}</Text>
                <Text size='xs' c='dimmed'>{`${weapon.rarity}★ · Level ${weapon.level} · Refinement ${weapon.refinement}`}</Text>
              </Stack>
              <div style={{ flex: 1, minWidth: 260 }}>
                <StatGrid
                  stats={[
                    { key: 'base', label: 'Base ATK', value: formatStatValue('atk', weapon.baseAtk) },
                    ...(weapon.secondary
                      ? [{ key: 'secondary', label: statLabel(weapon.secondary.stat), value: formatStatValue(weapon.secondary.stat, weapon.secondary.value) }]
                      : []),
                  ]}
                />
              </div>
            </Group>
          </Panel>
        )}

        <Panel title='Artifacts' description={`${worn.length} of 5 slots`}>
          {worn.length > 0
            ? (
              <div className={gear.grid}>
                {worn.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}
              </div>
            )
            : <Text size='sm' c='dimmed'>No artifacts equipped.</Text>}
        </Panel>
      </SideLayout>
    </Stack>
  )
}
