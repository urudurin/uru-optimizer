// Extracts the character and weapon stat tables the Genshin stat calculator needs from genshin-optimizer's generated
// stats file, and writes src/lib/games/genshin/data/generated/stats.json.
//
// Source: https://github.com/frzyc/genshin-optimizer, libs/gi/stats/src/allStat_gen.json (MIT license,
// Copyright (c) 2020 frzyc). Download it yourself, then run:
//   node src/scripts/genshin/extractStats.mjs <path to allStat_gen.json>
//
// Percent stats are written as the game shows them (0.466 -> 46.6). Weapon bonuses that never show on the character
// screen (all-DMG, shield strength) are left out.

import {
  readFileSync,
  writeFileSync,
} from 'node:fs'

const input = process.argv[2]
if (!input) {
  console.error('Usage: node src/scripts/genshin/extractStats.mjs <path to allStat_gen.json>')
  process.exit(1)
}
const all = JSON.parse(readFileSync(input, 'utf8'))

// genshin-optimizer (GOOD) stat keys -> the calculator's keys, and whether they're percents
const STATS = {
  hp: ['hp', false],
  hp_: ['hpPct', true],
  atk: ['atk', false],
  atk_: ['atkPct', true],
  def: ['def', false],
  def_: ['defPct', true],
  eleMas: ['elementalMastery', false],
  enerRech_: ['energyRecharge', true],
  heal_: ['healingBonus', true],
  critRate_: ['critRate', true],
  critDMG_: ['critDmg', true],
  physical_dmg_: ['physicalDmg', true],
  pyro_dmg_: ['pyroDmg', true],
  hydro_dmg_: ['hydroDmg', true],
  anemo_dmg_: ['anemoDmg', true],
  electro_dmg_: ['electroDmg', true],
  dendro_dmg_: ['dendroDmg', true],
  cryo_dmg_: ['cryoDmg', true],
  geo_dmg_: ['geoDmg', true],
}

const round = (value) => Math.round(value * 1e6) / 1e6
const scaled = (key, value) => round(STATS[key][1] ? value * 100 : value)

function bonusTable(table) {
  const out = {}
  for (const [key, values] of Object.entries(table ?? {})) {
    if (!STATS[key]) continue
    out[STATS[key][0]] = values.map((v) => (v === -1 ? 0 : scaled(key, v)))
  }
  return out
}

function curveStat(entry) {
  return { base: round(entry.base), curve: entry.curve }
}

const characters = {}
for (const [key, char] of Object.entries(all.char.data)) {
  const curves = Object.fromEntries(char.lvlCurves.map((c) => [c.key, curveStat(c)]))
  const ascension = bonusTable(char.ascensionBonus)
  const base = {}
  for (const [stat, value] of Object.entries(char.baseStats ?? {})) if (STATS[stat]) base[STATS[stat][0]] = scaled(stat, value)
  characters[key] = { rarity: char.rarity, hp: curves.hp, atk: curves.atk, def: curves.def, ascension, base }
}

const weapons = {}
for (const [key, weapon] of Object.entries(all.weapon.data)) {
  const sub = weapon.subStat && STATS[weapon.subStat.type]
    ? { stat: STATS[weapon.subStat.type][0], base: scaled(weapon.subStat.type, weapon.subStat.base), curve: weapon.subStat.curve }
    : undefined
  weapons[key] = {
    rarity: weapon.rarity,
    atk: curveStat(weapon.mainStat),
    ...(sub ? { sub } : {}),
    ascensionAtk: (weapon.ascensionBonus?.atk ?? [0]).map(round),
    refinement: bonusTable(weapon.refinementBonus),
  }
}

const curves = Object.fromEntries(
  Object.entries({ ...all.char.expCurve, ...all.weapon.expCurve }).map(([name, values]) => [name, values.map(round)]),
)

const out = {
  provenance: {
    source: 'https://github.com/frzyc/genshin-optimizer/blob/master/libs/gi/stats/src/allStat_gen.json',
    license: 'MIT, Copyright (c) 2020 frzyc',
    extractedBy: 'src/scripts/genshin/extractStats.mjs',
    extractedOn: new Date().toISOString().slice(0, 10),
    note: 'Character and weapon base stats, level curves, ascension and always-on refinement bonuses. Percents as shown in game. Personal, non-commercial use.',
  },
  curves,
  characters,
  weapons,
}
writeFileSync(new URL('../../lib/games/genshin/data/generated/stats.json', import.meta.url), JSON.stringify(out))
console.log(`Wrote ${Object.keys(characters).length} characters, ${Object.keys(weapons).length} weapons, ${Object.keys(curves).length} curves`)
