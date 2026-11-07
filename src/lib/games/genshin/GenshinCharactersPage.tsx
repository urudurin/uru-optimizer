import {
  Badge,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import stats from 'lib/games/genshin/data/generated/stats.json'
import {
  type GenshinImages,
  useGenshinImages,
} from 'lib/games/genshin/data/images'
import { nameFromGoodKey } from 'lib/games/genshin/goodKeys'
import { SUBSTAT_STATS } from 'lib/games/genshin/goodKeys'
import { useGenshinStore } from 'lib/games/genshin/state/genshinStore'
import { genshinRoster } from 'lib/games/genshin/state/roster'
import {
  defaultArtifactWeights,
  genshinArtifactWeights,
  genshinBuildScore,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import { computeGenshinStats } from 'lib/games/genshin/stats/computeStats'
import {
  type Artifact,
  ARTIFACT_SLOTS,
  type Element,
  formatStatValue,
  type GenshinCharacter,
  statLabel,
} from 'lib/games/genshin/types'
import {
  ArtifactCard,
  elementColor,
} from 'lib/games/genshin/ui/ArtifactCard'
import { CharacterForm } from 'lib/games/genshin/ui/CharacterForm'
import {
  ELEMENT_ACCENTS,
  genshinStatRows,
} from 'lib/games/genshin/ui/characterStats'
import { GenshinScoring } from 'lib/games/genshin/ui/GenshinScoring'
import {
  orderByPriority,
  usePriority,
} from 'lib/games/shared/characterPriority'
import { useScoreWeightsVersion } from 'lib/games/shared/scoreWeights'
import {
  CharacterBuildRating,
  type CharacterKind,
  CharacterKindMenu,
} from 'lib/games/shared/ui/CharacterKind'
import {
  RosterLayout,
  ShowcaseCard,
  StatList,
  sumRolls,
} from 'lib/games/shared/ui/Showcase'
import {
  useMemo,
  useState,
} from 'react'

// The Characters page, after HSR's Characters page like ZZZ's Agents page: a roster of art banners and one showcase card
// (shared/ui/Showcase.tsx). The roster lists every character with stat data, like HSR: ones not in the save have a default
// build (state/roster.ts) and are saved once changed. Art, names and weapon types come from Enka (data/images.ts); without
// them the page shows initials and names from GOOD keys.

export function GenshinCharactersPage() {
  const saved = useGenshinStore((s) => s.characters)
  const images = useGenshinImages()
  const characters = useMemo(() => genshinRoster(saved, images), [saved, images])
  const [picked, setPicked] = useState<string | null>(null)

  // Saved characters first in priority order (shared/characterPriority.ts), then everyone else by name
  const rankOrder = usePriority('genshin')
  const rosterIds = useMemo(() => {
    const savedIds = new Set(saved.map((c) => c.id))
    const others = characters.filter((c) => !savedIds.has(c.id)).sort((x, y) => x.name.localeCompare(y.name)).map((c) => c.id)
    return [...orderByPriority(saved.map((c) => c.id), rankOrder), ...others]
  }, [saved, characters, rankOrder])

  const activeId = picked ?? rosterIds[0]
  const character = characters.find((c) => c.id === activeId)

  return (
    <Stack gap='lg'>
      <RosterLayout
        active={activeId}
        onPick={setPicked}
        groupColor={(group) => elementColor(group as Element)}
        entries={rosterIds.map((id) => {
          const c = characters.find((entry) => entry.id === id)
          return {
            key: id,
            name: c?.name ?? nameOf(id, images),
            meta: c ? `Lv ${c.level} · C${c.constellation} · ${c.weapon ? `${c.weapon.name} R${c.weapon.refinement}` : 'No weapon'}` : '',
            group: c?.element ?? infoOf(id, images)?.element ?? 'Unknown',
            subgroup: infoOf(id, images)?.weaponType,
            portrait: images.characters[id]?.icon,
            circle: images.characters[id]?.icon,
          }
        })}
      >
        {character && <SavedCharacter key={character.id} character={character} images={images} />}
      </RosterLayout>
    </Stack>
  )
}

const infoOf = (id: string, images: GenshinImages) => images.characterInfo[id.startsWith('Traveler') ? 'Traveler' : id] ?? images.characterInfo[id]
const nameOf = (id: string, images: GenshinImages) => (id === 'Traveler' ? 'Traveler' : images.characterInfo[id]?.name ?? nameFromGoodKey(id))

// The Character menu's game parts (shared/ui/CharacterKind.tsx)
const GENSHIN_CHARACTER_KIND: CharacterKind<GenshinCharacter, Artifact> = {
  game: 'genshin',
  gearNoun: 'artifacts',
  ownerId: (character) => character.id,
  characterId: (character) => character.id,
  ownerLabel: (character) => character.name,
  wornBy: (character, byId) =>
    ARTIFACT_SLOTS.flatMap((slot) => {
      const id = character.artifactIds[slot]
      const artifact = id ? byId.get(id) : undefined
      return artifact ? [artifact] : []
    }),
  setNameOf: (artifact) => artifact.setName,
  buildScore: genshinBuildScore,
  buildScoreLabel: 'Artifact score',
  scoring: (character) => ({
    stats: SUBSTAT_STATS.map((stat) => ({ value: stat, label: statLabel(stat) })),
    current: genshinArtifactWeights(character),
    defaults: defaultArtifactWeights(character),
  }),
  switchGear: (a, b) => useGenshinStore.getState().switchGear(a, b),
  unequipOwner: (id) => useGenshinStore.getState().unequipOwner(id),
  deleteOwner: (id) => useGenshinStore.getState().deleteOwner(id),
  equip: (character, pieces) => useGenshinStore.getState().equip(character, pieces),
}

function SavedCharacter({ character, images }: { character: GenshinCharacter, images: GenshinImages }) {
  const artifacts = useGenshinStore((s) => s.artifacts)
  const saveCharacter = useGenshinStore((s) => s.saveCharacter)
  const [editing, setEditing] = useState(false)
  // The Character menu (after HSR's): every other saved character to switch with, and saved builds
  const characters = useGenshinStore((s) => s.characters)
  // Re-render when scoring weights are saved
  useScoreWeightsVersion()

  const artifactById = useMemo(() => new Map(artifacts.map((a) => [a.id, a])), [artifacts])
  const worn = GENSHIN_CHARACTER_KIND.wornBy(character, artifactById)
  // Every character, for the DPS score's teammates
  const roster = useMemo(() => genshinRoster(characters, images), [characters, images])
  // Scored for this character, see stats/artifactScore.ts
  const artifactWeights = genshinArtifactWeights(character)
  const weapon = character.weapon
  // The game's own numbers from Enka when there are some, otherwise worked out from base stats and gear
  const fromGame = Object.keys(character.stats).length > 0
  const computed = fromGame ? undefined : computeGenshinStats(character, worn)
  const rows = genshinStatRows(character, computed?.stats ?? character.stats)
  const source = fromGame ? `From the game, ${character.statsDate}` : rows.length > 0 ? 'Calculated from base stats, weapon and artifacts' : ''
  const art = images.characters[character.id]

  return (
    <ShowcaseCard
      sidePanel
      heading={{ stars: infoOf(character.id, images)?.rarity }}
      colorKey={`genshin:${character.id}`}
      breakdown={{
        pieces: worn.map((a) => ({
          key: a.id,
          label: `${a.slot[0].toUpperCase()}${a.slot.slice(1)} · ${a.setName}`,
          score: scoreArtifact(a, artifactWeights),
        })),
        rolls: sumRolls(worn.flatMap((a) => a.substats.map((s) => ({ stat: s.stat, rolls: s.rolls ?? 0 }))), statLabel, artifactWeights),
        rollUnit: 'rolls',
      }}
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
            <Group justify='space-between' wrap='nowrap'>
              <Text size='xl' fw={700}>{character.name}</Text>
              {!editing && (
                <CharacterKindMenu
                  kind={GENSHIN_CHARACTER_KIND}
                  owner={character}
                  name={character.name}
                  owners={characters}
                  gearById={artifactById}
                  onEdit={() => setEditing(true)}
                />
              )}
            </Group>
            <Group gap={6} mt={4}>
              {character.element && <Badge size='sm' variant='light' color={elementColor(character.element)}>{character.element}</Badge>}
              <Text size='xs' c='dimmed'>{`Lv ${character.level} · C${character.constellation}`}</Text>
            </Group>
            {source && <Text size='xs' c='dimmed' mt={4}>{source}</Text>}
          </div>
          {editing && (
            <CharacterForm
              initial={character}
              images={images}
              weaponType={infoOf(character.id, images)?.weaponType}
              submitLabel='Save'
              onSubmit={(details) => {
                saveCharacter(details)
                setEditing(false)
              }}
              onCancel={() => setEditing(false)}
            />
          )}
          {rows.length > 0
            ? <StatList rows={rows} />
            : (
              <Text size='sm' c='dimmed'>
                No stats yet. Put this character in your in-game showcase and import from Enka.Network to see their stat screen numbers.
              </Text>
            )}
          <GenshinScoring
            character={character}
            worn={worn}
            roster={roster}
            artifacts={artifacts}
            images={images}
            fallback={<CharacterBuildRating kind={GENSHIN_CHARACTER_KIND} owner={character} worn={worn} />}
          />
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
        : <Text size='sm' c='dimmed'>No artifacts equipped. Pick some on the Optimizer page and equip them.</Text>}
    />
  )
}
