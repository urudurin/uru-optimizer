// Extracts every ZZZ agent's skill damage multipliers from genshin-optimizer's generated ZZZ stats file, and writes
// src/lib/games/zzz/data/generated/skills.json for the rotation damage calculation (zzz/damage/).
//
// Source: https://github.com/frzyc/genshin-optimizer, libs/zzz/stats/src/allStat_gen.json (MIT license,
// Copyright (c) 2020 frzyc). Download it yourself, then run:
//   node src/scripts/zzz/extractSkills.mjs <path to allStat_gen.json>
//
// Each skill keeps its hits (or stages, e.g. a charged attack's levels) in order, as [multiplier at level 1, growth per
// level], in percent of ATK. Hits with no damage (defensive assists, dodges) are dropped, and so are skills left with
// none. Personal, non-commercial use, see src/lib/games/DATA-SOURCES.md.

import {
  readFileSync,
  writeFileSync,
} from 'node:fs'

const input = process.argv[2]
if (!input) {
  console.error('Usage: node src/scripts/zzz/extractSkills.mjs <path to allStat_gen.json>')
  process.exit(1)
}
const all = JSON.parse(readFileSync(input, 'utf8'))

const round = (value) => Math.round(value * 100000) / 1000

const agents = {}
for (const [key, character] of Object.entries(all.char)) {
  const skills = []
  for (const [category, entries] of Object.entries(character.skillParams ?? {})) {
    for (const [name, hits] of Object.entries(entries)) {
      const kept = hits.map((hit) => [round(hit.DamagePercentage ?? 0), round(hit.DamagePercentageGrowth ?? 0)])
      if (kept.every(([base]) => base === 0)) continue
      skills.push({ key: name, category, hits: kept })
    }
  }
  agents[String(character.id)] = { name: key, skills }
}

const output = {
  provenance: {
    source: 'https://github.com/frzyc/genshin-optimizer/blob/master/libs/zzz/stats/src/allStat_gen.json',
    license: 'MIT, Copyright (c) 2020 frzyc',
    extractedBy: 'src/scripts/zzz/extractSkills.mjs',
    extractedOn: new Date().toISOString().slice(0, 10),
    note: 'Skill hits as [percent of ATK at level 1, growth per level]. Personal, non-commercial use.',
  },
  agents,
}
writeFileSync('src/lib/games/zzz/data/generated/skills.json', `${JSON.stringify(output)}\n`)
console.log(`Wrote ${Object.keys(agents).length} agents`)
