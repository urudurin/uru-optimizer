import {
  Badge,
  Group,
  Stack,
  Text,
} from '@mantine/core'
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
  Notices,
} from 'lib/games/shared/ui/GameLayout'
import {
  RosterLayout,
  ShowcaseCard,
  StatList,
  sumRolls,
} from 'lib/games/shared/ui/Showcase'
import { CHARACTER_INFO } from 'lib/games/wuwa/data/characters'
import {
  characterName,
  CHARACTERS,
  ECHO_DEFINITIONS,
  SONATA_SETS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import {
  type ResonatorArt,
  useUserArt,
} from 'lib/games/wuwa/data/userArt'
import { validateLoadout } from 'lib/games/wuwa/echoRules'
import {
  maxRoll,
  SUBSTAT_KEYS,
} from 'lib/games/wuwa/echoStats'
import { wuwaRoster } from 'lib/games/wuwa/state/roster'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import {
  computeWuwaStats,
  toDisplayStats,
} from 'lib/games/wuwa/stats/computeStats'
import {
  defaultEchoWeights,
  scoreEcho,
  wuwaBuildScore,
  wuwaEchoWeights,
} from 'lib/games/wuwa/stats/echoScore'
import {
  type CharacterState,
  type Echo,
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
  ResonatorForm,
  WEAPON_TYPES,
} from 'lib/games/wuwa/ui/ResonatorForm'
import { wuwaStatRows } from 'lib/games/wuwa/ui/resonatorStats'
import {
  useMemo,
  useState,
} from 'react'

// The Resonators page, after HSR's Characters page like ZZZ's Agents page: a roster of banners and one showcase card
// (shared/ui/Showcase.tsx). The roster lists every Resonator in the datamine, like HSR: ones not in the save have a default
// build (state/roster.ts) and are saved once changed (Edit, Equip...). Art is
// whatever the user saved into wuwa/user-art/ (data/userArt.ts); without it, initials on the element's color.

const accentOf = (element: ElementDmgKey | undefined) => element && `var(--mantine-color-${elementColor(element)}-6)`

export function WuwaCharactersPage() {
  const saved = useWuwaStore((s) => s.characters)
  const characters = useMemo(() => wuwaRoster(saved), [saved])
  const art = useUserArt()
  const [picked, setPicked] = useState<string | null>(null)

  // Roster groups are element names; this finds their colors again
  const elementByName = useMemo(
    () => new Map(Object.values(CHARACTER_INFO).map((info) => [elementName(info.element), info.element])),
    [],
  )
  // Saved Resonators first, then everyone else by name
  // Saved ones in priority order (shared/characterPriority.ts)
  const rankOrder = usePriority('wuwa')
  const rosterIds = useMemo(() => {
    const savedIds = new Set(saved.map((c) => c.charId))
    const others = Object.values(CHARACTERS).filter((c) => !savedIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.id)
    return [...orderByPriority(saved.map((c) => c.charId), rankOrder), ...others]
  }, [saved, rankOrder])

  const activeId = picked ?? rosterIds[0]
  const character = characters.find((c) => c.charId === activeId)

  return (
    <Stack gap='lg'>
      <RosterLayout
        active={activeId}
        onPick={setPicked}
        groupColor={(group) => elementColor(elementByName.get(group))}
        entries={rosterIds.map((charId) => {
          const c = characters.find((entry) => entry.charId === charId)
          const info = CHARACTER_INFO[charId]
          const w = c?.weaponId ? WEAPONS[c.weaponId] : undefined
          return {
            key: charId,
            name: characterName(charId),
            meta: c ? `Lv ${c.level} · S${c.sequence} · ${w ? `${w.name} R${c.refinement}` : 'No weapon'}` : '',
            group: info ? elementName(info.element) : 'Unknown',
            subgroup: WEAPON_TYPES[CHARACTERS[charId]?.weaponType ?? w?.weaponType ?? 0],
            portrait: art[charId]?.portrait,
            circle: art[charId]?.icon ?? art[charId]?.portrait,
          }
        })}
      >
        {character && <SavedResonator key={character.charId} character={character} art={art[character.charId]} />}
      </RosterLayout>
    </Stack>
  )
}

// The Character menu's game parts (shared/ui/CharacterKind.tsx)
const WUWA_CHARACTER_KIND: CharacterKind<CharacterState, Echo> = {
  game: 'wuwa',
  gearNoun: 'echoes',
  ownerId: (character) => character.charId,
  characterId: (character) => character.charId,
  ownerLabel: (character) => characterName(character.charId),
  wornBy: (character, byId) => character.echoIds.flatMap((id) => (id ? byId.get(id) ?? [] : [])),
  setNameOf: (echo) => SONATA_SETS[echo.setId]?.name ?? echo.setId,
  buildScore: wuwaBuildScore,
  buildScoreLabel: 'Echo score',
  scoring: (character) => ({
    stats: SUBSTAT_KEYS.map((stat) => ({ value: stat, label: statLabel(stat) })),
    current: wuwaEchoWeights(character),
    defaults: defaultEchoWeights(character),
  }),
  switchGear: (a, b) => useWuwaStore.getState().switchGear(a, b),
  unequipOwner: (id) => useWuwaStore.getState().unequipOwner(id),
  deleteOwner: (id) => useWuwaStore.getState().deleteOwner(id),
  equip: (character, pieces) => useWuwaStore.getState().equip(character, pieces),
}

function SavedResonator({ character, art }: { character: CharacterState, art?: ResonatorArt }) {
  const echoes = useWuwaStore((s) => s.echoes)
  const saveCharacter = useWuwaStore((s) => s.saveCharacter)
  const [editing, setEditing] = useState(false)
  // The Character menu (after HSR's): every other saved Resonator to switch with, and saved builds
  const characters = useWuwaStore((s) => s.characters)
  // Re-render when scoring weights are saved
  useScoreWeightsVersion()

  const echoById = useMemo(() => new Map(echoes.map((echo) => [echo.id, echo])), [echoes])
  const loadout = WUWA_CHARACTER_KIND.wornBy(character, echoById)
  // Scored for this Resonator, see stats/echoScore.ts
  const echoWeights = wuwaEchoWeights(character)
  const { stats, warnings } = computeWuwaStats(character, loadout)
  const shown = toDisplayStats(stats)
  const element = CHARACTER_INFO[character.charId]?.element
  const weapon = character.weaponId ? WEAPONS[character.weaponId] : undefined
  const cost = loadout.reduce((sum, echo) => sum + echo.cost, 0)
  const name = characterName(character.charId)

  const rows = wuwaStatRows(shown, element)

  return (
    <ShowcaseCard
      sidePanel
      colorKey={`wuwa:${character.charId}`}
      breakdown={{
        pieces: loadout.map((e) => ({ key: e.id, label: `Cost ${e.cost} · ${ECHO_DEFINITIONS[e.defId]?.name ?? e.defId}`, score: scoreEcho(e, echoWeights) })),
        // Echo substats roll once, so they add up in max rolls (value / its highest roll)
        rolls: sumRolls(loadout.flatMap((e) => e.substats.map((s) => ({ stat: s.stat, rolls: s.value / maxRoll(s.stat) }))), statLabel, echoWeights),
        rollUnit: 'max rolls',
      }}
      name={name}
      accent={accentOf(element)}
      portrait={art?.portrait}
      weapon={weapon
        && { name: weapon.name, meta: `${WEAPON_TYPES[weapon.weaponType] ?? 'Weapon'} · Lv ${character.weaponLevel} · R${character.refinement}` }}
      info={
        <>
          <div>
            <Group justify='space-between' wrap='nowrap'>
              <Text size='xl' fw={700}>{name}</Text>
              {!editing && (
                <CharacterKindMenu
                  kind={WUWA_CHARACTER_KIND}
                  owner={character}
                  name={name}
                  owners={characters}
                  gearById={echoById}
                  onEdit={() => setEditing(true)}
                />
              )}
            </Group>
            <Group gap={6} mt={4}>
              {element && <Badge size='sm' variant='light' color={elementColor(element)}>{elementName(element)}</Badge>}
              <Text size='xs' c='dimmed'>{`Lv ${character.level} · S${character.sequence}`}</Text>
            </Group>
          </div>
          {editing && (
            <ResonatorForm
              initial={character}
              submitLabel='Save'
              onSubmit={(details) => {
                saveCharacter(details)
                setEditing(false)
              }}
              onCancel={() => setEditing(false)}
            />
          )}
          <StatList rows={rows} />
          <CharacterBuildRating kind={WUWA_CHARACTER_KIND} owner={character} worn={loadout} />
          <Text size='xs' c={cost > MAX_LOADOUT_COST ? 'red' : 'dimmed'}>{`Echo cost ${cost} / ${MAX_LOADOUT_COST} · main echo first`}</Text>
          <Notices messages={[...warnings, ...validateLoadout(loadout)]} />
        </>
      }
      gear={loadout.length > 0
        ? loadout.map((echo) => <EchoCard key={echo.id} echo={echo} score={scoreEcho(echo, echoWeights)} />)
        : <Text size='sm' c='dimmed'>No echoes equipped. Pick some on the Optimizer page and equip them.</Text>}
    />
  )
}
