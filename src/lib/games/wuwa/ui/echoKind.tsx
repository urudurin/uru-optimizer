import { Select } from '@mantine/core'
import {
  type GearKind,
  newGearId,
} from 'lib/games/shared/gear/gearKind'
import {
  characterName,
  ECHO_DEFINITIONS,
  SONATA_SETS,
} from 'lib/games/wuwa/data/gameData'
import { validateEcho } from 'lib/games/wuwa/echoRules'
import {
  MAIN_STAT_MAX,
  mainStatValue,
  maxRoll,
  SUBSTAT_KEYS,
  SUBSTAT_TIERS,
} from 'lib/games/wuwa/echoStats'
import {
  scoreEcho,
  wuwaEchoWeights,
} from 'lib/games/wuwa/stats/echoScore'
import {
  type CharacterState,
  type Cost,
  type Echo,
  MAX_ECHO_LEVEL,
  type StatKey,
  statLabel,
  type SubstatKey,
} from 'lib/games/wuwa/types'
import {
  EchoCard,
  echoName,
} from 'lib/games/wuwa/ui/EchoCard'

// WuWa echoes for the shared gear inventory (shared/gear/gearKind.ts). The "slot" is the echo's cost; the editor also
// picks which echo it is, from the ones that can drop at that cost in that sonata set. Substats take one of their roll
// tiers, and the whole echo is checked by echoRules.ts like an import is.

const FLAT_STATS = new Set<string>(['atkFlat', 'defFlat', 'hpFlat'])
const formatValue = (stat: string, value: number) => (FLAT_STATS.has(stat) ? String(Math.round(value)) : `${Math.round(value * 10) / 10}%`)

// The echoes that drop at this cost in this sonata set
const echoesFor = (cost: string, setId: string) =>
  Object.values(ECHO_DEFINITIONS)
    .filter((def) => def.cost === Number(cost) && (!setId || def.setIds.includes(setId)))
    .sort((a, b) => a.name.localeCompare(b.name))

export function wuwaEchoKind({ characters }: { characters: CharacterState[] }): GearKind<Echo> {
  const wearer = new Map<string, CharacterState>()
  for (const c of characters) for (const id of c.echoIds) if (id) wearer.set(id, c)
  const score = (echo: Echo) => {
    const owner = wearer.get(echo.id)
    return owner ? scoreEcho(echo, wuwaEchoWeights(owner)) : undefined
  }
  const setOptions = Object.values(SONATA_SETS).map((set) => ({ value: set.id, label: set.name })).sort((a, b) => a.label.localeCompare(b.label))

  return {
    noun: 'Echo',
    slots: ['4', '3', '1'].map((cost) => ({ value: cost, label: `Cost ${cost}` })),
    slotOf: (echo) => String(echo.cost),
    sets: () => setOptions,
    setOf: (echo) => echo.setId,
    setName: (echo) => `${SONATA_SETS[echo.setId]?.name ?? echo.setId} · ${echoName(echo)}`,
    rarities: [{ value: '5', label: '5★' }],
    rarityOf: () => '5',
    levelOf: (echo) => echo.level,
    mainStatOf: (echo) => echo.mainStat,
    mainValueText: (echo) => formatValue(echo.mainStat, mainStatValue(echo.cost, echo.mainStat, echo.level)),
    substats: SUBSTAT_KEYS.map((stat) => ({ value: stat, label: statLabel(stat) })),
    substatValues: (echo) => Object.fromEntries(echo.substats.map((s) => [s.stat, s.value])),
    // An echo has each substat once, so a max roll is the top of its column's colour scale
    columnTop: (stat) => maxRoll(stat as SubstatKey),
    formatValue,
    statLabel,
    ownerOf: (echo) => wearer.get(echo.id)?.charId,
    ownerName: characterName,
    score,
    preview: (echo) => <EchoCard echo={echo} owner={wearer.has(echo.id) ? characterName(wearer.get(echo.id)!.charId) : undefined} score={score(echo)} />,

    maxLevel: () => MAX_ECHO_LEVEL,
    substatCount: 5,
    substatCanMatchMain: true,
    mainStats: (draft) => Object.keys(MAIN_STAT_MAX[Number(draft.slot) as Cost] ?? {}).map((stat) => ({ value: stat, label: statLabel(stat) })),
    mainValuePreview: (draft) => {
      const cost = Number(draft.slot) as Cost
      return MAIN_STAT_MAX[cost]?.[draft.mainStat as StatKey] === undefined
        ? '—'
        : formatValue(draft.mainStat, mainStatValue(cost, draft.mainStat as StatKey, draft.level))
    },
    substatChoices: (_draft, stat) =>
      [...(SUBSTAT_TIERS[stat as SubstatKey] ?? [])].reverse().map((value) => ({ value: String(value), label: formatValue(stat, value) })),
    extraFields: (draft, update) => {
      const options = echoesFor(draft.slot, draft.setId).map((def) => ({ value: def.id, label: def.name }))
      return (
        <Select
          label='Echo'
          searchable
          allowDeselect={false}
          placeholder={options.length ? 'Pick the echo' : 'No echo of this cost drops in this set'}
          value={options.some((o) => o.value === draft.extra.defId) ? draft.extra.defId : null}
          onChange={(defId) => defId && update({ extra: { ...draft.extra, defId } })}
          data={options}
        />
      )
    },
    newDraft: () => ({ slot: '4', setId: setOptions[0]?.value ?? '', rarity: '5', level: MAX_ECHO_LEVEL, mainStat: 'critRate', substats: [], extra: {} }),
    toDraft: (echo) => ({
      slot: String(echo.cost),
      setId: echo.setId,
      rarity: '5',
      level: echo.level,
      mainStat: echo.mainStat,
      substats: echo.substats.map((s) => ({ stat: s.stat, value: s.value })),
      extra: { defId: echo.defId },
    }),
    fromDraft: (draft, existing) => {
      const definition = draft.extra.defId ? ECHO_DEFINITIONS[draft.extra.defId] : undefined
      if (!definition) return { errors: ['Pick which echo it is'] }
      const echo: Echo = {
        id: existing?.id ?? newGearId('echo'),
        defId: definition.id,
        cost: Number(draft.slot) as Cost,
        setId: draft.setId,
        mainStat: draft.mainStat as StatKey,
        level: draft.level,
        substats: draft.substats.filter((s) => s.stat).map((s) => ({ stat: s.stat as SubstatKey, value: s.value })),
      }
      const errors = validateEcho(echo, definition)
      if (echo.substats.some((s) => !s.value)) errors.push('Every substat needs a value')
      return errors.length > 0 ? { errors } : { item: echo, errors: [] }
    },
  }
}
