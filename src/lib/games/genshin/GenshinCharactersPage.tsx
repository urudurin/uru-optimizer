import {
  Badge,
  Button,
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
import {
  defaultArtifactWeights,
  genshinArtifactWeights,
  genshinBuildScore,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import { computeGenshinStats } from 'lib/games/genshin/stats/computeStats'
import {
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
import {
  moveToTop,
  orderByPriority,
  readPriority,
  usePriority,
  writePriority,
} from 'lib/games/shared/characterPriority'
import { useScoreWeightsVersion } from 'lib/games/shared/scoreWeights'
import { BuildRating } from 'lib/games/shared/ui/BuildRating'
import { CharacterMenu } from 'lib/games/shared/ui/CharacterMenu'
import { PageHeader } from 'lib/games/shared/ui/GameLayout'
import {
  describeSavedPieces,
  useSavedBuilds,
} from 'lib/games/shared/ui/optimizer/SavedBuilds'
import { openScoringModal } from 'lib/games/shared/ui/ScoringModal'
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
// (shared/ui/Showcase.tsx). The roster lists every character with stat data; ones not in the save are dimmed and can be
// added by hand (level, constellation, weapon). Art, names and weapon types come from Enka (data/images.ts); without
// them the page shows initials and names from GOOD keys.

export function GenshinCharactersPage({ onImport }: { onImport: () => void }) {
  const characters = useGenshinStore((s) => s.characters)
  const images = useGenshinImages()
  const [picked, setPicked] = useState<string | null>(null)

  // Saved characters first, then everyone else with stat data by name. The Traveler is listed once, until one is saved
  // Saved ones in priority order (shared/characterPriority.ts)
  const rankOrder = usePriority('genshin')
  const rosterIds = useMemo(() => {
    const saved = new Set(characters.map((c) => c.id))
    const hasTraveler = characters.some((c) => c.id.startsWith('Traveler'))
    const others = Object.keys(stats.characters)
      .filter((id) => !saved.has(id) && !(id === 'Traveler' && hasTraveler))
      .sort((a, b) => nameOf(a, images).localeCompare(nameOf(b, images)))
    return [...orderByPriority(characters.map((c) => c.id), rankOrder), ...others]
  }, [characters, images, rankOrder])

  const activeId = picked ?? rosterIds[0]
  const character = characters.find((c) => c.id === activeId)

  return (
    <Stack gap='lg'>
      <RosterLayout
        active={activeId}
        onPick={setPicked}
        groupColor={(group) => elementColor(group as Element)}
        entries={rosterIds.map((id) => {
          const c = characters.find((saved) => saved.id === id)
          return {
            key: id,
            name: c?.name ?? nameOf(id, images),
            meta: c ? `Lv ${c.level} · C${c.constellation} · ${c.weapon ? `${c.weapon.name} R${c.weapon.refinement}` : 'No weapon'}` : 'Not added',
            group: c?.element ?? infoOf(id, images)?.element ?? 'Unknown',
            subgroup: infoOf(id, images)?.weaponType,
            portrait: images.characters[id]?.icon,
            circle: images.characters[id]?.icon,
            dimmed: !c,
          }
        })}
      >
        {character
          ? <SavedCharacter key={character.id} character={character} images={images} />
          : activeId && <NewCharacter key={activeId} id={activeId} images={images} onImport={characters.length === 0 ? onImport : undefined} />}
      </RosterLayout>
    </Stack>
  )
}

const infoOf = (id: string, images: GenshinImages) => images.characterInfo[id.startsWith('Traveler') ? 'Traveler' : id] ?? images.characterInfo[id]
const nameOf = (id: string, images: GenshinImages) => (id === 'Traveler' ? 'Traveler' : images.characterInfo[id]?.name ?? nameFromGoodKey(id))

function SavedCharacter({ character, images }: { character: GenshinCharacter, images: GenshinImages }) {
  const artifacts = useGenshinStore((s) => s.artifacts)
  const saveCharacter = useGenshinStore((s) => s.saveCharacter)
  const [editing, setEditing] = useState(false)
  // The Character menu (after HSR's): every other saved character to switch with, and saved builds
  const characters = useGenshinStore((s) => s.characters)
  const { unequipCharacter, switchGear, deleteCharacter, equip } = useGenshinStore.getState()
  const builds = useSavedBuilds('genshin', character.id)
  // Re-render when scoring weights are saved
  useScoreWeightsVersion()

  const artifactById = useMemo(() => new Map(artifacts.map((a) => [a.id, a])), [artifacts])
  const worn = ARTIFACT_SLOTS.flatMap((slot) => {
    const id = character.artifactIds[slot]
    const artifact = id ? artifactById.get(id) : undefined
    return artifact ? [artifact] : []
  })
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
                <CharacterMenu
                  name={character.name}
                  gearNoun='artifacts'
                  others={characters.filter((c) => c.id !== character.id).map((c) => ({ value: c.id, label: c.name }))}
                  onEdit={() => setEditing(true)}
                  onSwitch={(other) => switchGear(character.id, other)}
                  onUnequip={() => unequipCharacter(character.id)}
                  onDelete={() => deleteCharacter(character.id)}
                  onSaveBuild={worn.length > 0 ? () => builds.save(worn.map((a) => a.id)) : undefined}
                  onViewBuilds={() =>
                    builds.view({
                      name: character.name,
                      describe: (b) => describeSavedPieces(b.pieceIds.flatMap((id) => artifactById.get(id)?.setName ?? []), b.pieceIds.length),
                      equip: (b) => equip(character.id, b.pieceIds.flatMap((id) => artifactById.get(id) ?? [])),
                    })}
                  savedCount={builds.saved.length}
                  onMoveToTop={() => writePriority('genshin', moveToTop(characters.map((c) => c.id), readPriority('genshin'), character.id))}
                  onSortByScore={() => {
                    const wornBy = (c: GenshinCharacter) =>
                      ARTIFACT_SLOTS.flatMap((slot) => {
                        const id = c.artifactIds[slot]
                        const artifact = id ? artifactById.get(id) : undefined
                        return artifact ? [artifact] : []
                      })
                    const scored = characters.map((c) => ({ id: c.id, score: genshinBuildScore(c, wornBy(c))?.percent ?? 0 }))
                    writePriority('genshin', scored.sort((a, b) => b.score - a.score).map((s) => s.id))
                  }}
                  onScoring={() =>
                    openScoringModal({
                      game: 'genshin',
                      characterId: character.id,
                      name: character.name,
                      stats: SUBSTAT_STATS.map((stat) => ({ value: stat, label: statLabel(stat) })),
                      current: genshinArtifactWeights(character),
                      defaults: defaultArtifactWeights(character),
                    })}
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
              weaponInfo={images.weaponInfo}
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
          <BuildRating score={genshinBuildScore(character, worn)} label='Artifact score' />
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

// A character who isn't in the save yet
function NewCharacter({ id, images, onImport }: { id: string, images: GenshinImages, onImport?: () => void }) {
  const saveCharacter = useGenshinStore((s) => s.saveCharacter)
  const info = infoOf(id, images)
  const name = nameOf(id, images)
  const isTraveler = id === 'Traveler'

  return (
    <ShowcaseCard
      sidePanel
      heading={{ stars: info?.rarity }}
      colorKey={`genshin:${id}`}
      name={name}
      accent={info?.element ? ELEMENT_ACCENTS[info.element] : undefined}
      portrait={images.characters[id]?.portrait}
      info={
        <>
          <div>
            <Text size='xl' fw={700}>{name}</Text>
            <Group gap={6} mt={4}>
              {info?.element && <Badge size='sm' variant='light' color={elementColor(info.element)}>{info.element}</Badge>}
              <Text size='xs' c='dimmed'>Not added</Text>
            </Group>
          </div>
          <Text size='sm' c='dimmed'>Add their level, constellation and weapon to see their stats. Artifacts come from an import or the Optimizer.</Text>
          <CharacterForm
            initial={{ id, name, element: info?.element, level: 90, constellation: 0 }}
            weaponInfo={images.weaponInfo}
            weaponType={info?.weaponType}
            isTraveler={isTraveler}
            submitLabel='Add character'
            onSubmit={saveCharacter}
          />
          {onImport && <Button size='xs' variant='light' onClick={onImport}>Import data instead</Button>}
        </>
      }
      gear={<Text size='sm' c='dimmed'>No artifacts yet.</Text>}
    />
  )
}
