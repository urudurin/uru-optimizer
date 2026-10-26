import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { IconUser } from '@tabler/icons-react'
import { useGenshinImages } from 'lib/games/genshin/data/images'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import {
  genshinArtifactWeights,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import { computeGenshinStats } from 'lib/games/genshin/stats/computeStats'
import {
  ARTIFACT_SLOTS,
  type Element,
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
import { scoreBuild } from 'lib/games/shared/gearScore'
import { BuildRating } from 'lib/games/shared/ui/BuildRating'
import {
  EmptyState,
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
import {
  statIcon,
  type StatIconKind,
} from 'lib/games/shared/ui/statIcons'
import {
  useMemo,
  useState,
} from 'react'

// The Characters page, after HSR's Characters page like ZZZ's Agents page: a roster of art banners and one showcase card
// (shared/ui/Showcase.tsx). Art comes from Enka (data/images.ts); without it the page shows initials instead.

const MAIN_STATS: GenshinStatKey[] = ['hp', 'atk', 'def', 'elementalMastery', 'critRate', 'critDmg', 'energyRecharge']
const HIGHLIGHTED = new Set<GenshinStatKey>(['atk', 'critRate', 'critDmg'])

const STAT_ICON_KINDS: Partial<Record<GenshinStatKey, StatIconKind>> = {
  hp: 'hp',
  atk: 'atk',
  def: 'def',
  elementalMastery: 'mastery',
  critRate: 'critRate',
  critDmg: 'critDmg',
  energyRecharge: 'energy',
  healingBonus: 'heal',
  physicalDmg: 'dmgBonus',
  allDmg: 'dmgBonus',
}

// Element accents for the showcase card, CSS colors
const ELEMENT_ACCENTS: Record<Element, string> = {
  Pyro: '#e2604a',
  Hydro: '#3e8fe0',
  Anemo: '#4ec2a4',
  Electro: '#a46be0',
  Dendro: '#7cbf3a',
  Cryo: '#7fd0e6',
  Geo: '#d9a93a',
}

// The character screen's main stats, then the DMG bonuses the character actually has
function statRows(character: GenshinCharacter, stats: GenshinCharacter['stats']): StatListRow[] {
  if (Object.keys(stats).length === 0) return []
  const elementStat = character.element ? ELEMENT_DMG_STAT[character.element] : undefined
  const bonuses = (Object.keys(stats) as GenshinStatKey[])
    .filter((stat) => !MAIN_STATS.includes(stat) && (stat === elementStat || (stats[stat] ?? 0) > 0))
  return [...MAIN_STATS, ...bonuses].map((stat) => ({
    key: stat,
    icon: statIcon(STAT_ICON_KINDS[stat] ?? 'elementDmg'),
    label: statLabel(stat),
    value: formatStatValue(stat, stats[stat] ?? 0),
    highlight: HIGHLIGHTED.has(stat) || stat === elementStat,
  }))
}

export function GenshinCharactersPage({ onImport }: { onImport: () => void }) {
  const artifacts = useGenshinStore((s) => s.artifacts)
  const characters = useGenshinStore((s) => s.characters)
  const images = useGenshinImages()
  const [picked, setPicked] = useState<string | null>(null)

  const artifactById = useMemo(() => new Map(artifacts.map((a) => [a.id, a])), [artifacts])
  const character = characters.find((c) => c.id === picked) ?? characters[0]

  if (!character) {
    return (
      <Stack gap='lg'>
        <PageHeader title='Characters' />
        <Panel>
          <EmptyState icon={<IconUser size={24} />} title='Import your characters to get started' action={<Button onClick={onImport}>Import</Button>}>
            Bring in your characters from your in-game showcase through Enka.Network, or your whole account from a GOOD file.
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
  // Scored for this character, see stats/artifactScore.ts
  const artifactWeights = genshinArtifactWeights(character, worn)
  const weapon = character.weapon
  // The game's own numbers from Enka when there are some, otherwise worked out from base stats and gear
  const fromGame = Object.keys(character.stats).length > 0
  const computed = fromGame ? undefined : computeGenshinStats(character, worn)
  const rows = statRows(character, computed?.stats ?? character.stats)
  const source = fromGame ? `From the game, ${character.statsDate}` : rows.length > 0 ? 'Calculated from base stats, weapon and artifacts' : ''
  const art = images.characters[character.id]

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Characters'
        description='Stats as your in-game character screen shows them: taken from the game through Enka.Network for showcased characters, calculated from base stats, weapon and artifacts for the rest (within display rounding of the game).'
      />

      <RosterLayout
        roster={
          <Roster
            active={character.id}
            onPick={setPicked}
            groupColor={(group) => elementColor(group as Element)}
            entries={characters.map((c) => ({
              key: c.id,
              name: c.name,
              meta: `Lv ${c.level} · C${c.constellation} · ${c.weapon ? `${c.weapon.name} R${c.weapon.refinement}` : 'No weapon'}`,
              group: c.element ?? 'Unknown',
              portrait: images.characters[c.id]?.icon,
              circle: images.characters[c.id]?.icon,
            }))}
          />
        }
      >
        <ShowcaseCard
          name={character.name}
          accent={character.element ? ELEMENT_ACCENTS[character.element] : undefined}
          portrait={art?.portrait}
          weapon={weapon && {
            image: images.weapons[weapon.id],
            name: weapon.name,
            meta: [
              `${weapon.rarity}★ · Lv ${weapon.level} · R${weapon.refinement}`,
              weapon.baseAtk !== undefined ? `Base ATK ${formatStatValue('atk', weapon.baseAtk)}` : '',
              weapon.secondary ? `${statLabel(weapon.secondary.stat)} ${formatStatValue(weapon.secondary.stat, weapon.secondary.value)}` : '',
            ].filter(Boolean).join(' · '),
          }}
          info={
            <>
              <div>
                <Text size='xl' fw={700}>{character.name}</Text>
                <Group gap={6} mt={4}>
                  {character.element && <Badge size='sm' variant='light' color={elementColor(character.element)}>{character.element}</Badge>}
                  <Text size='xs' c='dimmed'>{`Lv ${character.level} · C${character.constellation}`}</Text>
                </Group>
                {source && <Text size='xs' c='dimmed' mt={4}>{source}</Text>}
              </div>
              {rows.length > 0
                ? <StatList rows={rows} />
                : (
                  <Text size='sm' c='dimmed'>
                    No stats yet. Put this character in your in-game showcase and import from Enka.Network to see their stat screen numbers.
                  </Text>
                )}
              <BuildRating score={scoreBuild(worn.map((artifact) => scoreArtifact(artifact, artifactWeights)), 5)} label='Artifact score' />
              {computed?.missing.map((note) => <Text key={note} size='xs' c='yellow'>{note}</Text>)}
            </>
          }
          gear={worn.length > 0
            ? worn.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                icon={images.artifacts[artifact.setId]?.[artifact.slot]}
                score={scoreArtifact(artifact, artifactWeights)}
              />
            ))
            : <Text size='sm' c='dimmed'>No artifacts equipped.</Text>}
        />
      </RosterLayout>
    </Stack>
  )
}
