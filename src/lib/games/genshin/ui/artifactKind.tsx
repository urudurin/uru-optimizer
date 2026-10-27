import type { GenshinImages } from 'lib/games/genshin/data/images'
import {
  estimateRolls,
  maxRoll,
  nameFromGoodKey,
  SUBSTAT_STATS,
  toGoodKey,
} from 'lib/games/genshin/goodKeys'
import type { EnkaGenshinStore } from 'lib/games/genshin/importer/enkaParser'
import { mainStatValue } from 'lib/games/genshin/importer/goodParser'
import {
  genshinArtifactWeights,
  scoreArtifact,
} from 'lib/games/genshin/stats/artifactScore'
import {
  type Artifact,
  ARTIFACT_SLOTS,
  type ArtifactSlot,
  formatStatValue,
  type GenshinCharacter,
  type GenshinStatKey,
  SLOT_LABELS,
  statLabel,
} from 'lib/games/genshin/types'
import { ArtifactCard } from 'lib/games/genshin/ui/ArtifactCard'
import {
  type GearDraft,
  type GearKind,
  newGearId,
} from 'lib/games/shared/gear/gearKind'

// Genshin artifacts for the shared gear inventory (shared/gear/gearKind.ts). Main stat values come from Enka's
// relic_levels.json (loaded by the page), like the GOOD importer; substats are entered as shown in game and their roll
// counts estimated the same way.

const MAIN_STATS: Record<ArtifactSlot, GenshinStatKey[]> = {
  flower: ['hp'],
  plume: ['atk'],
  sands: ['hpPct', 'atkPct', 'defPct', 'elementalMastery', 'energyRecharge'],
  goblet: ['hpPct', 'atkPct', 'defPct', 'elementalMastery', 'pyroDmg', 'hydroDmg', 'electroDmg', 'cryoDmg', 'anemoDmg', 'geoDmg', 'dendroDmg', 'physicalDmg'],
  circlet: ['hpPct', 'atkPct', 'defPct', 'elementalMastery', 'critRate', 'critDmg', 'healingBonus'],
}

const MAX_LEVEL: Record<number, number> = { 5: 20, 4: 16 }

// A piece with this many max rolls of one stat is the top of that stat's colour scale
const COLUMN_TOP_ROLLS = 5

export function genshinArtifactKind({ characters, images, store, artifacts }: {
  characters: GenshinCharacter[],
  images: GenshinImages,
  store?: EnkaGenshinStore,
  artifacts: Artifact[],
}): GearKind<Artifact> {
  const byId = new Map(characters.map((c) => [c.id, c]))
  const weights = new Map<string, Record<string, number>>()
  const weightsFor = (c: GenshinCharacter) => {
    let w = weights.get(c.id)
    if (!w) weights.set(c.id, w = genshinArtifactWeights(c))
    return w
  }
  const score = (artifact: Artifact) => {
    const owner = artifact.equippedBy ? byId.get(artifact.equippedBy) : undefined
    return owner ? scoreArtifact(artifact, weightsFor(owner)) : undefined
  }

  const setNames = new Map<string, string>(artifacts.map((a) => [a.setId, a.setName]))
  for (const set of Object.values(store?.sets ?? {})) {
    const name = store?.locs[set.Name]
    if (name) setNames.set(toGoodKey(name), name)
  }
  const setOptions = [...setNames].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  const mainValue = (draft: GearDraft) => store ? mainStatValue(store, Number(draft.rarity), draft.level, draft.mainStat as GenshinStatKey) : undefined

  return {
    noun: 'Artifact',
    slots: ARTIFACT_SLOTS.map((slot) => ({ value: slot, label: SLOT_LABELS[slot] })),
    slotOf: (a) => a.slot,
    sets: () => setOptions,
    setOf: (a) => a.setId,
    setName: (a) => a.setName,
    setIcon: (a) => images.artifacts[a.setId]?.[a.slot],
    rarities: [{ value: '5', label: '5★' }, { value: '4', label: '4★' }],
    rarityOf: (a) => String(a.rarity),
    levelOf: (a) => a.level,
    mainStatOf: (a) => a.main.stat,
    mainValueText: (a) => formatStatValue(a.main.stat, a.main.value),
    substats: SUBSTAT_STATS.map((stat) => ({ value: stat, label: statLabel(stat) })),
    substatValues: (a) => Object.fromEntries(a.substats.map((s) => [s.stat, s.value])),
    columnTop: (stat) => maxRoll(stat as GenshinStatKey) * COLUMN_TOP_ROLLS,
    formatValue: (stat, value) => formatStatValue(stat as GenshinStatKey, value),
    statLabel,
    ownerOf: (a) => a.equippedBy,
    ownerName: (id) => byId.get(id)?.name ?? nameFromGoodKey(id),
    score,
    preview: (a) => (
      <ArtifactCard
        artifact={a}
        icon={images.artifacts[a.setId]?.[a.slot]}
        owner={a.equippedBy ? byId.get(a.equippedBy)?.name : undefined}
        score={score(a)}
      />
    ),

    maxLevel: (draft) => MAX_LEVEL[Number(draft.rarity)] ?? 20,
    substatCount: 4,
    substatCanMatchMain: false,
    mainStats: (draft) => (MAIN_STATS[draft.slot as ArtifactSlot] ?? []).map((stat) => ({ value: stat, label: statLabel(stat) })),
    mainValuePreview: (draft) => {
      if (!store) return 'Loading game data…'
      const value = mainValue(draft)
      return value === undefined ? '—' : formatStatValue(draft.mainStat as GenshinStatKey, value)
    },
    substatStep: (stat) => (maxRoll(stat as GenshinStatKey) >= 10 ? 1 : 0.1),
    newDraft: () => ({ slot: 'flower', setId: setOptions[0]?.value ?? '', rarity: '5', level: 20, mainStat: 'hp', substats: [], extra: {} }),
    toDraft: (a) => ({
      slot: a.slot,
      setId: a.setId,
      rarity: String(a.rarity),
      level: a.level,
      mainStat: a.main.stat,
      substats: a.substats.map((s) => ({ stat: s.stat, value: s.value })),
      extra: {},
    }),
    fromDraft: (draft, existing) => {
      const errors: string[] = []
      const rarity = Number(draft.rarity)
      const top = MAX_LEVEL[rarity] ?? 20
      if (!draft.setId) errors.push('Pick a set')
      if (draft.level < 0 || draft.level > top) errors.push(`A ${rarity}★ artifact's level is 0 to ${top}`)
      const main = draft.mainStat as GenshinStatKey
      if (!(MAIN_STATS[draft.slot as ArtifactSlot] ?? []).includes(main)) errors.push(`${statLabel(main)} can't be the main stat of a ${draft.slot}`)
      const subs = draft.substats.filter((s) => s.stat)
      if (subs.some((s) => s.stat === main)) errors.push('A substat can\'t be the same as the main stat')
      if (subs.some((s) => !(s.value > 0))) errors.push('Every substat needs a value')
      if (subs.length < 2) errors.push('An artifact has at least 2 substats')
      if (rarity === 5) {
        for (const s of subs) {
          const max = maxRoll(s.stat as GenshinStatKey)
          if (s.value > 0 && (s.value < max * 0.7 - 0.05 || s.value > max * 6 + 0.05)) {
            errors.push(`${statLabel(s.stat)} ${s.value} isn't possible: one roll is ${(max * 0.7).toFixed(1)} to ${max.toFixed(1)}, six at most`)
          }
        }
        const rolls = subs.reduce((sum, s) => sum + estimateRolls(s.stat as GenshinStatKey, s.value, 5), 0)
        const allowed = 4 + Math.floor(draft.level / 4)
        if (rolls > allowed) errors.push(`A +${draft.level} artifact has at most ${allowed} substat rolls, these need at least ${rolls}`)
        if (draft.level >= 4 && subs.length < 4) errors.push('A 5★ artifact past +4 has 4 substats')
      }
      if (!store) errors.push('Enka\'s game data is still loading (main stat values come from it)')
      const value = mainValue(draft)
      if (store && value === undefined) errors.push(`No main stat value for a ${rarity}★ +${draft.level} ${statLabel(main)}`)
      if (errors.length > 0 || value === undefined) return { errors }
      const artifact: Artifact = {
        id: existing?.id ?? newGearId('artifact'),
        slot: draft.slot as ArtifactSlot,
        setId: draft.setId,
        setName: setNames.get(draft.setId) ?? nameFromGoodKey(draft.setId),
        rarity,
        level: draft.level,
        main: { stat: main, value },
        substats: subs.map((s) => ({ stat: s.stat as GenshinStatKey, value: s.value, rolls: estimateRolls(s.stat as GenshinStatKey, s.value, rarity) })),
        ...(existing?.equippedBy ? { equippedBy: existing.equippedBy } : {}),
      }
      return { item: artifact, errors: [] }
    },
  }
}
