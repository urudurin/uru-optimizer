import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { formatNumber } from 'lib/games/shared/format'
import { BuildRating } from 'lib/games/shared/ui/BuildRating'
import {
  Notices,
  PageHeader,
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
  CHARACTERS,
  WEAPONS,
} from 'lib/games/wuwa/data/gameData'
import {
  type ResonatorArt,
  useUserArt,
} from 'lib/games/wuwa/data/userArt'
import { validateLoadout } from 'lib/games/wuwa/echoRules'
import { useWuwaStore } from 'lib/games/wuwa/state/wuwaStore'
import {
  computeWuwaStats,
  toDisplayStats,
} from 'lib/games/wuwa/stats/computeStats'
import {
  scoreEcho,
  wuwaBuildScore,
  wuwaEchoWeights,
} from 'lib/games/wuwa/stats/echoScore'
import {
  type CharacterState,
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
  type ResonatorDetails,
  ResonatorForm,
  WEAPON_TYPES,
} from 'lib/games/wuwa/ui/ResonatorForm'
import {
  useMemo,
  useState,
} from 'react'

// The Resonators page, after HSR's Characters page like ZZZ's Agents page: a roster of banners and one showcase card
// (shared/ui/Showcase.tsx). The roster lists every Resonator in the datamine; ones not in the save are dimmed and can be
// added by hand (level, sequence, weapon), since WuWa has no whole-account export like Genshin's GOOD files. Art is
// whatever the user saved into wuwa/user-art/ (data/userArt.ts); without it, initials on the element's color.

const accentOf = (element: ElementDmgKey | undefined) => element && `var(--mantine-color-${elementColor(element)}-6)`

const NEW_RESONATOR: Omit<ResonatorDetails, 'charId'> = { level: 90, sequence: 0, weaponLevel: 90, refinement: 1, minorFortes: true }

export function WuwaCharactersPage({ onImport }: { onImport: () => void }) {
  const characters = useWuwaStore((s) => s.characters)
  const art = useUserArt()
  const [picked, setPicked] = useState<string | null>(null)

  // Roster groups are element names; this finds their colors again
  const elementByName = useMemo(
    () => new Map(Object.values(CHARACTER_INFO).map((info) => [elementName(info.element), info.element])),
    [],
  )
  // Saved Resonators first, then everyone else by name
  const rosterIds = useMemo(() => {
    const saved = new Set(characters.map((c) => c.charId))
    const others = Object.values(CHARACTERS).filter((c) => !saved.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.id)
    return [...characters.map((c) => c.charId), ...others]
  }, [characters])

  const activeId = picked ?? rosterIds[0]
  const character = characters.find((c) => c.charId === activeId)

  return (
    <Stack gap='lg'>
      <PageHeader
        title='Resonators'
        description='What the in-game overview screen shows, worked out from base stats, weapon, minor fortes and echoes. Matches the game to within 0.2%.'
      />

      <RosterLayout
        roster={
          <Roster
            active={activeId}
            onPick={setPicked}
            groupColor={(group) => elementColor(elementByName.get(group))}
            entries={rosterIds.map((charId) => {
              const c = characters.find((saved) => saved.charId === charId)
              const info = CHARACTER_INFO[charId]
              const w = c?.weaponId ? WEAPONS[c.weaponId] : undefined
              return {
                key: charId,
                name: characterName(charId),
                meta: c ? `Lv ${c.level} · S${c.sequence} · ${w ? `${w.name} R${c.refinement}` : 'No weapon'}` : 'Not added',
                group: info ? elementName(info.element) : 'Unknown',
                subgroup: w ? WEAPON_TYPES[w.weaponType] : undefined,
                portrait: art[charId]?.portrait,
                circle: art[charId]?.icon ?? art[charId]?.portrait,
                dimmed: !c,
              }
            })}
          />
        }
      >
        {character
          ? <SavedResonator key={character.charId} character={character} art={art[character.charId]} />
          : activeId && <NewResonator key={activeId} charId={activeId} art={art[activeId]} onImport={characters.length === 0 ? onImport : undefined} />}
      </RosterLayout>
    </Stack>
  )
}

function SavedResonator({ character, art }: { character: CharacterState, art?: ResonatorArt }) {
  const echoes = useWuwaStore((s) => s.echoes)
  const saveCharacter = useWuwaStore((s) => s.saveCharacter)
  const [editing, setEditing] = useState(false)

  const echoById = useMemo(() => new Map(echoes.map((echo) => [echo.id, echo])), [echoes])
  const loadout = character.echoIds.flatMap((id) => {
    const echo = id ? echoById.get(id) : undefined
    return echo ? [echo] : []
  })
  // Scored for this Resonator, see stats/echoScore.ts
  const echoWeights = wuwaEchoWeights(character)
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
    <ShowcaseCard
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
              {!editing && <Button size='compact-xs' variant='subtle' onClick={() => setEditing(true)}>Edit</Button>}
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
          <BuildRating score={wuwaBuildScore(character, loadout)} label='Echo score' />
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

// A Resonator who isn't in the save yet
function NewResonator({ charId, art, onImport }: { charId: string, art?: ResonatorArt, onImport?: () => void }) {
  const saveCharacter = useWuwaStore((s) => s.saveCharacter)
  const element = CHARACTER_INFO[charId]?.element
  const name = characterName(charId)

  return (
    <ShowcaseCard
      name={name}
      accent={accentOf(element)}
      portrait={art?.portrait}
      info={
        <>
          <div>
            <Text size='xl' fw={700}>{name}</Text>
            <Group gap={6} mt={4}>
              {element && <Badge size='sm' variant='light' color={elementColor(element)}>{elementName(element)}</Badge>}
              <Text size='xs' c='dimmed'>Not added</Text>
            </Group>
          </div>
          <Text size='sm' c='dimmed'>Add their level, sequence and weapon to see their stats. Echoes come from an import or the Optimizer.</Text>
          <ResonatorForm initial={{ ...NEW_RESONATOR, charId }} submitLabel='Add Resonator' onSubmit={saveCharacter} />
          {onImport && <Button size='xs' variant='light' onClick={onImport}>Import data instead</Button>}
        </>
      }
      gear={<Text size='sm' c='dimmed'>No echoes yet.</Text>}
    />
  )
}
